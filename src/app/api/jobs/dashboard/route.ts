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

    return NextResponse.json({
      inbox,
      ranked,
      rejected,
      tracked: enriched.filter((job) => job.status === "tracked"),
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
