import { NextResponse } from "next/server";
import { checkAIHealth } from "@/lib/ai/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await checkAIHealth();

    if (health.available) {
      return NextResponse.json({ status: "ok", model: health.primaryModel });
    }

    // Treat a reachable-but-model-missing response as degraded
    if (health.availableModels.length > 0) {
      return NextResponse.json({ status: "degraded", model: health.primaryModel, reason: health.error });
    }

    return NextResponse.json({ status: "offline", model: health.primaryModel, reason: health.error });
  } catch {
    return NextResponse.json({ status: "offline", model: "", reason: "unreachable" });
  }
}
