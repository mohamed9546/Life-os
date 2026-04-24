"""Unified LLM client.

Adapted from ApplyPilot (https://github.com/Pickle-Pixel/ApplyPilot). We use
Gemini's OpenAI-compatible endpoint as the primary code path so Gemini and
OpenAI share one request shape, with automatic fallback to Gemini's native
`generateContent` API on 403 (which happens with preview / experimental
models that aren't on the compat layer).

Provider order:
  1. LLM_URL set -> OpenAI-compatible local/cloud model endpoint
  2. GEMINI_API_KEY set -> Gemini (default model: gemini-2.5-flash)
  3. OPENAI_API_KEY set -> OpenAI (default model: gpt-4o-mini)

When multiple providers are set, the sidecar tries them in order and falls
through on persistent runtime/rate-limit failures.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

import httpx

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_GEMINI_COMPAT_BASE = "https://generativelanguage.googleapis.com/v1beta/openai"
_GEMINI_NATIVE_BASE = "https://generativelanguage.googleapis.com/v1beta"
_OPENAI_BASE = "https://api.openai.com/v1"

_TIMEOUT_SECS = 90
_MAX_RETRIES = 4
# Gemini free tier = 15 RPM = 4s minimum between requests. 8s gives headroom
# and doubles up on subsequent retries, capped at 60s.
_RATE_LIMIT_BASE_WAIT = 8
_RATE_LIMIT_MAX_WAIT = 60


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class LLMError(Exception):
    """Base exception for LLM failures. Carries a structured failure_kind
    so the FastAPI layer can return the right status code."""

    def __init__(self, message: str, failure_kind: str = "runtime_error") -> None:
        super().__init__(message)
        self.failure_kind = failure_kind


class _GeminiCompatForbidden(Exception):
    """Internal: sentinel for switching from Gemini compat to native."""

    def __init__(self, response: httpx.Response) -> None:
        self.response = response
        super().__init__(f"Gemini compat 403: {response.text[:200]}")


class _TruncatedOutput(Exception):
    """Internal: provider stopped because the output token cap was reached."""

    def __init__(self, provider: str, finish_reason: str | None, content: str) -> None:
        self.provider = provider
        self.finish_reason = finish_reason
        self.content = content
        super().__init__(
            f"{provider} returned truncated output "
            f"(finish_reason={finish_reason!r}, content_len={len(content)})"
        )


_STOP_FINISH_REASONS = {"stop", "end_turn", "STOP", "FINISH_REASON_STOP"}
_TRUNCATED_FINISH_REASONS = {
    "length",
    "max_tokens",
    "MAX_TOKENS",
    "FINISH_REASON_MAX_TOKENS",
}


def _is_truncated_finish_reason(finish_reason: str | None) -> bool:
    if not finish_reason:
        return False
    return finish_reason in _TRUNCATED_FINISH_REASONS or finish_reason.lower() in {
        "length",
        "max_tokens",
        "max_output_tokens",
    }


def _is_stop_finish_reason(finish_reason: str | None) -> bool:
    if not finish_reason:
        return True
    return finish_reason in _STOP_FINISH_REASONS or finish_reason.lower() in {"stop", "end_turn"}


# ---------------------------------------------------------------------------
# Provider config
# ---------------------------------------------------------------------------


class ProviderConfig:
    """Resolved config for one OpenAI-compatible provider."""

    def __init__(
        self,
        *,
        name: str,
        base_url: str,
        model: str,
        api_key: str,
        supports_json_mode: bool = True,
        native_ollama: bool = False,
    ) -> None:
        self.name = name
        self.base_url = base_url
        self.model = model
        self.api_key = api_key
        self.supports_json_mode = supports_json_mode
        self.native_ollama = native_ollama


def _local_config() -> ProviderConfig | None:
    url = os.environ.get("LLM_URL", "").strip()
    if not url:
        return None
    provider_name = os.environ.get("LLM_PROVIDER_NAME", "local")
    native_ollama = (
        os.environ.get("LLM_PROVIDER_NAME", "").lower() == "ollama"
        or "127.0.0.1:11434" in url
        or "localhost:11434" in url
    )
    return ProviderConfig(
        name=provider_name,
        base_url=url.rstrip("/"),
        model=os.environ.get("LLM_MODEL", "local-model"),
        api_key=os.environ.get("LLM_API_KEY", "").strip(),
        # Ollama and many OpenAI-compatible servers reject OpenAI's
        # response_format JSON mode. The prompts still require JSON, and the
        # task layer has robust extraction/fallbacks.
        supports_json_mode=os.environ.get("LLM_JSON_MODE", "").lower()
        in ("1", "true", "yes", "on"),
        native_ollama=native_ollama,
    )


def _gemini_config() -> ProviderConfig | None:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        return None
    return ProviderConfig(
        name="gemini",
        base_url=_GEMINI_COMPAT_BASE,
        model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
        api_key=key,
    )


def _openai_config() -> ProviderConfig | None:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        return None
    return ProviderConfig(
        name="openai",
        base_url=_OPENAI_BASE,
        model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        api_key=key,
    )


def _provider_configs() -> list[ProviderConfig]:
    return [cfg for cfg in (_local_config(), _gemini_config(), _openai_config()) if cfg]


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class LLMClient:
    """Single provider client. Use `chat()` for a synchronous call.

    This is intentionally synchronous -- FastAPI routes that need async
    just wrap calls in `run_in_executor`. Keeping the LLM client simple
    matches the pattern in ApplyPilot and avoids httpx async semantics
    churn for what's essentially a single POST per call.
    """

    def __init__(self, config: ProviderConfig) -> None:
        self.config = config
        self._client = httpx.Client(timeout=_TIMEOUT_SECS)
        # Flips to true once we've confirmed the Gemini native API works
        # for this model. Sticky for the process lifetime to avoid the
        # compat->native round-trip on every call.
        self._use_native_gemini = False
        self._is_gemini = config.base_url.startswith(_GEMINI_COMPAT_BASE)

    # -- Gemini native ------------------------------------------------------

    def _chat_gemini_native(
        self,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
        response_format: str | None,
    ) -> str:
        """Call Gemini's native generateContent API. Used as fallback when
        the OpenAI-compat endpoint returns 403 for a given model."""
        contents: list[dict[str, Any]] = []
        system_parts: list[dict[str, str]] = []

        for msg in messages:
            role = msg["role"]
            text = msg.get("content", "")
            if role == "system":
                system_parts.append({"text": text})
            elif role == "user":
                contents.append({"role": "user", "parts": [{"text": text}]})
            elif role == "assistant":
                # Gemini uses "model" for the assistant role.
                contents.append({"role": "model", "parts": [{"text": text}]})

        gen_config: dict[str, Any] = {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        }
        if response_format == "json":
            gen_config["responseMimeType"] = "application/json"

        payload: dict[str, Any] = {"contents": contents, "generationConfig": gen_config}
        if system_parts:
            payload["systemInstruction"] = {"parts": system_parts}

        url = f"{_GEMINI_NATIVE_BASE}/models/{self.config.model}:generateContent"
        resp = self._client.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            params={"key": self.config.api_key},
        )
        resp.raise_for_status()
        data = resp.json()
        try:
            candidate = data["candidates"][0]
            finish_reason = candidate.get("finishReason")
            content = candidate["content"]["parts"][0]["text"]
            if _is_truncated_finish_reason(finish_reason):
                raise _TruncatedOutput(self.config.name, finish_reason, content)
            if not _is_stop_finish_reason(finish_reason):
                log.warning(
                    "%s native finish_reason=%r content_len=%d; output may be incomplete",
                    self.config.name,
                    finish_reason,
                    len(content),
                )
            return content
        except (KeyError, IndexError) as exc:
            raise LLMError(
                f"Gemini native returned unexpected shape: {str(data)[:200]}",
                failure_kind="invalid_response",
            ) from exc

    # -- OpenAI / Gemini compat --------------------------------------------

    def _chat_compat(
        self,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
        response_format: str | None,
    ) -> str:
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        payload: dict[str, Any] = {
            "model": self.config.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format == "json" and self.config.supports_json_mode:
            payload["response_format"] = {"type": "json_object"}

        resp = self._client.post(
            f"{self.config.base_url}/chat/completions",
            json=payload,
            headers=headers,
        )

        # Gemini OpenAI-compat layer sometimes rejects preview/experimental
        # models with 403 even though the native API accepts them.
        if resp.status_code == 403 and self._is_gemini:
            raise _GeminiCompatForbidden(resp)

        resp.raise_for_status()
        data = resp.json()
        try:
            choice = data["choices"][0]
            content = choice["message"]["content"]
            finish_reason = choice.get("finish_reason")
            if _is_truncated_finish_reason(finish_reason):
                raise _TruncatedOutput(self.config.name, finish_reason, content)
            if not _is_stop_finish_reason(finish_reason):
                log.warning(
                    "%s finish_reason=%r content_len=%d; output may be incomplete",
                    self.config.name,
                    finish_reason,
                    len(content),
                )
            return content
        except (KeyError, IndexError) as exc:
            raise LLMError(
                f"{self.config.name} returned unexpected shape: {str(data)[:200]}",
                failure_kind="invalid_response",
            ) from exc

    # -- Ollama native ------------------------------------------------------

    def _chat_ollama_native(
        self,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
        response_format: str | None,
    ) -> str:
        prompt_parts: list[str] = []
        for msg in messages:
            role = msg.get("role", "user").upper()
            content = msg.get("content", "")
            if content:
                prompt_parts.append(f"{role}:\n{content}")

        base_url = self.config.base_url.removesuffix("/v1").rstrip("/")
        payload: dict[str, Any] = {
            "model": self.config.model,
            "prompt": "\n\n".join(prompt_parts),
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        if response_format == "json":
            payload["format"] = "json"

        resp = self._client.post(
            f"{base_url}/api/generate",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()

        content = data.get("response")
        if not content and isinstance(data.get("thinking"), str):
            # Some small Qwen/Gemma-thinking builds emit JSON under
            # `thinking` while leaving `response` empty when format=json.
            content = data["thinking"]
        if not isinstance(content, str):
            raise LLMError(
                f"{self.config.name} returned unexpected Ollama shape: {str(data)[:200]}",
                failure_kind="invalid_response",
            )

        finish_reason = data.get("done_reason")
        if _is_truncated_finish_reason(finish_reason):
            raise _TruncatedOutput(self.config.name, finish_reason, content)
        return content

    # -- Public API --------------------------------------------------------

    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.1,
        max_tokens: int = 1500,
        response_format: str | None = None,  # None | "json"
    ) -> str:
        """Send a chat completion and return the assistant text.

        Retries on 429/503 with exponential backoff (respecting Retry-After).
        Raises LLMError with a failure_kind the API layer can map to HTTP.
        """
        last_error: Exception | None = None

        for attempt in range(_MAX_RETRIES):
            try:
                if self.config.native_ollama:
                    return self._chat_ollama_native(
                        messages, temperature, max_tokens, response_format
                    )
                if self._use_native_gemini:
                    return self._chat_gemini_native(messages, temperature, max_tokens, response_format)
                return self._chat_compat(messages, temperature, max_tokens, response_format)

            except _GeminiCompatForbidden:
                log.warning(
                    "Gemini compat returned 403 for model %r -- switching to native.",
                    self.config.model,
                )
                self._use_native_gemini = True
                # Retry immediately on native -- don't consume an attempt.
                try:
                    return self._chat_gemini_native(
                        messages, temperature, max_tokens, response_format
                    )
                except _TruncatedOutput as native_exc:
                    raise LLMError(
                        f"{native_exc.provider} returned truncated output on native retry",
                        failure_kind="truncated_output",
                    ) from native_exc
                except httpx.HTTPStatusError as native_exc:
                    raise LLMError(
                        f"Both Gemini endpoints failed. Native returned "
                        f"{native_exc.response.status_code}: {native_exc.response.text[:200]}",
                        failure_kind="runtime_error",
                    ) from native_exc

            except _TruncatedOutput as exc:
                last_error = exc
                if self._is_gemini and response_format == "json" and not self._use_native_gemini:
                    log.warning(
                        "Gemini compat returned truncated JSON (%s); retrying once on native.",
                        exc.finish_reason,
                    )
                    self._use_native_gemini = True
                    try:
                        return self._chat_gemini_native(
                            messages, temperature, max_tokens, response_format
                        )
                    except _TruncatedOutput as native_exc:
                        raise LLMError(
                            f"{native_exc.provider} returned truncated output after native retry",
                            failure_kind="truncated_output",
                        ) from native_exc
                    except httpx.HTTPStatusError as native_http_exc:
                        raise LLMError(
                            f"Gemini native returned {native_http_exc.response.status_code}: "
                            f"{native_http_exc.response.text[:200]}",
                            failure_kind="runtime_error",
                        ) from native_http_exc
                raise LLMError(str(exc), failure_kind="truncated_output") from exc

            except httpx.HTTPStatusError as exc:
                resp = exc.response
                last_error = exc
                status = resp.status_code

                if status in (429, 503) and attempt < _MAX_RETRIES - 1:
                    retry_after = resp.headers.get("Retry-After")
                    if retry_after:
                        try:
                            wait = float(retry_after)
                        except (ValueError, TypeError):
                            wait = _RATE_LIMIT_BASE_WAIT * (2**attempt)
                    else:
                        wait = min(_RATE_LIMIT_BASE_WAIT * (2**attempt), _RATE_LIMIT_MAX_WAIT)
                    log.warning(
                        "%s rate-limited (HTTP %d). Waiting %.1fs before retry %d/%d.",
                        self.config.name,
                        status,
                        wait,
                        attempt + 1,
                        _MAX_RETRIES,
                    )
                    time.sleep(wait)
                    continue

                # Map auth / quota / other to explicit failure kinds.
                if status in (401, 403):
                    raise LLMError(
                        f"{self.config.name} auth failed ({status}): {resp.text[:200]}",
                        failure_kind="auth_error",
                    ) from exc
                if status in (429, 503):
                    raise LLMError(
                        f"{self.config.name} rate-limited after {_MAX_RETRIES} retries",
                        failure_kind="rate_limited",
                    ) from exc
                raise LLMError(
                    f"{self.config.name} returned {status}: {resp.text[:200]}",
                    failure_kind="runtime_error",
                ) from exc

            except httpx.TimeoutException as exc:
                last_error = exc
                if attempt < _MAX_RETRIES - 1:
                    wait = min(_RATE_LIMIT_BASE_WAIT * (2**attempt), _RATE_LIMIT_MAX_WAIT)
                    log.warning(
                        "%s timed out; retrying in %.1fs (%d/%d).",
                        self.config.name,
                        wait,
                        attempt + 1,
                        _MAX_RETRIES,
                    )
                    time.sleep(wait)
                    continue
                raise LLMError(
                    f"{self.config.name} timed out after {_MAX_RETRIES} retries",
                    failure_kind="timeout",
                ) from exc

        # Shouldn't reach here -- the loop raises -- but keep the signature honest.
        raise LLMError(
            f"{self.config.name} failed: {last_error}",
            failure_kind="runtime_error",
        )

    def close(self) -> None:
        self._client.close()


# ---------------------------------------------------------------------------
# High-level chat() with automatic provider fallback
# ---------------------------------------------------------------------------


class CallResult:
    """Result of a chat call. Mirrors the TS AICallResult<T> shape."""

    def __init__(
        self,
        *,
        success: bool,
        text: str | None = None,
        error: str | None = None,
        model: str | None = None,
        provider: str | None = None,
        duration_ms: int = 0,
        fallback_used: bool = False,
        failure_kind: str | None = None,
    ) -> None:
        self.success = success
        self.text = text
        self.error = error
        self.model = model
        self.provider = provider
        self.duration_ms = duration_ms
        self.fallback_used = fallback_used
        self.failure_kind = failure_kind


def chat(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.1,
    max_tokens: int = 1500,
    response_format: str | None = None,
) -> CallResult:
    """Chat with automatic provider fallback on persistent failure.

    Provider order is local OpenAI-compatible endpoint, then Gemini, then
    OpenAI. Auth errors don't trigger fallback (they need user intervention).
    Timeouts don't trigger fallback (the LLM client already retried).
    """
    attempts = _provider_configs()

    if not attempts:
        return CallResult(
            success=False,
            error="No LLM provider configured. Set LLM_URL, GEMINI_API_KEY, or OPENAI_API_KEY.",
            failure_kind="not_configured",
        )

    last_error: LLMError | None = None
    for idx, cfg in enumerate(attempts):
        client = LLMClient(cfg)
        try:
            started = time.time()
            text = client.chat(
                messages,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
            )
            duration_ms = int((time.time() - started) * 1000)
            return CallResult(
                success=True,
                text=text,
                model=cfg.model,
                provider=cfg.name,
                duration_ms=duration_ms,
                fallback_used=idx > 0,
            )
        except LLMError as exc:
            last_error = exc
            # Don't attempt fallback on auth errors -- they're user config bugs.
            if exc.failure_kind == "auth_error":
                break
            if idx + 1 < len(attempts):
                log.warning(
                    "%s failed (%s). Falling back to %s.",
                    cfg.name,
                    exc.failure_kind,
                    attempts[idx + 1].name,
                )
                continue
        finally:
            client.close()

    assert last_error is not None
    return CallResult(
        success=False,
        error=str(last_error),
        failure_kind=last_error.failure_kind,
    )
