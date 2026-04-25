// ============================================================
// POST /api/jobs/pipeline
// Run the full job pipeline: fetch → dedupe → enrich → rank → store
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { runFullPipeline } from "@/lib/jobs/pipeline";
import { runAutoApplyPipelineForUser } from "@/lib/applications/auto-apply";
import {
  createPipelineRun,
  getActivePipelineRun,
  updatePipelineRun,
} from "@/lib/jobs/pipeline/runs";
import { requireAppUser } from "@/lib/auth/session";
import {
  getEnabledUserSearchQueries,
  getEnabledUserSourceIds,
} from "@/lib/career/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

const activeRuns = new Set<string>();

function executePipelineRun(userId: string, userEmail: string, runId: string) {
  if (activeRuns.has(runId)) {
    return;
  }

  activeRuns.add(runId);
  void (async () => {
    try {
      const run = await getActivePipelineRun(userId);
      if (!run || run.id !== runId) {
        return;
      }

      const result = await runFullPipeline(run.options);
      let recommendationPipeline;
      if (!run.options.skipRank) {
        try {
          recommendationPipeline = await runAutoApplyPipelineForUser(userId, userEmail, {
            skipDiscovery: true,
          });
        } catch (recommendationErr) {
          console.warn(
            "[api/jobs/pipeline] Recommendation pipeline failed after main pipeline:",
            recommendationErr
          );
        }
      }
      await updatePipelineRun(userId, runId, {
        status: "completed",
        result: recommendationPipeline
          ? { ...result, recommendationPipeline }
          : result,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[api/jobs/pipeline] Background run failed:", err);
      await updatePipelineRun(userId, runId, {
        status: "failed",
        error: err instanceof Error ? err.message : "Pipeline failed",
        completedAt: new Date().toISOString(),
      });
    } finally {
      activeRuns.delete(runId);
    }
  })();
}

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

    const activeRun = await getActivePipelineRun(user.id);
    if (activeRun) {
      executePipelineRun(user.id, user.email, activeRun.id);
      return NextResponse.json({
        success: true,
        runId: activeRun.id,
        status: activeRun.status,
        result: activeRun.result,
        error: activeRun.error,
      });
    }

    const [defaultQueries, defaultSources] = await Promise.all([
      getEnabledUserSearchQueries(user.id, user.email),
      getEnabledUserSourceIds(user.id, user.email),
    ]);

    const options = {
      userId: user.id,
      sources: sources && sources.length > 0 ? sources : defaultSources,
      queries: defaultQueries,
      maxEnrich,
      skipEnrich,
      skipRank,
    };
    const run = await createPipelineRun(user.id, options);
    executePipelineRun(user.id, user.email, run.id);

    return NextResponse.json({
      success: true,
      runId: run.id,
      status: run.status,
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
