import { NextRequest, NextResponse } from "next/server";
import { runAutoApplyPipeline } from "@/lib/applications/auto-apply";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runAutoApplyPipeline({
      maxApplications:
        typeof body.maxApplications === "number" ? body.maxApplications : undefined,
      skipBrowser: Boolean(body.skipBrowser),
    });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Auto-apply pipeline failed",
      },
      { status: 500 }
    );
  }
}
