import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import {
  getInboxJobs,
  getJobStats,
  getRankedJobs,
  getRejectedJobs,
  getEnrichedJobs,
} from "@/lib/jobs/storage";
import { getAdapterConfigStatus, getAllAdapters } from "@/lib/jobs/sources";
import { getEnabledUserSourceIds } from "@/lib/career/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();

    const [
      inbox,
      ranked,
      rejected,
      enriched,
      stats,
      adapterConfigStatus,
      allAdapters,
      enabledSourceIds,
    ] = await Promise.all([
      getInboxJobs(user.id),
      getRankedJobs(user.id),
      getRejectedJobs(user.id),
      getEnrichedJobs(user.id),
      getJobStats(user.id),
      getAdapterConfigStatus(),
      Promise.resolve(getAllAdapters()),
      getEnabledUserSourceIds(user.id, user.email),
    ]);

    const configuredSourceIds = new Set(
      adapterConfigStatus
        .filter((adapter) => adapter.configured)
        .map((adapter) => adapter.sourceId)
    );

    // `tracked` carries everything in the pipeline (not just status==="tracked")
    // so the career dashboard KPIs for Applied / Interviews / Offer / Shortlisted
    // can count them directly. Rejected stays in `jobs.rejected`; inbox stays in
    // `jobs.inbox`; everything else in flight lives here.
    const trackedStages = new Set([
      "shortlisted",
      "tracked",
      "applied",
      "interview",
      "offer",
      "archived",
    ]);

    return NextResponse.json({
      inbox,
      ranked,
      rejected,
      tracked: enriched.filter((job) => trackedStages.has(job.status)),
      stats,
      sources: allAdapters.map((adapter) => ({
        id: adapter.sourceId,
        name: adapter.displayName,
        enabled: enabledSourceIds.includes(adapter.sourceId),
        configured: configuredSourceIds.has(adapter.sourceId),
        active: enabledSourceIds.includes(adapter.sourceId) && configuredSourceIds.has(adapter.sourceId),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load jobs dashboard" },
      { status: 500 }
    );
  }
}
