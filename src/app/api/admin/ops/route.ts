import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/session";
import { checkAIHealth } from "@/lib/ai/client";
import { getAIUsageStats, loadAIConfig } from "@/lib/ai";
import { checkApolloHealth } from "@/lib/enrichment";
import { getAdapterConfigStatus } from "@/lib/jobs/sources";
import {
  buildDisplayTaskState,
  checkTaskPolicy,
  getAllTaskConfigs,
  getAllTaskStates,
  getFetchTaskIdForSource,
  listWorkerRuns,
} from "@/lib/worker";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();

    const [aiHealth, aiUsage, aiConfig, apolloHealth, taskConfigs, taskStates, sources, recentRuns] =
      await Promise.all([
        checkAIHealth(),
        getAIUsageStats(),
        loadAIConfig(),
        checkApolloHealth(),
        getAllTaskConfigs(),
        getAllTaskStates(),
        getAdapterConfigStatus(),
        listWorkerRuns(20),
      ]);

    const tasks = taskConfigs.map((config) => {
      const state = taskStates.find((candidate) => candidate.taskId === config.id);
      const displayState = buildDisplayTaskState(config, state);
      const policy = checkTaskPolicy(config, displayState);

      return {
        ...config,
        state: displayState,
        policyAllowed: policy.allowed,
        policyReason: policy.reason,
        recentRun:
          recentRuns.find((run) => run.taskId === config.id) || null,
      };
    });

    return NextResponse.json({
      aiHealth,
      aiUsage,
      aiConfig,
      apolloHealth,
      tasks,
      sources: sources.map((source) => {
        const taskId = getFetchTaskIdForSource(source.sourceId);
        const config = taskId
          ? taskConfigs.find((candidate) => candidate.id === taskId) || null
          : null;
        const state = taskId
          ? taskStates.find((candidate) => candidate.taskId === taskId) || null
          : null;
        return {
          ...source,
          taskId,
          state: config ? buildDisplayTaskState(config, state) : state,
          recentRun: taskId
            ? recentRuns.find((run) => run.taskId === taskId) || null
            : null,
        };
      }),
      recentRuns,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Forbidden" },
      { status: 403 }
    );
  }
}
