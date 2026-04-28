"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ActionButton, AlertBanner, Panel } from "@/components/ui/system";
import {
  ApplicationOutcomeSnapshot,
  CvVersionPerformanceEntry,
  CvVersionRecommendation,
} from "@/types";

type OutcomesResponse = {
  ok: boolean;
  snapshot: ApplicationOutcomeSnapshot | null;
  error?: string;
};

export function ApplicationOutcomesPanel() {
  const [snapshot, setSnapshot] = useState<ApplicationOutcomeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSnapshot() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/applications/outcomes", { cache: "no-store" });
      const payload = (await response.json()) as OutcomesResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to load application outcomes");
      }
      setSnapshot(payload.snapshot || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load application outcomes");
    } finally {
      setLoading(false);
    }
  }

  async function rebuildSnapshot() {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/applications/outcomes", { method: "POST" });
      const payload = (await response.json()) as OutcomesResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to rebuild application outcomes");
      }
      setSnapshot(payload.snapshot || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rebuild application outcomes");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadSnapshot();
  }, []);

  const overview = snapshot?.summaries.overall || null;
  const bestSource = useMemo(() => pickBestSummary(snapshot?.summaries.bySource || []), [snapshot]);
  const bestTrack = useMemo(() => pickBestSummary(snapshot?.summaries.byTrack || []), [snapshot]);
  const bestCvVersion = useMemo(
    () => snapshot?.summaries.cvPerformance?.recommendations.global || null,
    [snapshot]
  );
  const recentRecords = useMemo(
    () => (snapshot?.records || []).filter((record) => record.recordKind === "application_attempt").slice(0, 5),
    [snapshot]
  );

  return (
    <Panel className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Outcome ETL
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">Application outcomes and conversion signal</h2>
          <p className="mt-1 text-sm text-slate-400">
            Read-only local analytics over application attempts, current pipeline state, follow-up pressure, and conversion by source, track, CV, company, and recruiter.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {snapshot?.generatedAt ? (
            <span className="text-xs text-slate-500">
              Updated {new Date(snapshot.generatedAt).toLocaleString("en-GB")}
            </span>
          ) : null}
          <ActionButton variant="secondary" onClick={() => void rebuildSnapshot()} disabled={refreshing} className="gap-2">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : snapshot ? "Refresh outcomes" : "Build outcomes"}
          </ActionButton>
        </div>
      </div>

      {error ? <AlertBanner tone="danger" title="Application outcomes" description={error} /> : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-7 w-10 animate-pulse rounded bg-white/10" />
            </div>
          ))}
        </div>
      ) : snapshot && overview ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <OutcomeStatCard label="Total attempts" value={overview.attemptRecords} />
            <OutcomeStatCard label="Responses" value={overview.responded} tone="info" />
            <OutcomeStatCard label="Interviews" value={overview.interviews} tone="warning" />
            <OutcomeStatCard label="Rejections" value={overview.rejections} tone="danger" />
            <OutcomeStatCard label="Offers" value={overview.offers} tone="success" />
            <OutcomeStatCard label="Ghosted" value={overview.ghosted} tone={overview.ghosted > 0 ? "danger" : "neutral"} />
            <OutcomeStatCard label="Follow-ups due" value={overview.followUpDue} tone={overview.followUpDue > 0 ? "warning" : "neutral"} />
            <OutcomeStatCard label="Applied base" value={overview.appliedAttempts} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <SummaryCard
              title="Best source"
              label={bestSource?.label || "No attempt data yet"}
              meta={bestSource ? `${bestSource.responded}/${bestSource.appliedAttempts} responded` : "Build a snapshot after draft/apply activity."}
            />
            <SummaryCard
              title="Best track"
              label={bestTrack?.label || "No track signal yet"}
              meta={bestTrack ? `${bestTrack.responded}/${bestTrack.appliedAttempts} responded` : "Awaiting enough attempt history."}
            />
            <SummaryCard
              title="Recommended CV"
              label={bestCvVersion?.cvVersion || "No strong CV signal yet"}
              meta={
                bestCvVersion
                  ? `${bestCvVersion.responseCount}/${bestCvVersion.attemptCount} responded · ${bestCvVersion.responseRate}% response`
                  : "Recommendation appears only with 6+ attempts and a >=10-point lead."
              }
            />
          </div>

          <CvPerformanceSection snapshot={snapshot} />

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Recent attempt rows</p>
            {recentRecords.length > 0 ? (
              recentRecords.map((record) => (
                <div key={record.recordId} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{record.roleTitle}</p>
                      <p className="mt-1 text-xs text-slate-400 truncate">
                        {record.company} · {record.source} · {record.cvVersion}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <Pill label={record.currentStatus} />
                      {record.responseReceived ? <Pill label="responded" tone="success" /> : null}
                      {record.followUpStage ? <Pill label={`${record.followUpStage} follow-up`} tone="warning" /> : null}
                      {record.ghosted ? <Pill label="ghosted" tone="danger" /> : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-400">
                No application-attempt rows yet. The ETL will still surface tracked or shortlisted pipeline pressure once data exists.
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-400">
          No stored outcomes snapshot yet. Run the ETL to create a local read-only snapshot.
        </div>
      )}
    </Panel>
  );
}

function pickBestSummary(entries: ApplicationOutcomeSnapshot["summaries"]["bySource"]) {
  return [...entries]
    .filter((entry) => entry.appliedAttempts > 0 && entry.responseRate != null)
    .sort((left, right) => {
      const responseDelta = (right.responseRate || 0) - (left.responseRate || 0);
      if (responseDelta !== 0) return responseDelta;
      return right.appliedAttempts - left.appliedAttempts;
    })[0] || null;
}

export function CvPerformanceSection({ snapshot }: { snapshot: ApplicationOutcomeSnapshot }) {
  const byVersion = snapshot.summaries.cvPerformance?.byVersion || [];
  const byTrack = snapshot.summaries.cvPerformance?.byTrack || [];
  const insufficientSampleCount = byVersion.filter(
    (entry) => entry.confidenceLevel === "insufficient_sample"
  ).length;
  const noResponseCount = byVersion.filter((entry) => entry.responseCount === 0).length;
  const directionalCount = byVersion.filter((entry) => entry.confidenceLevel === "directional").length;
  const topEntries = byVersion.slice(0, 4);
  const trackLeaders = pickTrackLeaders(byTrack).slice(0, 4);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <SummaryCard
          title="CV sample coverage"
          label={`${byVersion.length} tracked version${byVersion.length === 1 ? "" : "s"}`}
          meta={`${insufficientSampleCount} insufficient-sample · ${directionalCount} directional`}
        />
        <SummaryCard
          title="No response yet"
          label={`${noResponseCount} CV version${noResponseCount === 1 ? "" : "s"}`}
          meta="Counts versions that have attempt data but zero responses so far."
        />
        <SummaryCard
          title="Unknown CV usage"
          label={`${byVersion.find((entry) => entry.cvVersion === "unknown")?.attemptCount || 0} attempts`}
          meta="Unknown CV remains visible until attribution discipline improves."
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">CV evidence</p>
        {topEntries.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No CV attempt data yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {topEntries.map((entry) => (
              <div key={`${entry.scope}-${entry.scopeValue}-${entry.cvVersion}`} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{entry.cvVersion}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {entry.attemptCount} attempts · {entry.responseCount} responses · {entry.responseRate ?? 0}% response · {entry.interviewCount} interviews · {entry.interviewRate ?? 0}% interview
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <Pill label={entry.confidenceLevel.replace(/_/g, " ")} tone={entry.confidenceLevel === "stronger_signal" ? "success" : entry.confidenceLevel === "directional" ? "warning" : "danger"} />
                    {entry.recommendation ? <Pill label="recommended" tone="success" /> : null}
                  </div>
                </div>
                {entry.sampleSizeWarning ? (
                  <p className="mt-2 text-xs text-amber-300">{entry.sampleSizeWarning}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Track-specific CV performance</p>
        {trackLeaders.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No track-specific CV evidence yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {trackLeaders.map((entry) => (
              <div key={`${entry.scopeValue}-${entry.cvVersion}`} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <p className="text-sm font-medium text-white">{entry.scopeLabel}: {entry.cvVersion}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {entry.attemptCount} attempts · {entry.responseCount} responses · {entry.responseRate ?? 0}% response
                </p>
                {entry.sampleSizeWarning ? (
                  <p className="mt-2 text-xs text-amber-300">{entry.sampleSizeWarning}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function pickTrackLeaders(entries: CvVersionPerformanceEntry[]) {
  const byTrack = new Map<string, CvVersionPerformanceEntry[]>();
  for (const entry of entries) {
    const current = byTrack.get(entry.scopeValue) || [];
    current.push(entry);
    byTrack.set(entry.scopeValue, current);
  }

  return Array.from(byTrack.values())
    .map((trackEntries) =>
      [...trackEntries].sort((left, right) => {
        const responseDelta = (right.responseRate || 0) - (left.responseRate || 0);
        if (responseDelta !== 0) return responseDelta;
        return right.attemptCount - left.attemptCount;
      })[0]
    )
    .filter((entry): entry is CvVersionPerformanceEntry => Boolean(entry));
}

function OutcomeStatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "danger" | "success" | "info";
}) {
  const toneClass =
    tone === "danger"
      ? "text-rose-300"
      : tone === "warning"
        ? "text-amber-300"
        : tone === "success"
          ? "text-emerald-300"
          : tone === "info"
            ? "text-blue-300"
            : "text-white";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function SummaryCard({ title, label, meta }: { title: string; label: string; meta: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
      <p className="mt-2 text-sm font-medium text-white">{label}</p>
      <p className="mt-1 text-xs text-slate-400">{meta}</p>
    </div>
  );
}

function Pill({
  label,
  tone = "info",
}: {
  label: string;
  tone?: "info" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-300"
      : tone === "warning"
        ? "bg-amber-500/10 text-amber-300"
        : tone === "danger"
          ? "bg-rose-500/10 text-rose-300"
          : "bg-blue-500/10 text-blue-300";

  return <span className={`rounded-full px-2 py-1 font-semibold uppercase tracking-[0.18em] ${toneClass}`}>{label}</span>;
}
