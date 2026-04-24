// ============================================================
// Python AI sidecar proxy.
// When PYTHON_AI_URL is set AND USE_PYTHON_AI=true, selected AI
// tasks delegate to the Python FastAPI service instead of running
// the local TS implementation. See python-ai/README.md.
//
// This is a feature flag so we can run TS and Python side by side
// during the migration and compare outputs before flipping over.
// ============================================================

export function isPythonAIEnabled(): boolean {
  const flag = (process.env.USE_PYTHON_AI || "").toLowerCase();
  const url = (process.env.PYTHON_AI_URL || "").trim();
  return url.length > 0 && (flag === "1" || flag === "true" || flag === "yes");
}

export function pythonAIBaseUrl(): string | null {
  const url = (process.env.PYTHON_AI_URL || "").trim();
  return url.length > 0 ? url.replace(/\/+$/, "") : null;
}

type CachedIdentityToken = {
  audience: string;
  token: string;
  expiresAtMs: number;
};

let cachedIdentityToken: CachedIdentityToken | null = null;

function shouldUseGoogleIdentityToken(baseUrl: string): boolean {
  const mode = (process.env.PYTHON_AI_AUTH || "auto").toLowerCase();
  if (mode === "none" || mode === "off" || mode === "false") {
    return false;
  }
  if (mode === "google" || mode === "google-identity") {
    return true;
  }

  // Auto mode: local dev stays unauthenticated; Cloud Run-to-Cloud Run calls
  // to a run.app sidecar get an identity token.
  return Boolean(process.env.K_SERVICE) && baseUrl.includes(".run.app");
}

function decodeJwtExpiry(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }

  try {
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const decoded = JSON.parse(json) as { exp?: unknown };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function getGoogleIdentityToken(audience: string): Promise<string> {
  const now = Date.now();
  if (
    cachedIdentityToken?.audience === audience &&
    cachedIdentityToken.expiresAtMs > now + 60_000
  ) {
    return cachedIdentityToken.token;
  }

  const metadataUrl =
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity" +
    `?audience=${encodeURIComponent(audience)}`;

  const response = await fetch(metadataUrl, {
    headers: { "Metadata-Flavor": "Google" },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "unknown");
    throw new Error(`Google metadata identity token failed (${response.status}): ${text}`);
  }

  const token = await response.text();
  cachedIdentityToken = {
    audience,
    token,
    expiresAtMs: decodeJwtExpiry(token) ?? now + 50 * 60_000,
  };
  return token;
}

/**
 * POST a JSON body to the Python sidecar. Returns the parsed JSON body
 * on success OR throws with a useful message. Timeout is explicit --
 * the Python service does its own retries internally so we don't need
 * client-side retries here.
 */
export async function callPythonAI<TRequest, TResponse>(
  path: string,
  body: TRequest,
  timeoutMs = 90_000
): Promise<TResponse> {
  const base = pythonAIBaseUrl();
  if (!base) {
    throw new Error("Python AI sidecar is not configured (PYTHON_AI_URL missing)");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (shouldUseGoogleIdentityToken(base)) {
      headers.Authorization = `Bearer ${await getGoogleIdentityToken(base)}`;
    }

    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown");
      throw new Error(
        `Python AI returned ${response.status}: ${text.slice(0, 300)}`
      );
    }

    return (await response.json()) as TResponse;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Python AI request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
