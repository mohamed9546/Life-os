"use client";

import { useEffect, useState } from "react";
import { SourceHealthSnapshot } from "@/types";
import { ActionButton, AlertBanner, LoadingState, SectionHeading, StatusChip } from "@/components/ui/system";

interface SourceHealthApiResponse {
  ok: boolean;
  snapshot: SourceHealthSnapshot | null;
  error?: string;
}

export function SourceHealthPanel() {
  const [snapshot, setSnapshot] = useState<SourceHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadLatest() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/source-health", { cache: "no-store" });
      const payload = (await response.json()) as SourceHealthApiResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to load source health");
      }
      setSnapshot(payload.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load source health");
    } finally {
      setLoading(false);
    }
  }

  async function runCheck() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/source-health", { method: "POST" });
      const payload = (await response.json()) as SourceHealthApiResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Source health check failed");
      }
      setSnapshot(payload.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Source health check failed");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    void loadLatest();
  }, []);

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Source health"
        description="Checks whether job sources are still returning usable data."
        actions={
          <ActionButton variant="secondary" onClick={() => void runCheck()} disabled={running || loading}>
            {running ? "Running check..." : "Run check"}
          </ActionButton>
        }
      />

      {error && <AlertBanner tone="danger" title="Source health failed" description={error} />}

      {loading ? (
        <div className="card py-10">
          <LoadingState label="Loading source health..." />
        </div>
      ) : !snapshot ? (
        <div className="card py-10 text-center text-sm text-text-secondary">
          No source health check has run yet.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <SummaryCard label="OK" value={snapshot.ok} tone="success" />
            <SummaryCard label="Degraded" value={snapshot.degraded} tone="warning" />
            <SummaryCard label="Down" value={snapshot.down} tone="danger" />
            <SummaryCard label="Unknown" value={snapshot.unknown} tone="neutral" />
            <SummaryCard label="Duration" value={`${snapshot.durationMs}ms`} tone="info" />
          </div>

          <div className="card overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-surface-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-text-primary">Latest snapshot</p>
              <p className="text-xs text-text-tertiary">
                Checked {new Date(snapshot.checkedAt).toLocaleString("en-GB")}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                  <tr>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last checked</th>
                    <th className="px-4 py-3">Latency</th>
                    <th className="px-4 py-3">Result count</th>
                    <th className="px-4 py-3">Error / warning</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.results.map((result) => (
                    <tr key={result.sourceId} className="border-t border-surface-3 align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">{result.sourceName}</p>
                        <p className="mt-1 text-[11px] text-text-tertiary font-mono">{result.sourceId}</p>
                      </td>
                      <td className="px-4 py-3"><HealthStatusChip status={result.status} /></td>
                      <td className="px-4 py-3 text-text-secondary">{new Date(result.checkedAt).toLocaleString("en-GB")}</td>
                      <td className="px-4 py-3 text-text-secondary">{result.latencyMs == null ? "-" : `${result.latencyMs}ms`}</td>
                      <td className="px-4 py-3 text-text-secondary">{result.resultCount == null ? "-" : result.resultCount}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {result.error || result.warning || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "success" | "warning" | "danger" | "neutral" | "info";
}) {
  const toneClass = {
    success: "text-emerald-300",
    warning: "text-amber-300",
    danger: "text-rose-300",
    neutral: "text-white",
    info: "text-blue-300",
  }[tone];

  return (
    <div className="rounded-2xl border border-surface-3 bg-surface-2 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function HealthStatusChip({ status }: { status: SourceHealthSnapshot["results"][number]["status"] }) {
  const tone =
    status === "ok"
      ? "success"
      : status === "degraded"
      ? "warning"
      : status === "down"
      ? "danger"
      : "neutral";

  return <StatusChip tone={tone}>{status === "ok" ? "OK" : status === "degraded" ? "Degraded" : status === "down" ? "Down" : "Unknown"}</StatusChip>;
}
