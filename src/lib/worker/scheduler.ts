// ============================================================
// Worker scheduler.
// Runs tasks on their configured intervals.
// Self-healing: if a task fails, it respects cooldowns
// and max failure limits.
// ============================================================

import { getAllTaskConfigs, executeTask } from "./task-runner";
import type { WorkerTaskConfig } from "@/types";

export interface SchedulerOptions {
  /** Tick interval — how often the scheduler checks for due tasks */
  tickIntervalMs?: number;
  /** Run once then exit (for --once mode) */
  once?: boolean;
  /** Only run these specific task IDs */
  taskFilter?: string[];
  /** Callback for task completion */
  onTaskComplete?: (taskId: string, status: string, durationMs: number) => void;
}

const DEFAULT_TICK_INTERVAL = 30_000; // 30 seconds

/**
 * Start the worker scheduler.
 * Continuously checks for due tasks and executes them.
 */
export async function startScheduler(
  options?: SchedulerOptions
): Promise<void> {
  const tickInterval = options?.tickIntervalMs || DEFAULT_TICK_INTERVAL;
  const once = options?.once || false;

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║    Life OS Worker — Starting...      ║");
  console.log("╚══════════════════════════════════════╝\n");

  const enabledConfigs = await getEnabledConfigs(options?.taskFilter);

  console.log(
    `[scheduler] ${enabledConfigs.length} tasks enabled out of ${(await getAllTaskConfigs()).length} total`
  );
  for (const config of enabledConfigs) {
    console.log(
      `  • ${config.name} (every ${formatMs(config.minIntervalMs)}, max ${config.dailyLimit}/day)`
    );
  }
  console.log("");

  if (once) {
    console.log("[scheduler] Running once mode — executing all due tasks...\n");
    await runDueTasks(enabledConfigs, options?.onTaskComplete);
    console.log("\n[scheduler] Once mode complete. Exiting.");
    return;
  }

  // Continuous loop
  console.log(
    `[scheduler] Entering continuous mode — tick every ${formatMs(tickInterval)}\n`
  );

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const dueConfigs = await getEnabledConfigs(options?.taskFilter);
      await runDueTasks(dueConfigs, options?.onTaskComplete);
    } catch (err) {
      console.error(
        "[scheduler] Tick error:",
        err instanceof Error ? err.message : err
      );
    }

    await new Promise((r) => setTimeout(r, tickInterval));
  }
}

/**
 * Check all tasks and execute any that are due.
 */
async function runDueTasks(
  configs: WorkerTaskConfig[],
  onComplete?: (taskId: string, status: string, durationMs: number) => void
): Promise<void> {
  for (const config of configs) {
    try {
      const result = await executeTask(config.id);

      if (result.status === "skipped") {
        // Don't log skipped tasks every tick — too noisy
        continue;
      }

      if (onComplete) {
        onComplete(config.id, result.status, result.durationMs);
      }

      // Small delay between tasks to avoid overloading
      if (result.status === "success") {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error(
        `[scheduler] Error executing ${config.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

function formatMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3600_000).toFixed(1)}h`;
}

async function getEnabledConfigs(taskFilter?: string[]): Promise<WorkerTaskConfig[]> {
  const configs = await getAllTaskConfigs();
  return configs.filter((config) => {
    if (taskFilter && taskFilter.length > 0) {
      return taskFilter.includes(config.id) && config.enabled;
    }
    return config.enabled;
  });
}
