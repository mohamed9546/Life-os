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
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
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
