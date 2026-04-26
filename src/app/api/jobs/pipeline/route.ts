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
  getPipelineRun,
  updatePipelineRun,
} from "@/lib/jobs/pipeline/runs";
import { requireAppUser } from "@/lib/auth/session";
import {
  getEnabledUserSearchQueries,
  getEnabledUserSourceIds,
} from "@/lib/career/settings";
import { isLocalOnlyMode } from "@/lib/env/local-only";
import { syncAllJobsToNotionBestEffort } from "@/lib/integrations/notion-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

const activeRuns = new Set<string>();
const activeRecommendationRuns = new Set<string>();

function shouldRunPipelineInline(): boolean {
  return isLocalOnlyMode() || process.env.NODE_ENV !== "production";
}

function optimizeLocalPipelineOptions<T extends {
  sources?: string[];
  queries?: Array<unknown>;
  maxEnrich?: number;
}>(options: T): T {
  if (!shouldRunPipelineInline()) {
    return options;
  }

  return {
    ...options,
    sources: options.sources?.slice(0, 4),
    queries: options.queries?.slice(0, 6),
    maxEnrich:
      typeof options.maxEnrich === "number"
        ? Math.min(options.maxEnrich, 8)
        : 8,
  };
}

async function queueRecommendationPipeline(
  userId: string,
  userEmail: string,
  runId: string,
  skipRank?: boolean
) {
  if (skipRank || activeRecommendationRuns.has(runId)) {
    return;
  }

  activeRecommendationRuns.add(runId);
  void (async () => {
    try {
      const recommendationPipeline = await runAutoApplyPipelineForUser(userId, userEmail, {
        skipDiscovery: true,
      });
      const run = await getPipelineRun(userId, runId);
      if (!run?.result) {
        return;
      }

      await updatePipelineRun(userId, runId, {
        result: {
          ...run.result,
          recommendationPipeline,
        },
      });
    } catch (recommendationErr) {
      console.warn(
        "[api/jobs/pipeline] Recommendation pipeline failed after main pipeline:",
        recommendationErr
      );
    } finally {
      activeRecommendationRuns.delete(runId);
    }
  })();
}

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
      await updatePipelineRun(userId, runId, {
        status: "completed",
        result,
        completedAt: new Date().toISOString(),
      });
      await syncAllJobsToNotionBestEffort(userId);
      await queueRecommendationPipeline(userId, userEmail, runId, run.options.skipRank);
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
      includeGmailAlerts: true,
      gmailMaxMessages: 25,
    };
    const run = await createPipelineRun(user.id, options);

    if (shouldRunPipelineInline()) {
      try {
        const optimizedOptions = optimizeLocalPipelineOptions(options);
        const result = await runFullPipeline(optimizedOptions);
        await updatePipelineRun(user.id, run.id, {
          status: "completed",
          result,
          completedAt: new Date().toISOString(),
        });
        await syncAllJobsToNotionBestEffort(user.id);
        await queueRecommendationPipeline(
          user.id,
          user.email,
          run.id,
          optimizedOptions.skipRank
        );
        return NextResponse.json({
          success: true,
          runId: run.id,
          status: "completed",
          result,
        });
      } catch (err) {
        await updatePipelineRun(user.id, run.id, {
          status: "failed",
          error: err instanceof Error ? err.message : "Pipeline failed",
          completedAt: new Date().toISOString(),
        });
        throw err;
      }
    }

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
