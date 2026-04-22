// ============================================================
// POST /api/jobs/fetch
// Fetch jobs from a single source for the authenticated user.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchFromSource } from "@/lib/jobs/pipeline";
import { requireAppUser } from "@/lib/auth/session";
import { getEnabledUserSearchQueries, getEnabledUserSourceIds } from "@/lib/career/settings";
import { saveRawJobs } from "@/lib/jobs/storage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const body = await request.json().catch(() => ({}));
    const { source } = body as { source?: string };

    if (!source) {
      return NextResponse.json(
        { error: "source is required" },
        { status: 400 }
      );
    }

    const [enabledSources, queries] = await Promise.all([
      getEnabledUserSourceIds(user.id, user.email),
      getEnabledUserSearchQueries(user.id, user.email),
    ]);

    if (!enabledSources.includes(source)) {
      return NextResponse.json(
        { error: `Source "${source}" is not enabled for this account` },
        { status: 400 }
      );
    }

    const { jobs, result } = await fetchFromSource(source, queries);

    if (jobs.length > 0) {
      await saveRawJobs(jobs, user.id);
    }

    return NextResponse.json({
      success: true,
      result,
      jobsFetched: jobs.length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Fetch failed",
      },
      { status: 500 }
    );
  }
}
