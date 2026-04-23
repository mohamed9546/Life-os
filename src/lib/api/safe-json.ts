export interface ApiErrorPayload {
  error?: string;
  success?: boolean;
}

function summarizeBody(status: number, text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ");

  if (/^<!doctype html/i.test(normalized) || /^<html/i.test(normalized)) {
    return `Server returned an HTML error page instead of JSON (HTTP ${status}).`;
  }

  if (/upstream|timeout|gateway/i.test(normalized)) {
    return "Pipeline timed out before the server finished. The run may still be continuing in the background.";
  }

  if (!normalized) {
    return `Server returned an empty response (HTTP ${status}).`;
  }

  return `Server returned invalid JSON (HTTP ${status}): ${normalized.slice(0, 160)}`;
}

export async function readJsonResponse<T extends ApiErrorPayload>(
  response: Response
): Promise<T> {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(summarizeBody(response.status, text));
  }

  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new Error(summarizeBody(response.status, text));
  }
}

export async function assertJsonOk<T extends ApiErrorPayload>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  const payload = await readJsonResponse<T>(response);
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `${fallbackMessage} (${response.status})`);
  }
  return payload;
}
