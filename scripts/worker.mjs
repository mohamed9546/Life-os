// ============================================================
// Standalone worker entry point.
// Run with: npm run worker (continuous)
//           npm run worker:once (single pass)
//
// This script bootstraps the Next.js environment and
// starts the worker scheduler.
// ============================================================

import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// ---- Bootstrap ----

const args = process.argv.slice(2);
const isOnce = args.includes("--once");
const allowContinuousDev = args.includes("--allow-continuous-dev");
const taskFilter = args
  .filter((a) => a.startsWith("--task="))
  .map((a) => a.replace("--task=", ""));

console.log("Life OS Worker");
console.log("==============");
console.log(`Mode: ${isOnce ? "once" : "continuous"}`);
if (taskFilter.length > 0) {
  console.log(`Filter: ${taskFilter.join(", ")}`);
}
console.log(`PID: ${process.pid}`);
console.log(`Time: ${new Date().toISOString()}`);
console.log("");

// ---- Since we can't easily import TS modules from mjs, ----
// ---- we call the worker API endpoint instead.           ----

const BASE_URL = process.env.WORKER_API_URL || "http://localhost:3000";

function truthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function isLocalBaseUrl(url) {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

if (!isOnce && isLocalBaseUrl(BASE_URL) && !allowContinuousDev && !truthy(process.env.WORKER_ALLOW_CONTINUOUS_DEV)) {
  console.error("[worker] Refusing continuous mode against a local dev server by default.");
  console.error("[worker] This avoids background task churn while you browse the app.");
  console.error("[worker] Use `npm run worker:once`, or rerun with `node scripts/worker.mjs --allow-continuous-dev`,");
  console.error("[worker] or set WORKER_ALLOW_CONTINUOUS_DEV=true if you really want continuous local runs.");
  process.exit(1);
}

async function callApi(path, method = "GET", body = null) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, options);

  if (!response.ok) {
    const text = await response.text().catch(() => "unknown");
    throw new Error(`API ${path} returned ${response.status}: ${text}`);
  }

  return response.json();
}

async function checkHealth() {
  try {
    const health = await callApi("/api/ai/health");
    console.log(
      `[health] AI: ${health.health?.available ? "✓ online" : "✗ offline"} | ` +
        `Model: ${health.config?.model || "unknown"} | ` +
        `Calls today: ${health.usage?.totalCalls || 0}`
    );
    return health.health?.available || false;
  } catch (err) {
    console.error(
      `[health] Cannot reach app at ${BASE_URL}: ${err.message}`
    );
    console.error(
      "         Make sure 'npm run dev' is running in another terminal."
    );
    return false;
  }
}

async function getTaskStatuses() {
  try {
    const data = await callApi("/api/worker/status");
    return data.tasks || [];
  } catch {
    return [];
  }
}

async function runTask(taskId, force = false) {
  try {
    const result = await callApi("/api/worker/run", "POST", {
      taskId,
      force,
    });
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---- Main worker loop ----

async function runOnce() {
  console.log("[worker] Running single pass...\n");

  const healthy = await checkHealth();
  if (!healthy) {
    console.error("[worker] App not available. Exiting.");
    process.exit(1);
  }

  // Get all task configs
  const configData = await callApi("/api/worker/config");
  const tasks = configData.tasks || [];
  const enabledTasks = tasks.filter((t) => {
    if (taskFilter.length > 0) return taskFilter.includes(t.id) && t.enabled;
    return t.enabled;
  });

  console.log(`[worker] ${enabledTasks.length} enabled tasks\n`);

  for (const task of enabledTasks) {
    console.log(`[worker] → ${task.name} (${task.id})`);
    const result = await runTask(task.id);

    if (result.result) {
      const r = result.result;
      console.log(
        `  Status: ${r.status} | Duration: ${(r.durationMs / 1000).toFixed(1)}s`
      );
      if (r.details) {
        console.log(`  Details: ${JSON.stringify(r.details)}`);
      }
      if (r.error) {
        console.log(`  Error: ${r.error}`);
      }
    }
    console.log("");

    // Delay between tasks
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("[worker] Single pass complete.");
}

async function runContinuous() {
  const TICK_INTERVAL = 60_000; // 1 minute

  console.log("[worker] Starting continuous mode...\n");

  const healthy = await checkHealth();
  if (!healthy) {
    console.error("[worker] App not available. Will retry in 30s...");
    await new Promise((r) => setTimeout(r, 30_000));
  }

  let tickCount = 0;

  while (true) {
    tickCount++;

    try {
      // Every 10 ticks (~10 min), show a heartbeat
      if (tickCount % 10 === 0) {
        await checkHealth();
        const stats = await callApi("/api/jobs/stats").catch(() => null);
        if (stats) {
          console.log(
            `[heartbeat] Inbox: ${stats.collections?.inbox || 0} | ` +
              `Tracked: ${stats.collections?.tracked || 0} | ` +
              `Sources: ${stats.sources?.active || 0}/${stats.sources?.total || 0}`
          );
        }
      }

      // Get task configs and run due ones
      const configData = await callApi("/api/worker/config").catch(
        () => null
      );
      if (!configData) {
        console.warn("[worker] Cannot reach app — skipping tick");
        await new Promise((r) => setTimeout(r, TICK_INTERVAL));
        continue;
      }

      const tasks = (configData.tasks || []).filter((t) => t.enabled);

      for (const task of tasks) {
        if (taskFilter.length > 0 && !taskFilter.includes(task.id)) {
          continue;
        }

        const result = await runTask(task.id);

        if (result.result?.status === "success") {
          console.log(
            `[worker] ✓ ${task.name} — ${(result.result.durationMs / 1000).toFixed(1)}s`
          );
          if (result.result.details) {
            console.log(
              `         ${JSON.stringify(result.result.details)}`
            );
          }
          // Extra delay after successful task
          await new Promise((r) => setTimeout(r, 5000));
        }
        // Don't log skipped tasks — too noisy
      }
    } catch (err) {
      console.error(`[worker] Tick error: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, TICK_INTERVAL));
  }
}

// ---- Entry point ----

(async () => {
  try {
    if (isOnce) {
      await runOnce();
    } else {
      await runContinuous();
    }
  } catch (err) {
    console.error("[worker] Fatal error:", err);
    process.exit(1);
  }
})();
