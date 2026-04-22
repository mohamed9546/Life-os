import { NextResponse } from "next/server";
import { loadAIConfig } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await loadAIConfig();
    if (!config.enabled) {
      return NextResponse.json({ status: "offline", model: config.model, reason: "disabled" });
    }

    const baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:11434");
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3_500),
    });

    if (!res.ok) {
      return NextResponse.json({ status: "offline", model: config.model, reason: `ollama ${res.status}` });
    }

    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const available = data.models?.map((m) => m.name) ?? [];
    const primaryAvailable = available.some((n) => n.startsWith(config.model.split(":")[0]));
    const fallback = config.fallbackModel;
    const fallbackAvailable = fallback
      ? available.some((n) => n.startsWith(fallback.split(":")[0]))
      : false;

    if (primaryAvailable) {
      return NextResponse.json({ status: "ok", model: config.model, available });
    }
    if (fallbackAvailable) {
      return NextResponse.json({
        status: "degraded",
        model: fallback,
        reason: `primary (${config.model}) not found — running fallback`,
        available,
      });
    }

    return NextResponse.json({
      status: "offline",
      model: config.model,
      reason: "no matching model loaded in Ollama",
      available,
    });
  } catch {
    return NextResponse.json({ status: "offline", model: "unknown", reason: "unreachable" });
  }
}
