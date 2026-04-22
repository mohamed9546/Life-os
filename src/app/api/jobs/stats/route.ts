// ============================================================
// GET /api/jobs/stats
// Get job pipeline statistics across all collections.
// ============================================================

import { NextResponse } from "next/server";
import { getJobStats } from "@/lib/jobs/storage";
import { getActiveAdapters, getAllAdapters } from "@/lib/jobs/sources";
import { getEnabledUserSourceIds } from "@/lib/career/settings";
import { requireAppUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();
    const [stats, activeAdapters, allAdapters, enabledSourceIds] = await Promise.all([
      getJobStats(user.id),
      getActiveAdapters(),
      Promise.resolve(getAllAdapters()),
      getEnabledUserSourceIds(user.id, user.email),
    ]);

    const adapterStates = allAdapters.map((a) => ({
      id: a.sourceId,
      name: a.displayName,
      active:
        enabledSourceIds.includes(a.sourceId) &&
        activeAdapters.some((aa) => aa.sourceId === a.sourceId),
    }));

    return NextResponse.json({
      collections: stats,
      sources: {
        total: allAdapters.length,
        active: adapterStates.filter((adapter) => adapter.active).length,
        adapters: adapterStates,
      },
    });
  } catch (err) {
    console.error("[api/jobs/stats] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stats failed" },
      { status: 500 }
    );
  }
}
