// ============================================================
// POST /api/jobs/pipeline
// Run the full job pipeline: fetch → dedupe → enrich → rank → store
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { runFullPipeline } from "@/lib/jobs/pipeline";
import { requireAppUser } from "@/lib/auth/session";
import {
  getEnabledUserSearchQueries,
  getEnabledUserSourceIds,
} from "@/lib/career/settings";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const body = await request.json().catch(() => ({}));
    const { sources, maxEnrich, skipEnrich, skipRank } = body as {
      sources?: string[];
      maxEnrich?: number;
      skipEnrich?: boolean;
      skipRank?: boolean;
    };

    console.log("[api/jobs/pipeline] Starting pipeline...");

    const [defaultQueries, defaultSources] = await Promise.all([
      getEnabledUserSearchQueries(user.id, user.email),
      getEnabledUserSourceIds(user.id, user.email),
    ]);

    const result = await runFullPipeline({
      userId: user.id,
      sources: sources && sources.length > 0 ? sources : defaultSources,
      queries: defaultQueries,
      maxEnrich,
      skipEnrich,
      skipRank,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("[api/jobs/pipeline] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Pipeline failed",
      },
      { status: 500 }
    );
  }
}
