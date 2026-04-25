import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { runApplicationForJob } from "@/lib/applications/auto-apply";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const body = (await request.json()) as {
      jobId?: string;
      skipBrowser?: boolean;
    };
    if (!body.jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const log = await runApplicationForJob(user.id, user.email, body.jobId, {
      skipBrowser: Boolean(body.skipBrowser),
    });
    return NextResponse.json({ success: true, log });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Application run failed",
      },
      { status: 500 }
    );
  }
}
