// ============================================================
// AI call rate limiter and usage tracker.
// Prevents runaway AI usage and enforces per-day / per-task limits.
// ============================================================

import { readObject, writeObject, ConfigFiles } from "@/lib/storage";
import { loadAIConfig } from "./config";

export interface AIUsageRecord {
  date: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  totalCalls: number;
  callsByTaskType: Record<string, number>;
  estimatedSpendGbp: number;
  spendByTaskType: Record<string, number>;
  lastCallAt: string | null;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadUsage(): Promise<AIUsageRecord> {
  const record = await readObject<AIUsageRecord>(ConfigFiles.AI_USAGE);
  const today = todayKey();
  const monthKey = today.slice(0, 7);

  if (!record) {
    return {
      date: today,
      monthKey,
      totalCalls: 0,
      callsByTaskType: {},
      estimatedSpendGbp: 0,
      spendByTaskType: {},
      lastCallAt: null,
    };
  }

  if (record.monthKey !== monthKey) {
    return {
      date: today,
      monthKey,
      totalCalls: 0,
      callsByTaskType: {},
      estimatedSpendGbp: 0,
      spendByTaskType: {},
      lastCallAt: null,
    };
  }

  if (record.date !== today) {
    return {
      ...record,
      date: today,
      totalCalls: 0,
      callsByTaskType: {},
      spendByTaskType: record.spendByTaskType || {},
      lastCallAt: record.lastCallAt,
    };
  }

  return {
    ...record,
    monthKey,
    estimatedSpendGbp: record.estimatedSpendGbp || 0,
    spendByTaskType: record.spendByTaskType || {},
  };
}

async function saveUsage(record: AIUsageRecord): Promise<void> {
  await writeObject(ConfigFiles.AI_USAGE, record);
}

export interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
  totalToday: number;
  taskTypeToday: number;
  estimatedSpendGbp: number;
}

/**
 * Check whether an AI call is allowed for the given task type.
 */
export async function checkAIRateLimit(
  taskType: string,
  dailyLimitOverride?: number | null,
  enforceMonthlyBudget: boolean = true
): Promise<RateLimitCheck> {
  const config = await loadAIConfig();
  const usage = await loadUsage();

  const taskTypeCount = usage.callsByTaskType[taskType] || 0;
  const perTaskLimit =
    typeof dailyLimitOverride === "number" && dailyLimitOverride > 0
      ? dailyLimitOverride
      : config.maxCallsPerTaskType;

  if (!config.enabled) {
    return {
      allowed: false,
      reason: "AI is disabled in the local runtime config",
      totalToday: usage.totalCalls,
      taskTypeToday: taskTypeCount,
      estimatedSpendGbp: usage.estimatedSpendGbp,
    };
  }

  if (enforceMonthlyBudget && usage.estimatedSpendGbp >= config.monthlyBudgetGbp) {
    return {
      allowed: false,
      reason: `Monthly AI budget reached (£${config.monthlyBudgetGbp.toFixed(2)})`,
      totalToday: usage.totalCalls,
      taskTypeToday: taskTypeCount,
      estimatedSpendGbp: usage.estimatedSpendGbp,
    };
  }

  if (usage.totalCalls >= config.maxCallsPerDay) {
    return {
      allowed: false,
      reason: `Daily AI call limit reached (${config.maxCallsPerDay})`,
      totalToday: usage.totalCalls,
      taskTypeToday: taskTypeCount,
      estimatedSpendGbp: usage.estimatedSpendGbp,
    };
  }

  if (taskTypeCount >= perTaskLimit) {
    return {
      allowed: false,
      reason: `Task type "${taskType}" limit reached (${perTaskLimit})`,
      totalToday: usage.totalCalls,
      taskTypeToday: taskTypeCount,
      estimatedSpendGbp: usage.estimatedSpendGbp,
    };
  }

  return {
    allowed: true,
    totalToday: usage.totalCalls,
    taskTypeToday: taskTypeCount,
    estimatedSpendGbp: usage.estimatedSpendGbp,
  };
}

/**
 * Record an AI call (call after successful completion).
 */
export async function recordAICall(taskType: string, estimatedCostGbp: number = 0): Promise<void> {
  const usage = await loadUsage();
  usage.totalCalls += 1;
  usage.callsByTaskType[taskType] =
    (usage.callsByTaskType[taskType] || 0) + 1;
  usage.estimatedSpendGbp = Math.max(
    0,
    (usage.estimatedSpendGbp || 0) + Math.max(0, estimatedCostGbp)
  );
  usage.spendByTaskType[taskType] =
    (usage.spendByTaskType[taskType] || 0) + Math.max(0, estimatedCostGbp);
  usage.lastCallAt = new Date().toISOString();
  await saveUsage(usage);
}

/**
 * Get current usage stats (for UI display).
 */
export async function getAIUsageStats(): Promise<AIUsageRecord> {
  return loadUsage();
}
