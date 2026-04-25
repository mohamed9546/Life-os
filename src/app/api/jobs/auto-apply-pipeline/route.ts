import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { runAutoApplyPipelineForUser } from "@/lib/applications/auto-apply";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const body = await request.json().catch(() => ({}));
    const result = await runAutoApplyPipelineForUser(user.id, user.email, {
      maxApplications:
        typeof body.maxApplications === "number" ? body.maxApplications : undefined,
      skipBrowser: Boolean(body.skipBrowser),
      skipDiscovery: Boolean(body.skipDiscovery),
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
