import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import {
  getLatestPipelineRun,
  getPipelineRun,
} from "@/lib/jobs/pipeline/runs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const runId = request.nextUrl.searchParams.get("runId");
    const run = runId
      ? await getPipelineRun(user.id, runId)
      : await getLatestPipelineRun(user.id);

    if (!run) {
      return NextResponse.json(
        { success: false, error: "Pipeline run not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      runId: run.id,
      status: run.status,
      result: run.result,
      error: run.error,
      startedAt: run.startedAt,
      updatedAt: run.updatedAt,
      completedAt: run.completedAt,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to load pipeline status",
      },
      { status: 500 }
    );
  }
}
