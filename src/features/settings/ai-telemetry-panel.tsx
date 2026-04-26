"use client";

import { useEffect, useState } from "react";
import { AITelemetryEntry, AITelemetrySummary } from "@/types";
import { ActionButton, AlertBanner, LoadingState, SectionHeading, StatusChip } from "@/components/ui/system";

interface AITelemetryApiResponse {
  ok: boolean;
  summary: AITelemetrySummary;
  recentEvents: AITelemetryEntry[];
  error?: string;
}

export function AITelemetryPanel() {
  const [summary, setSummary] = useState<AITelemetrySummary | null>(null);
  const [recentEvents, setRecentEvents] = useState<AITelemetryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(limit = 50, refreshMode = false) {
    if (refreshMode) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await fetch(`/api/admin/ai-telemetry?limit=${limit}`, { cache: "no-store" });
      const payload = (await response.json()) as AITelemetryApiResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to load AI telemetry");
      }
      setSummary(payload.summary);
      setRecentEvents(payload.recentEvents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load AI telemetry");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="card space-y-5">
      <SectionHeading
        title="AI Telemetry"
        description="Compact local diagnostics for task latency, fallback usage, provider/model mix, and estimated spend. Metadata only; no prompt or response text is stored by default."
        actions={
          <ActionButton variant="secondary" onClick={() => void load(50, true)} disabled={loading || refreshing}>
            {refreshing ? "Refreshing..." : "Refresh telemetry"}
          </ActionButton>
        }
      />

      {error && <AlertBanner tone="danger" title="AI telemetry failed" description={error} />}

      {loading ? (
        <div className="py-10">
          <LoadingState label="Loading AI telemetry..." />
        </div>
      ) : !summary ? (
        <div className="py-10 text-center text-sm text-text-secondary">
          No telemetry summary available yet.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <MetricCard label="Calls today" value={summary.windows.today.totalCalls} />
            <MetricCard label="Calls week" value={summary.windows.week.totalCalls} />
            <MetricCard label="Calls month" value={summary.windows.month.totalCalls} />
            <MetricCard label="Failures" value={summary.failureCount} tone="danger" />
            <MetricCard label="Fallbacks" value={summary.fallbackCount} tone="warning" />
            <MetricCard label="Avg latency" value={`${summary.averageLatencyMs}ms`} tone="info" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <InfoBlock title="Provider usage">
              {summary.providerUsage.length === 0 ? (
                <p className="text-sm text-text-secondary">No provider data yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {summary.providerUsage.map((item) => (
                    <StatusChip key={item.provider} tone="neutral">{item.provider}: {item.count}</StatusChip>
                  ))}
                </div>
              )}
            </InfoBlock>

            <InfoBlock title="Model usage">
              {summary.modelUsage.length === 0 ? (
                <p className="text-sm text-text-secondary">No model data yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {summary.modelUsage.slice(0, 8).map((item) => (
                    <StatusChip key={item.model} tone="info">{item.model}: {item.count}</StatusChip>
                  ))}
                </div>
              )}
            </InfoBlock>

            <InfoBlock title="Local vs cloud">
              <div className="flex flex-wrap gap-2">
                <StatusChip tone="success">Local: {summary.localVsCloud.local}</StatusChip>
                <StatusChip tone="warning">Cloud: {summary.localVsCloud.cloud}</StatusChip>
                <StatusChip tone="neutral">Unknown: {summary.localVsCloud.unknown}</StatusChip>
              </div>
              <p className="text-sm text-text-secondary mt-3">
                Estimated total cost: £{summary.estimatedTotalCost.toFixed(4)}
              </p>
            </InfoBlock>

            <InfoBlock title="Sensitivity routing overview">
              {summary.sensitivityRouting.length === 0 ? (
                <p className="text-sm text-text-secondary">No sensitivity data yet.</p>
              ) : (
                <div className="space-y-2">
                  {summary.sensitivityRouting.map((item) => (
                    <div key={item.sensitivityLevel} className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-text-secondary">
                      <span className="font-medium text-text-primary">{item.sensitivityLevel}</span>
                      {` · ${item.count} calls · local ${item.local} · cloud ${item.cloud} · unknown ${item.unknown}`}
                    </div>
                  ))}
                </div>
              )}
            </InfoBlock>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <InfoBlock title="Slowest tasks">
              {summary.slowestTasks.length === 0 ? (
                <p className="text-sm text-text-secondary">No latency data yet.</p>
              ) : (
                <div className="space-y-2">
                  {summary.slowestTasks.map((task) => (
                    <div key={task.taskType} className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-text-secondary">
                      <p className="font-medium text-text-primary">{task.taskName}</p>
                      <p className="mt-1">avg {task.averageLatencyMs}ms · max {task.maxLatencyMs}ms · {task.count} calls</p>
                    </div>
                  ))}
                </div>
              )}
            </InfoBlock>

            <InfoBlock title="Recent failures">
              {summary.recentFailures.length === 0 ? (
                <p className="text-sm text-text-secondary">No recent failures.</p>
              ) : (
                <div className="space-y-2">
                  {summary.recentFailures.map((failure, index) => (
                    <div key={`${failure.taskType}-${failure.completedAt}-${index}`} className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-text-secondary">
                      <p className="font-medium text-text-primary">{failure.taskName}</p>
                      <p className="mt-1">{failure.errorType || "runtime_error"} · {failure.errorSummary || "No summary"}</p>
                      <p className="mt-1 text-xs text-text-tertiary">{new Date(failure.completedAt).toLocaleString("en-GB")}</p>
                    </div>
                  ))}
                </div>
              )}
            </InfoBlock>
          </div>

          <div className="card overflow-hidden border border-surface-3 bg-surface-2">
            <div className="border-b border-surface-3 px-4 py-3">
              <p className="text-sm font-medium text-text-primary">Recent AI events</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-1 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                  <tr>
                    <th className="px-4 py-3">Task</th>
                    <th className="px-4 py-3">Provider / model</th>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">Latency</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map((event) => (
                    <tr key={event.id} className="border-t border-surface-3 align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">{event.taskName}</p>
                        <p className="mt-1 text-[11px] text-text-tertiary font-mono">{event.taskType}</p>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        <p>{event.provider || "unknown"}</p>
                        <p className="mt-1 text-[11px] text-text-tertiary">{event.model || "unknown"}</p>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        <p>{event.runtimeRoute || "unknown"}</p>
                        <p className="mt-1 text-[11px] text-text-tertiary">{event.localOrCloud} · {event.sensitivityLevel}</p>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{event.latencyMs}ms</td>
                      <td className="px-4 py-3">
                        <StatusChip tone={event.success ? "success" : "danger"}>
                          {event.success ? "Success" : event.errorType || "Failure"}
                        </StatusChip>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{event.estimatedCost == null ? "-" : `£${event.estimatedCost.toFixed(6)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "warning" | "danger" | "info";
}) {
  const toneClass = {
    neutral: "text-white",
    warning: "text-amber-300",
    danger: "text-rose-300",
    info: "text-blue-300",
  }[tone];

  return (
    <div className="rounded-2xl border border-surface-3 bg-surface-2 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">{title}</p>
      {children}
    </div>
  );
}
