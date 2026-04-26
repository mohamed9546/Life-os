import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/session";
import { getAiTelemetryEvents, getAiTelemetrySummary } from "@/lib/ai/telemetry";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser();
    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? Math.max(1, Math.min(200, parseInt(limitRaw, 10) || 50)) : 50;

    const [summary, recentEvents] = await Promise.all([
      getAiTelemetrySummary(),
      getAiTelemetryEvents({ limit }),
    ]);

    return NextResponse.json({ ok: true, summary, recentEvents });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to load AI telemetry",
      },
      { status: err instanceof Error && err.message === "Forbidden" ? 403 : 500 }
    );
  }
}
