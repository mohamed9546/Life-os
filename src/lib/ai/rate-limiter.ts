// ============================================================
// AI call rate limiter and usage tracker.
// Prevents runaway AI usage and enforces per-day / per-task limits.
// ============================================================

import { readObject, writeObject, ConfigFiles } from "@/lib/storage";
import { loadAIConfig } from "./config";

export interface AIUsageRecord {
  date: string; // YYYY-MM-DD
  totalCalls: number;
  callsByTaskType: Record<string, number>;
  lastCallAt: string | null;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadUsage(): Promise<AIUsageRecord> {
  const record = await readObject<AIUsageRecord>(ConfigFiles.AI_USAGE);
  const today = todayKey();

  if (!record || record.date !== today) {
    return {
      date: today,
      totalCalls: 0,
      callsByTaskType: {},
      lastCallAt: null,
    };
  }

  return record;
}

async function saveUsage(record: AIUsageRecord): Promise<void> {
  await writeObject(ConfigFiles.AI_USAGE, record);
}

export interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
  totalToday: number;
  taskTypeToday: number;
}

/**
 * Check whether an AI call is allowed for the given task type.
 */
export async function checkAIRateLimit(
  taskType: string
): Promise<RateLimitCheck> {
  const config = await loadAIConfig();
  const usage = await loadUsage();

  const taskTypeCount = usage.callsByTaskType[taskType] || 0;

  if (!config.enabled) {
    return {
      allowed: false,
      reason: "AI is disabled in the local runtime config",
      totalToday: usage.totalCalls,
      taskTypeToday: taskTypeCount,
    };
  }

  if (usage.totalCalls >= config.maxCallsPerDay) {
    return {
      allowed: false,
      reason: `Daily AI call limit reached (${config.maxCallsPerDay})`,
      totalToday: usage.totalCalls,
      taskTypeToday: taskTypeCount,
    };
  }

  if (taskTypeCount >= config.maxCallsPerTaskType) {
    return {
      allowed: false,
      reason: `Task type "${taskType}" limit reached (${config.maxCallsPerTaskType})`,
      totalToday: usage.totalCalls,
      taskTypeToday: taskTypeCount,
    };
  }

  return {
    allowed: true,
    totalToday: usage.totalCalls,
    taskTypeToday: taskTypeCount,
  };
}

/**
 * Record an AI call (call after successful completion).
 */
export async function recordAICall(taskType: string): Promise<void> {
  const usage = await loadUsage();
  usage.totalCalls += 1;
  usage.callsByTaskType[taskType] =
    (usage.callsByTaskType[taskType] || 0) + 1;
  usage.lastCallAt = new Date().toISOString();
  await saveUsage(usage);
}

/**
 * Get current usage stats (for UI display).
 */
export async function getAIUsageStats(): Promise<AIUsageRecord> {
  return loadUsage();
}
