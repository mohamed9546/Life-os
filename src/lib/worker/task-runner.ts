// ============================================================
// Worker task runner.
// Executes tasks with policy enforcement: rate limits,
// cooldowns, consecutive failure tracking, daily limits.
// ============================================================

import { WorkerTaskConfig, WorkerTaskState, TaskStatus } from "@/types";
import { readCollection, writeCollection, Collections } from "@/lib/storage";
import { DEFAULT_TASK_CONFIGS, FETCH_TASK_SOURCE_MAP } from "./task-registry";
import { getAppConfig } from "@/lib/config/app-config";
import { writeObject, ConfigFiles } from "@/lib/storage";
import { fetchFromSource } from "@/lib/jobs/pipeline";
import { deduplicateJobs } from "@/lib/jobs/pipeline/dedupe";
import { enrichJobs } from "@/lib/jobs/pipeline/enrich";
import { rankJobs } from "@/lib/jobs/pipeline/rank";
import { runFullPipeline } from "@/lib/jobs/pipeline";
import { resolvePipelineEnrichmentBudget } from "@/lib/jobs/pipeline/config";
import {
  saveRawJobs,
  saveToInbox,
  saveToRejected,
  overwriteRankedJobs,
  getInboxJobs,
  getEnrichedJobs,
  getRawJobs,
} from "@/lib/jobs/storage";
import { createServiceClient } from "@/lib/supabase/service";
import { recordWorkerRun } from "./run-history";
import { getTransactions, updateTransaction } from "@/lib/money/storage";
import { categorizeTransaction } from "@/lib/ai";
import { generateWeeklyReview } from "@/lib/life-os/weekly-review";

const WORKER_USER_ID = process.env.LIFE_OS_DEFAULT_USER_ID || "preview-user";

// ---- State management ----

async function loadTaskStates(): Promise<WorkerTaskState[]> {
  const supabase = createServiceClient();
  if (supabase) {
    const { data } = await supabase.from("worker_state").select("*");
    if (data) {
      return data.map((row) => ({
        taskId: row.task_id,
        status: row.status,
        lastRun: row.last_run,
        lastSuccess: row.last_success,
        lastFailure: row.last_failure,
        consecutiveFailures: row.consecutive_failures,
        runsToday: row.runs_today,
        todayDate: row.today_date,
        skippedReason: row.skipped_reason || undefined,
        error: row.error || undefined,
      }));
    }
  }
  return readCollection<WorkerTaskState>(Collections.WORKER_STATE);
}

async function saveTaskStates(states: WorkerTaskState[]): Promise<void> {
  const supabase = createServiceClient();
  if (supabase) {
    await supabase.from("worker_state").upsert(
      states.map((state) => ({
        task_id: state.taskId,
        status: state.status,
        last_run: state.lastRun,
        last_success: state.lastSuccess,
        last_failure: state.lastFailure,
        consecutive_failures: state.consecutiveFailures,
        runs_today: state.runsToday,
        today_date: state.todayDate,
        skipped_reason: state.skippedReason || null,
        error: state.error || null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "task_id" }
    );
    return;
  }
  await writeCollection(Collections.WORKER_STATE, states);
}

async function getTaskState(taskId: string): Promise<WorkerTaskState> {
  const states = await loadTaskStates();
  const existing = states.find((s) => s.taskId === taskId);

  if (existing) {
    // Reset daily counters if new day
    const today = new Date().toISOString().slice(0, 10);
    if (existing.todayDate !== today) {
      existing.runsToday = 0;
      existing.todayDate = today;
    }
    return existing;
  }

  return {
    taskId,
    status: "idle",
    lastRun: null,
    lastSuccess: null,
    lastFailure: null,
    consecutiveFailures: 0,
    runsToday: 0,
    todayDate: new Date().toISOString().slice(0, 10),
  };
}

async function updateTaskState(
  taskId: string,
  update: Partial<WorkerTaskState>
): Promise<void> {
  const states = await loadTaskStates();
  const idx = states.findIndex((s) => s.taskId === taskId);
  const current = idx >= 0 ? states[idx] : await getTaskState(taskId);

  const updated = { ...current, ...update };

  if (idx >= 0) {
    states[idx] = updated;
  } else {
    states.push(updated);
  }

  await saveTaskStates(states);
}

// ---- Policy checking ----

export interface PolicyCheck {
  allowed: boolean;
  reason?: string;
}

export function checkTaskPolicy(
  config: WorkerTaskConfig,
  state: WorkerTaskState
): PolicyCheck {
  if (!config.enabled) {
    return { allowed: false, reason: "Task is disabled" };
  }

  // Check daily limit
  const today = new Date().toISOString().slice(0, 10);
  const runsToday = state.todayDate === today ? state.runsToday : 0;
  if (runsToday >= config.dailyLimit) {
    return {
      allowed: false,
      reason: `Daily limit reached (${config.dailyLimit})`,
    };
  }

  // Check min interval
  if (state.lastRun) {
    const elapsed = Date.now() - new Date(state.lastRun).getTime();
    if (elapsed < config.minIntervalMs) {
      const waitSecs = Math.ceil(
        (config.minIntervalMs - elapsed) / 1000
      );
      return {
        allowed: false,
        reason: `Min interval not met (wait ${waitSecs}s)`,
      };
    }
  }

  // Check cooldown after failure
  if (state.lastFailure) {
    const elapsed = Date.now() - new Date(state.lastFailure).getTime();
    if (elapsed < config.cooldownMs) {
      return {
        allowed: false,
        reason: `Cooling down after failure (${Math.ceil((config.cooldownMs - elapsed) / 1000)}s)`,
      };
    }
  }

  // Check consecutive failures
  if (state.consecutiveFailures >= config.maxConsecutiveFailures) {
    return {
      allowed: false,
      reason: `Max consecutive failures reached (${config.maxConsecutiveFailures}). Reset manually.`,
    };
  }

  return { allowed: true };
}

// ---- Task execution ----

export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  durationMs: number;
  details?: Record<string, unknown>;
  error?: string;
}

/**
 * Execute a single worker task.
 * Handles policy checks, state tracking, and error handling.
 */
export async function executeTask(
  taskId: string,
  force: boolean = false
): Promise<TaskResult> {
  const start = Date.now();

  // Get config
  const config = await getTaskConfig(taskId);
  if (!config) {
    return {
      taskId,
      status: "failed",
      durationMs: Date.now() - start,
      error: `Unknown task: ${taskId}`,
    };
  }

  // Get state
  const state = await getTaskState(taskId);

  // Check policy (skip if forced)
  if (!force) {
    const policy = checkTaskPolicy(config, state);
    if (!policy.allowed) {
      await updateTaskState(taskId, {
        status: "skipped",
        skippedReason: policy.reason,
      });
      await recordWorkerRun({
        taskId,
        status: "skipped",
        actorId: "worker",
        error: policy.reason,
      });
      return {
        taskId,
        status: "skipped",
        durationMs: Date.now() - start,
        error: policy.reason,
      };
    }
  }

  // Mark as running
  const now = new Date().toISOString();
  await updateTaskState(taskId, {
    status: "running",
    lastRun: now,
  });

  try {
    console.log(`[worker] Executing task: ${config.name} (${taskId})`);

    const details = await runTaskFunction(taskId);
    await recordWorkerRun({
      taskId,
      status: "success",
      actorId: "worker",
      details,
    });

    const durationMs = Date.now() - start;
    const today = new Date().toISOString().slice(0, 10);

    await updateTaskState(taskId, {
      status: "success",
      lastSuccess: new Date().toISOString(),
      consecutiveFailures: 0,
      runsToday: (state.todayDate === today ? state.runsToday : 0) + 1,
      todayDate: today,
      error: undefined,
      skippedReason: undefined,
    });

    console.log(
      `[worker] Task ${taskId} completed in ${(durationMs / 1000).toFixed(1)}s`
    );

    return { taskId, status: "success", durationMs, details };
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    await recordWorkerRun({
      taskId,
      status: "failed",
      actorId: "worker",
      error: errorMsg,
    });

    await updateTaskState(taskId, {
      status: "failed",
      lastFailure: new Date().toISOString(),
      consecutiveFailures: state.consecutiveFailures + 1,
      error: errorMsg,
    });

    console.error(`[worker] Task ${taskId} failed: ${errorMsg}`);

    return { taskId, status: "failed", durationMs, error: errorMsg };
  }
}

/**
 * Get task config by ID, merging defaults with any saved overrides.
 */
export async function getTaskConfig(
  taskId: string
): Promise<WorkerTaskConfig | null> {
  const configs = await getAllTaskConfigs();
  return configs.find((task) => task.id === taskId) || null;
}

/**
 * Get all task configs.
 */
export async function getAllTaskConfigs(): Promise<WorkerTaskConfig[]> {
  const config = await getAppConfig();
  const overrides = config.worker.tasks || [];

  return DEFAULT_TASK_CONFIGS.map((task) => {
    const override = overrides.find((candidate) => candidate.id === task.id);
    return override ? { ...task, ...override, id: task.id, name: task.name } : { ...task };
  });
}

export async function updateTaskConfig(
  taskId: string,
  updates: Partial<
    Pick<
      WorkerTaskConfig,
      | "enabled"
      | "minIntervalMs"
      | "dailyLimit"
      | "burstWindowMs"
      | "burstLimit"
      | "cooldownMs"
      | "maxConsecutiveFailures"
    >
  >
): Promise<WorkerTaskConfig | null> {
  const defaults = DEFAULT_TASK_CONFIGS.find((task) => task.id === taskId);
  if (!defaults) {
    return null;
  }

  const appConfig = await getAppConfig();
  const currentOverrides = appConfig.worker.tasks || [];
  const existingOverride = currentOverrides.find((task) => task.id === taskId);

  const nextOverride: WorkerTaskConfig = {
    ...(existingOverride || defaults),
    ...updates,
    id: defaults.id,
    name: defaults.name,
    adminOnly: defaults.adminOnly,
  };

  const nextOverrides = currentOverrides.some((task) => task.id === taskId)
    ? currentOverrides.map((task) => (task.id === taskId ? nextOverride : task))
    : [...currentOverrides, nextOverride];

  await writeObject(ConfigFiles.APP_CONFIG, {
    ...appConfig,
    worker: {
      ...appConfig.worker,
      tasks: nextOverrides,
    },
  });

  return nextOverride;
}

/**
 * Get all task states.
 */
export async function getAllTaskStates(): Promise<WorkerTaskState[]> {
  const configs = await getAllTaskConfigs();
  const states: WorkerTaskState[] = [];

  for (const config of configs) {
    const state = await getTaskState(config.id);
    states.push(state);
  }

  return states;
}

/**
 * Reset a task's failure state (allow it to run again).
 */
export async function resetTaskState(taskId: string): Promise<void> {
  await updateTaskState(taskId, {
    status: "idle",
    consecutiveFailures: 0,
    error: undefined,
    skippedReason: undefined,
  });
}

// ---- Task function dispatch ----

async function runTaskFunction(
  taskId: string
): Promise<Record<string, unknown>> {
  // Fetch tasks
  const sourceId = FETCH_TASK_SOURCE_MAP[taskId];
  if (sourceId) {
    return runFetchTask(sourceId);
  }

  // Other tasks
  switch (taskId) {
    case "ai-enrich-new-jobs":
      return runEnrichTask();
    case "ai-rank-jobs":
      return runRankTask();
    case "ai-weekly-review":
      return runWeeklyReviewTaskV2();
    case "ai-categorize-ledger":
      return runCategorizeLedgerTaskV2();
    case "full-pipeline":
      return runFullPipelineTask();
    default:
      throw new Error(`No function registered for task: ${taskId}`);
  }
}

async function runFetchTask(
  sourceId: string
): Promise<Record<string, unknown>> {
  const { jobs, result } = await fetchFromSource(sourceId);

  if (jobs.length === 0) {
    return { source: sourceId, fetched: 0, new: 0, note: result.error || "No jobs found" };
  }

  const deduped = await deduplicateJobs(jobs);

  if (deduped.newJobs.length > 0) {
    await saveRawJobs(deduped.newJobs);
  }

  return {
    source: sourceId,
    fetched: jobs.length,
    new: deduped.newJobs.length,
    duplicates: deduped.stats.duplicateCount,
  };
}

async function runEnrichTask(): Promise<Record<string, unknown>> {
  // Get un-enriched raw jobs (ones not yet in enriched/inbox)
  const rawJobs = await getRawJobs();
  const enrichedJobs = await getEnrichedJobs();
  const inboxJobs = await getInboxJobs();

  const enrichedDedupeKeys = new Set([
    ...enrichedJobs.map((j) => j.dedupeKey),
    ...inboxJobs.map((j) => j.dedupeKey),
  ]);

  // Find raw jobs that haven't been enriched yet
  const { generateDedupeKey } = await import("@/lib/jobs/sources/normalize");
  const unenriched = rawJobs
    .filter((raw) => !enrichedDedupeKeys.has(generateDedupeKey(raw)))
    .sort((left, right) => {
      const leftTime = new Date(left.fetchedAt).getTime();
      const rightTime = new Date(right.fetchedAt).getTime();
      return leftTime - rightTime;
    });

  if (unenriched.length === 0) {
    return { enriched: 0, note: "No new jobs to enrich" };
  }

  const workerBudget = resolvePipelineEnrichmentBudget("worker");
  const result = await enrichJobs(unenriched, { maxBatchSize: workerBudget });

  const inbox = result.enriched.filter((j) => j.status === "inbox");
  const rejected = result.enriched.filter((j) => j.status === "rejected");

  if (inbox.length > 0) await saveToInbox(inbox);
  if (rejected.length > 0) await saveToRejected(rejected);

  return {
    attempted: result.stats.attempted,
    enriched: result.stats.enriched,
    failed: result.stats.failed,
    skipped: result.stats.skipped,
    deferred: result.stats.deferred,
    timeoutFailures: result.stats.timeoutFailures,
    fallbackCount: result.stats.fallbackCount,
    contactsGenerated: result.stats.contactsGenerated,
    outreachGenerated: result.stats.outreachGenerated,
    highPriority: result.stats.highPriority,
    avgFitScore: result.stats.avgFitScore,
    reason:
      result.stats.deferred > 0
        ? "budget_exhausted"
        : result.stats.timeoutFailures > 0
          ? "timeout_streak"
          : result.stats.noDescription > 0 && result.stats.enriched === 0
            ? "no_descriptions"
            : undefined,
  };
}

async function runRankTask(): Promise<Record<string, unknown>> {
  const inbox = await getInboxJobs();
  const enriched = await getEnrichedJobs();

  const toRank = [
    ...inbox,
    ...enriched.filter(
      (j) => j.status === "tracked" || j.status === "inbox"
    ),
  ];

  if (toRank.length === 0) {
    return { ranked: 0, note: "No jobs to rank" };
  }

  const result = rankJobs(toRank);
  await overwriteRankedJobs(result.ranked);

  return {
    ranked: result.stats.total,
    high: result.buckets.high.length,
    medium: result.buckets.medium.length,
    low: result.buckets.low.length,
    avgFitScore: result.stats.avgFitScore,
  };
}

async function runFullPipelineTask(): Promise<Record<string, unknown>> {
  const result = await runFullPipeline({
    budgetProfile: "worker",
    maxEnrich: resolvePipelineEnrichmentBudget("worker"),
  });
  return {
    fetched: result.summary.fetched,
    new: result.summary.dedupedNew,
    attemptedEnrichment: result.summary.attemptedEnrichment,
    enriched: result.summary.enriched,
    deferred: result.summary.deferred,
    ranked: result.summary.ranked,
    contactsGenerated: result.summary.contactsGenerated,
    outreachGenerated: result.summary.outreachGenerated,
    timeoutFailures: result.enrichment.timeoutFailures,
    fallbackCount: result.enrichment.fallbackCount,
    totalMs: result.timing.totalMs,
  };
}

async function runWeeklyReviewTaskV2(): Promise<Record<string, unknown>> {
  const result = await generateWeeklyReview(WORKER_USER_ID);
  if ("error" in result) {
    throw new Error(result.error);
  }

  return {
    createdReviewId: result.saved.id,
    jobsReviewed: result.input.jobsReviewed,
    transactionCount: result.input.transactionCount,
    openDecisions: result.input.openDecisions,
  };
}

async function runCategorizeLedgerTaskV2(): Promise<Record<string, unknown>> {
  const transactions = await getTransactions(WORKER_USER_ID);
  const uncategorized = transactions.filter(
    (transaction) => !transaction.category && !transaction.aiCategorization
  );

  if (uncategorized.length === 0) {
    return { categorized: 0, note: "No uncategorized transactions found" };
  }

  let categorized = 0;
  let failed = 0;
  const reviewedCategories = new Set<string>();

  for (const transaction of uncategorized.slice(0, 20)) {
    const result = await categorizeTransaction(
      transaction.description,
      transaction.amount
    );

    if ("error" in result) {
      failed += 1;
      continue;
    }

    await updateTransaction(
      transaction.id,
      (current) => ({
        ...current,
        category: result.data.category,
        merchantCleaned: result.data.merchantCleaned,
        aiCategorization: result,
        updatedAt: new Date().toISOString(),
      }),
      WORKER_USER_ID
    );
    categorized += 1;
    reviewedCategories.add(result.data.category);
  }

  return {
    categorized,
    failed,
    scanned: uncategorized.length,
    categoriesTouched: Array.from(reviewedCategories),
  };
}
