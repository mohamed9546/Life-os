import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { syncGmailJobAlerts } from "@/lib/applications/gmail";
import { saveRawJobs } from "@/lib/jobs/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const body = await request.json().catch(() => ({}));
    const result = await syncGmailJobAlerts(user.id, {
      maxMessages:
        typeof body.maxMessages === "number" ? body.maxMessages : undefined,
    });

    if (result.jobs.length > 0) {
      await saveRawJobs(result.jobs, user.id);
    }

    return NextResponse.json({
      success: !result.error,
      ...result,
      imported: result.jobs.length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Gmail sync failed",
      },
      { status: 500 }
    );
  }
}
