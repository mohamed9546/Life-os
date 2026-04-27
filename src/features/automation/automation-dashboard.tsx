"use client";

import { ReactNode, useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { TaskStatus } from "@/types";
import { OpenCodeControlPanel } from "./opencode-control-panel";
import { SystemCheckpointPanel } from "./system-checkpoint-panel";

interface OpsResponse {
  aiHealth: {
    available: boolean;
    endpoint: string;
    primaryModel: string;
    fallbackModel: string | null;
    responseTimeMs: number | null;
    availableModels: string[];
    configuredTasks: Array<{
      taskType: string;
      enabled: boolean;
      model: string;
      fallbackModel: string | null;
    }>;
    error?: string;
  };
  aiUsage: {
    totalCalls: number;
    callsByTaskType: Record<string, number>;
  };
  aiConfig: {
    compatibilityMode: string;
    taskSettings: Record<string, { label: string; enabled: boolean }>;
  };
  apolloHealth: {
    available: boolean;
    error?: string;
  };
  tasks: Array<{
    id: string;
    name: string;
    enabled: boolean;
    minIntervalMs: number;
    dailyLimit: number;
    burstWindowMs: number;
    burstLimit: number;
    cooldownMs: number;
    maxConsecutiveFailures: number;
    state?: {
      status: TaskStatus;
      lastRun: string | null;
      lastSuccess?: string | null;
      lastFailure?: string | null;
      consecutiveFailures: number;
      error?: string;
      skippedReason?: string;
    };
    policyAllowed: boolean;
    policyReason?: string;
    recentRun?: {
      createdAt: string;
      status: TaskStatus;
      details?: Record<string, unknown>;
      error?: string;
    } | null;
  }>;
  sources: Array<{
    sourceId: string;
    displayName: string;
    configured: boolean;
    taskId: string | null;
    state?: {
      status: TaskStatus;
      lastRun: string | null;
      error?: string;
      skippedReason?: string;
    } | null;
    recentRun?: {
      createdAt: string;
      status: TaskStatus;
      details?: Record<string, unknown>;
      error?: string;
    } | null;
  }>;
  recentRuns: Array<{
    id: string;
    taskId: string;
    status: TaskStatus;
    createdAt: string;
    details?: Record<string, unknown>;
    error?: string;
  }>;
}

const QUICK_ACTIONS = [
  { id: "full-pipeline", label: "Run full pipeline" },
  { id: "ai-enrich-new-jobs", label: "Enrich jobs now" },
  { id: "ai-rank-jobs", label: "Rank jobs now" },
  { id: "ai-categorize-ledger", label: "Categorize ledger" },
  { id: "ai-weekly-review", label: "Weekly review" },
];

export function AutomationDashboard() {
  const [ops, setOps] = useState<OpsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [savingPolicyKey, setSavingPolicyKey] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const response = await fetch("/api/admin/ops");
      if (!response.ok) {
        setOps(null);
        return;
      }
      const data = (await response.json()) as OpsResponse;
      setOps(data);
    } catch {
      setOps(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      if (interval) {
        return;
      }
      interval = setInterval(() => {
        if (document.visibilityState === "visible") {
          void refresh();
        }
      }, 20_000);
    }

    function stopPolling() {
      if (!interval) {
        return;
      }
      clearInterval(interval);
      interval = null;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refresh();
        startPolling();
      } else {
        stopPolling();
      }
    }

    void refresh();
    if (document.visibilityState === "visible") {
      startPolling();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopPolling();
    };
  }, []);

  const runTask = async (taskId: string) => {
    setRunningKey(taskId);
    try {
      await fetch("/api/worker/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, force: true }),
      });
      await refresh();
    } finally {
      setRunningKey(null);
    }
  };

  const runSource = async (sourceId: string) => {
    setRunningKey(`source:${sourceId}`);
    try {
      await fetch("/api/worker/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, force: true }),
      });
      await refresh();
    } finally {
      setRunningKey(null);
    }
  };

  const saveTaskPolicy = async (
    taskId: string,
    updates: Partial<{
      enabled: boolean;
      minIntervalMs: number;
      dailyLimit: number;
      cooldownMs: number;
    }>
  ) => {
    setSavingPolicyKey(taskId);
    try {
      await fetch("/api/worker/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, updates }),
      });
      await refresh();
    } finally {
      setSavingPolicyKey(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SystemCheckpointPanel />
        <div className="card text-center py-12">
          <StatusBadge status="running" label="Loading operations..." />
        </div>
      </div>
    );
  }

  if (!ops) {
    return (
      <div className="space-y-6">
        <SystemCheckpointPanel />
        <div className="card text-center py-12">
          <p className="text-sm text-text-secondary">
            Admin operations are unavailable.
          </p>
        </div>
      </div>
    );
  }

  const fetchTasks = (ops.tasks ?? []).filter((task) => task.id.startsWith("fetch-"));
  const aiTasks = (ops.tasks ?? []).filter((task) => task.id.startsWith("ai-"));

  return (
    <div className="space-y-6">
      <SystemCheckpointPanel />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatCard title="Local AI runtime">
          <MetricRow label="Endpoint" value={ops.aiHealth.endpoint} mono />
          <MetricRow label="Primary model" value={ops.aiHealth.primaryModel} mono />
          <MetricRow
            label="Fallback model"
            value={ops.aiHealth.fallbackModel || "None"}
            mono
          />
          <MetricRow
            label="Latency"
            value={
              ops.aiHealth.responseTimeMs
                ? `${ops.aiHealth.responseTimeMs}ms`
                : "-"
            }
            mono
          />
          <MetricRow
            label="Discovered models"
            value={String(ops.aiHealth.availableModels.length)}
            mono
          />
        </StatCard>

        <StatCard title="AI usage">
          <MetricRow
            label="Total calls"
            value={String(ops.aiUsage.totalCalls)}
            mono
          />
          {Object.entries(ops.aiUsage.callsByTaskType).map(([taskType, count]) => (
            <MetricRow
              key={taskType}
              label={taskType}
              value={String(count)}
              mono
            />
          ))}
          <MetricRow
            label="Apollo"
            value={ops.apolloHealth.available ? "Online" : ops.apolloHealth.error || "Offline"}
            valueClassName={ops.apolloHealth.available ? "text-success" : "text-danger"}
          />
        </StatCard>

        <StatCard title="Quick actions">
          <div className="grid grid-cols-1 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                className="btn-secondary btn-sm justify-start"
                onClick={() => runTask(action.id)}
                disabled={runningKey !== null}
              >
                {runningKey === action.id ? "Running..." : action.label}
              </button>
            ))}
          </div>
        </StatCard>
      </div>

      <OpenCodeControlPanel />

      <div className="card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Source operations
            </h2>
            <p className="text-sm text-text-secondary mt-2">
              Trigger a single source, inspect its last result, and catch adapter failures faster.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">
          {ops.sources.map((source) => (
            <div key={source.sourceId} className="rounded-xl border border-surface-3 bg-surface-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {source.displayName}
                  </p>
                  <p className="text-2xs font-mono text-text-tertiary mt-1">
                    {source.sourceId}
                  </p>
                </div>
                <StatusBadge status={source.state?.status || "idle"} />
              </div>

              <p className={`text-2xs mt-3 ${source.configured ? "text-success" : "text-text-tertiary"}`}>
                {source.configured ? "Configured" : "Missing config"}
              </p>
              {source.state?.error && (
                <p className="text-2xs text-danger mt-2">{source.state.error}</p>
              )}
              {source.state?.skippedReason && !source.state?.error && (
                <p className="text-2xs text-warning mt-2">{source.state.skippedReason}</p>
              )}
              {source.recentRun?.details && (
                <p className="text-2xs text-text-secondary mt-2">
                  {formatRunDetails(source.recentRun.details)}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="text-2xs text-text-tertiary">
                  {source.state?.lastRun
                    ? `Last run ${formatDateTime(source.state.lastRun)}`
                    : "Never run"}
                </span>
                <button
                  className="btn-primary btn-sm"
                  onClick={() => runSource(source.sourceId)}
                  disabled={runningKey !== null || !source.taskId}
                >
                  {runningKey === `source:${source.sourceId}` ? "Running..." : "Run source"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary mb-3">
            Fetch tasks
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {fetchTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                running={runningKey === task.id}
                onRun={runTask}
                onSavePolicy={saveTaskPolicy}
                savingPolicy={savingPolicyKey === task.id}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary mb-3">
            AI tasks
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {aiTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                running={runningKey === task.id}
                onRun={runTask}
                onSavePolicy={saveTaskPolicy}
                savingPolicy={savingPolicyKey === task.id}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
          Recent activity
        </h2>
        <div className="space-y-3 mt-4">
          {ops.recentRuns.length === 0 ? (
            <p className="text-sm text-text-secondary">No worker runs recorded yet.</p>
          ) : (
            ops.recentRuns.map((run) => (
              <div
                key={run.id}
                className="rounded-lg bg-surface-2 px-4 py-3 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="text-sm text-text-primary font-medium">{run.taskId}</p>
                  <p className="text-2xs text-text-tertiary mt-1">
                    {formatDateTime(run.createdAt)}
                  </p>
                  {run.details && (
                    <p className="text-2xs text-text-secondary mt-2">
                      {formatRunDetails(run.details)}
                    </p>
                  )}
                  {run.error && (
                    <p className="text-2xs text-danger mt-2">{run.error}</p>
                  )}
                </div>
                <StatusBadge status={run.status} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="card">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
        {title}
      </h2>
      <div className="space-y-2 mt-4 text-xs">{children}</div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  mono,
  valueClassName,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
      <span className="text-text-secondary">{label}</span>
      <span
        className={`${mono ? "font-mono" : ""} ${valueClassName || "text-text-primary"}`}
      >
        {value}
      </span>
    </div>
  );
}

function TaskCard({
  task,
  onRun,
  running,
  onSavePolicy,
  savingPolicy,
}: {
  task: OpsResponse["tasks"][number];
  onRun: (taskId: string) => void;
  running: boolean;
  onSavePolicy: (
    taskId: string,
    updates: Partial<{
      enabled: boolean;
      minIntervalMs: number;
      dailyLimit: number;
      cooldownMs: number;
    }>
  ) => void | Promise<void>;
  savingPolicy: boolean;
}) {
  const [enabled, setEnabled] = useState(task.enabled);
  const [minIntervalMinutes, setMinIntervalMinutes] = useState(
    Math.max(1, Math.round(task.minIntervalMs / 60_000))
  );
  const [dailyLimit, setDailyLimit] = useState(task.dailyLimit);
  const [cooldownMinutes, setCooldownMinutes] = useState(
    Math.max(1, Math.round(task.cooldownMs / 60_000))
  );

  useEffect(() => {
    setEnabled(task.enabled);
    setMinIntervalMinutes(Math.max(1, Math.round(task.minIntervalMs / 60_000)));
    setDailyLimit(task.dailyLimit);
    setCooldownMinutes(Math.max(1, Math.round(task.cooldownMs / 60_000)));
  }, [task]);

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">{task.name}</h3>
          <p className="text-2xs font-mono text-text-tertiary mt-1">{task.id}</p>
        </div>
        <StatusBadge status={running ? "running" : task.state?.status || "idle"} />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 text-2xs">
        <div>
          <span className="text-text-tertiary">Last run</span>
          <p className="font-mono text-text-primary mt-1">
            {task.state?.lastRun ? formatDateTime(task.state.lastRun) : "Never"}
          </p>
        </div>
        <div>
          <span className="text-text-tertiary">Failures</span>
          <p className="font-mono text-text-primary mt-1">
            {task.state?.consecutiveFailures || 0}/{task.maxConsecutiveFailures}
          </p>
        </div>
      </div>

      {task.policyReason && (
        <p className="text-2xs text-warning mt-3">{task.policyReason}</p>
      )}
      {task.state?.error && (
        <p className="text-2xs text-danger mt-2">{task.state.error}</p>
      )}
      {task.recentRun?.details && (
        <p className="text-2xs text-text-secondary mt-2">
          {formatRunDetails(task.recentRun.details)}
        </p>
      )}

      <div className="mt-4 rounded-lg border border-surface-3 bg-surface-2 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-text-tertiary">
            Policy
          </p>
          <button
            className={`btn-sm ${enabled ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setEnabled((current) => !current)}
            type="button"
          >
            {enabled ? "Enabled" : "Disabled"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <PolicyField
            label="Interval (min)"
            value={minIntervalMinutes}
            onChange={setMinIntervalMinutes}
          />
          <PolicyField
            label="Daily limit"
            value={dailyLimit}
            onChange={setDailyLimit}
          />
          <PolicyField
            label="Cooldown (min)"
            value={cooldownMinutes}
            onChange={setCooldownMinutes}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-2xs text-text-tertiary">
            Burst {task.burstLimit} per {Math.round(task.burstWindowMs / 60_000)} min
          </span>
          <button
            className="btn-secondary btn-sm"
            type="button"
            disabled={savingPolicy}
            onClick={() =>
              void onSavePolicy(task.id, {
                enabled,
                minIntervalMs: Math.max(1, minIntervalMinutes) * 60_000,
                dailyLimit: Math.max(1, dailyLimit),
                cooldownMs: Math.max(1, cooldownMinutes) * 60_000,
              })
            }
          >
            {savingPolicy ? "Saving..." : "Save policy"}
          </button>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-surface-3 flex items-center gap-2">
        <button
          className="btn-primary btn-sm"
          onClick={() => onRun(task.id)}
          disabled={running || !task.enabled}
        >
          {running ? "Running..." : "Run now"}
        </button>
        <span className={task.enabled ? "text-success text-2xs" : "text-text-tertiary text-2xs"}>
          {task.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>
    </div>
  );
}

function PolicyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="text-2xs text-text-tertiary">{label}</label>
      <input
        className="input mt-1 h-9 text-sm"
        type="number"
        min="1"
        value={value}
        onChange={(event) => onChange(parseInt(event.target.value || "1", 10))}
      />
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB");
}

function formatRunDetails(details: Record<string, unknown>) {
  return Object.entries(details)
    .filter(([, value]) => typeof value !== "object")
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" | ");
}
