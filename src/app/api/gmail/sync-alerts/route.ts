import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { syncGmailJobAlerts } from "@/lib/applications/gmail";
import { filterFetchedJobs } from "@/lib/jobs/pipeline";
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
    const filteredJobs = filterFetchedJobs(result.jobs);
    const sourceBreakdown = Array.from(
      filteredJobs.reduce((counts, job) => {
        counts.set(job.source, (counts.get(job.source) || 0) + 1);
        return counts;
      }, new Map<string, number>())
    )
      .map(([source, count]) => ({ source, count }))
      .sort((left, right) => right.count - left.count || left.source.localeCompare(right.source));

    if (filteredJobs.length > 0) {
      await saveRawJobs(filteredJobs, user.id);
    }

    return NextResponse.json({
      success: !result.error,
      ...result,
      jobs: filteredJobs,
      imported: filteredJobs.length,
      sourceBreakdown,
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
