"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Zap, RefreshCw, ExternalLink, Check, X,
  ChevronDown, Brain, Target, TrendingUp,
  Briefcase, FileText, Users, AlertTriangle,
  PlayCircle, Plus,
} from "lucide-react";
import { JobDetailPanel } from "@/components/job-detail-panel";
import {
  FilterBar as JobFilterBar,
  applyFilters,
  DEFAULT_FILTERS,
  type JobFilters,
} from "@/components/filter-bar";
import { useJobs } from "@/hooks/use-jobs";
import { usePipeline, type PipelineApiResult } from "@/hooks/use-pipeline";
import { useApi } from "@/hooks/use-api";
import {
  ApplicationLog,
  EnrichedJob,
  ParsedJobPosting,
  JobFitEvaluation,
  AIMetadata,
} from "@/types";
import {
  Panel,
  StatusChip,
  ActionButton,
  AlertBanner,
  LoadingState,
  EmptyState,
  FailureState,
  FilterBar as SysFilterBar,
} from "@/components/ui/system";
import { getRoleTrackLabel } from "@/lib/career/role-track-labels";
import { cn } from "@/lib/utils";

// ---- Types ----

type Section = "analyst" | "inbox" | "pipeline";

const PRIORITY_CHIP: Record<string, { tone: "success" | "warning" | "info" | "danger"; label: string }> = {
  high:   { tone: "success", label: "High" },
  medium: { tone: "warning", label: "Medium" },
  low:    { tone: "info",    label: "Low" },
  reject: { tone: "danger",  label: "Reject" },
};

const STAGE_DOT: Record<string, string> = {
  inbox:       "bg-slate-500",
  shortlisted: "bg-indigo-400",
  tracked:     "bg-blue-400",
  applied:     "bg-violet-400",
  interview:   "bg-amber-400",
  offer:       "bg-emerald-400",
  rejected:    "bg-rose-400",
  archived:    "bg-slate-600",
};

// ---- Main component ----

export function CareerDashboard() {
  const [section, setSection] = useState<Section>("inbox");
  const [selectedJob, setSelectedJob] = useState<EnrichedJob | null>(null);
  const [applicationLogs, setApplicationLogs] = useState<ApplicationLog[]>([]);
  const [recommendationPipelineRunning, setRecommendationPipelineRunning] = useState(false);
  const [recommendationPipelineError, setRecommendationPipelineError] = useState<string | null>(null);
  const [resettingJobs, setResettingJobs] = useState(false);
  const jobs = useJobs();
  const pipeline = usePipeline();

  const handleResetJobs = async () => {
    if (
      !window.confirm(
        "Clear all fetched jobs, inbox items, rankings, tracked items, and Gmail alert history for a fresh start?"
      )
    ) {
      return;
    }

    setResettingJobs(true);
    try {
      await jobs.resetJobs();
      setSelectedJob(null);
      await refreshApplicationLogs();
    } finally {
      setResettingJobs(false);
    }
  };

  const refreshApplicationLogs = async () => {
    try {
      const response = await fetch("/api/applications/logs");
      if (!response.ok) return;
      const data = (await response.json()) as { logs?: ApplicationLog[] };
      setApplicationLogs(data.logs || []);
    } catch {
      // Logs are supportive UI; don't block the main career dashboard.
    }
  };

  useEffect(() => {
    void refreshApplicationLogs();
  }, []);

  useEffect(() => {
    if (pipeline.lastResult) {
      void refreshApplicationLogs();
      const first = window.setTimeout(() => {
        void refreshApplicationLogs();
      }, 5000);
      const second = window.setTimeout(() => {
        void refreshApplicationLogs();
      }, 15000);
      return () => {
        window.clearTimeout(first);
        window.clearTimeout(second);
      };
    }
  }, [pipeline.lastResult]);

  const runRecommendationPipeline = async () => {
    setRecommendationPipelineRunning(true);
    setRecommendationPipelineError(null);
    try {
      const response = await fetch("/api/jobs/auto-apply-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipBrowser: true }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok || data.error) {
        throw new Error(data.error || "Recommendation pipeline failed");
      }
      await Promise.all([jobs.refresh(), refreshApplicationLogs()]);
    } catch (err) {
      setRecommendationPipelineError(
        err instanceof Error ? err.message : "Recommendation pipeline failed"
      );
    } finally {
      setRecommendationPipelineRunning(false);
    }
  };

  // Keep selectedJob in sync when jobs refresh
  useEffect(() => {
    if (!selectedJob) return;
    const all = [...jobs.inbox, ...jobs.ranked, ...jobs.tracked, ...jobs.rejected];
    const next = all.find((j) => j.id === selectedJob.id);
    if (!next) { setSelectedJob(null); return; }
    if (next !== selectedJob) setSelectedJob(next);
  }, [selectedJob, jobs.inbox, jobs.ranked, jobs.tracked, jobs.rejected]);

  const kpis = useMemo(() => {
    const ranked = jobs.ranked;
    const avgFit = ranked.length
      ? Math.round(ranked.reduce((s, j) => s + (j.fit?.data?.fitScore ?? 0), 0) / ranked.length)
      : 0;
    const highPriority = ranked.filter(
      (j) => j.fit?.data?.priorityBand === "high"
    ).length;
    const applied = jobs.tracked.filter((j) => j.status === "applied").length;
    const interviews = jobs.tracked.filter((j) => j.status === "interview").length;
    const followUpsDue = [...jobs.tracked, ...jobs.ranked].filter((j) => {
      if (!j.followUpDate) return false;
      return new Date(j.followUpDate) <= new Date();
    }).length;
    const visaRiskCount = ranked.filter(
      (j) => j.fit?.data?.visaRisk === "red" || j.fit?.data?.visaRisk === "amber"
    ).length;
    return { avgFit, highPriority, applied, interviews, followUpsDue, visaRiskCount };
  }, [jobs.ranked, jobs.tracked]);

  const allSources = useMemo(() => {
    const s = new Set<string>();
    [...jobs.inbox, ...jobs.ranked, ...jobs.tracked].forEach((j) => s.add(j.raw.source));
    return Array.from(s).sort();
  }, [jobs.inbox, jobs.ranked, jobs.tracked]);

  const hasDetail = selectedJob !== null;

  return (
    <div className="space-y-5">
      {/* Hero */}
        <CareerHero jobs={jobs} pipeline={pipeline} onResetJobs={() => void handleResetJobs()} resettingJobs={resettingJobs} />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <KpiCell label="Ranked Inbox"   value={jobs.ranked.length}  tone="info" />
        <KpiCell label="Tracked"        value={jobs.tracked.length} tone="success" />
        <KpiCell label="Avg Fit"        value={`${kpis.avgFit}`}    tone={kpis.avgFit >= 60 ? "success" : "neutral"} />
        <KpiCell label="High Priority"  value={kpis.highPriority}   tone={kpis.highPriority > 0 ? "warning" : "neutral"} />
        <KpiCell label="Applied"        value={kpis.applied}        tone="info" />
        <KpiCell label="Interviews"     value={kpis.interviews}     tone={kpis.interviews > 0 ? "warning" : "neutral"} />
        <KpiCell label="Follow-ups Due" value={kpis.followUpsDue}   tone={kpis.followUpsDue > 0 ? "danger" : "neutral"} />
        <KpiCell label="Visa Risk"      value={kpis.visaRiskCount}  tone={kpis.visaRiskCount > 0 ? "danger" : "neutral"} />
      </div>

      {/* Pipeline result banner */}
      {pipeline.running && (
        <AlertBanner
          tone="info"
          title="Pipeline running in the background"
          description={
            pipeline.activeRunId
              ? `Run ${pipeline.activeRunId} is being polled; jobs will refresh when it completes.`
              : "Starting a persisted run; jobs will refresh when it completes."
          }
        />
      )}
      {pipeline.lastResult?.summary && (
        <PipelineResultBanner result={pipeline.lastResult} />
      )}

      <AutoApplyPanel
        logs={applicationLogs}
        running={recommendationPipelineRunning}
        error={recommendationPipelineError}
        onRun={() => void runRecommendationPipeline()}
        onRefresh={() => void refreshApplicationLogs()}
        onJobsRefresh={() => void jobs.refresh()}
      />

      {/* Section nav */}
      <SysFilterBar
        options={[
          { value: "analyst", label: "AI Analyst" },
          { value: "inbox",   label: "Ranked Inbox", count: jobs.ranked.length },
          { value: "pipeline",label: "Pipeline",     count: jobs.tracked.length },
        ]}
        value={section}
        onChange={(v) => {
          setSection(v as Section);
          setSelectedJob(null);
        }}
      />

      {/* Main layout */}
      <div
        className={cn(
          "grid gap-5",
          hasDetail ? "grid-cols-1 lg:grid-cols-[1fr_380px]" : "grid-cols-1"
        )}
      >
        {/* Left content */}
        <div className="min-w-0">
          {section === "analyst" && (
            <AnalystSection onJobSaved={jobs.refresh} />
          )}
          {section === "inbox" && (
            <InboxSection
              jobs={jobs}
              sources={allSources}
              selectedJob={selectedJob}
              onSelect={setSelectedJob}
            />
          )}
          {section === "pipeline" && (
            <PipelineSection
              jobs={jobs}
              selectedJob={selectedJob}
              onSelect={setSelectedJob}
            />
          )}
        </div>

        {/* Detail rail */}
        {hasDetail && (
          <div className="min-w-0">
            <div className="space-y-3 lg:sticky lg:top-24">
              <JobDetailPanel
                job={selectedJob!}
                onTrack={jobs.trackJob}
                onReject={jobs.rejectJob}
                onUnreject={jobs.unrejectJob}
                onApply={jobs.markApplied}
                onRefreshIntel={jobs.refreshJobIntel}
                onRefreshContacts={jobs.refreshJobContacts}
                onRefreshOutreach={jobs.refreshJobOutreach}
                onRerunParse={jobs.rerunJobParse}
                onRerunFit={jobs.rerunJobFit}
                onClose={() => setSelectedJob(null)}
              />
              <CareerToolsCluster job={selectedJob!} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Hero ----

function CareerHero({
  jobs,
  pipeline,
  onResetJobs,
  resettingJobs,
}: {
  jobs: ReturnType<typeof useJobs>;
  pipeline: ReturnType<typeof usePipeline>;
  onResetJobs: () => void;
  resettingJobs: boolean;
}) {
  return (
    <Panel tone="hero" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-64 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_56%)]" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Flagship · Career Intelligence
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            Career Pipeline Manager
          </h1>
          <p className="mt-2 text-sm leading-7 text-slate-400 max-w-lg">
            Paste, rank, evaluate, and act on CTA/CRA support, QA, Regulatory, Clinical, and Medical Information roles.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusChip tone={jobs.sources.filter((s) => s.active).length > 0 ? "success" : "warning"}>
              {jobs.sources.filter((s) => s.active).length}/{jobs.sources.length} sources
            </StatusChip>
            <StatusChip tone={jobs.ranked.length > 0 ? "info" : "neutral"}>
              {jobs.ranked.length} ranked
            </StatusChip>
            {jobs.tracked.length > 0 && (
              <StatusChip tone="success">{jobs.tracked.length} tracked</StatusChip>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ActionButton
            variant="primary"
            onClick={async () => { await pipeline.runPipeline(); await jobs.refresh(); }}
            disabled={pipeline.running}
            className="gap-2"
          >
            <PlayCircle size={14} />
            {pipeline.running ? "Running…" : "Run Pipeline"}
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={async () => { await pipeline.runPipeline({ skipEnrich: true, skipRank: true }); await jobs.refresh(); }}
            disabled={pipeline.running}
          >
            Fetch Only
          </ActionButton>
          <ActionButton variant="ghost" onClick={onResetJobs} disabled={pipeline.running || resettingJobs || jobs.loading}>
            {resettingJobs ? "Clearing..." : "Start Fresh"}
          </ActionButton>
          <ActionButton variant="ghost" onClick={jobs.refresh} disabled={jobs.loading}>
            <RefreshCw size={13} />
          </ActionButton>
          {pipeline.error && (
            <span className="text-xs text-rose-400">{pipeline.error}</span>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ---- KPI cell ----

function KpiCell({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "success" | "info" | "warning" | "danger";
}) {
  const valueStyles = {
    neutral: "text-white",
    success: "text-emerald-300",
    info:    "text-blue-300",
    warning: "text-amber-300",
    danger:  "text-rose-300",
  };
  return (
    <Panel className="py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums", valueStyles[tone])}>
        {value}
      </p>
    </Panel>
  );
}

// ---- Pipeline result banner ----

function PipelineResultBanner({ result }: { result: PipelineApiResult }) {
  const s = result.summary;
  if (!s) return null;
  return (
    <AlertBanner
      tone="info"
      title={`Pipeline complete — ${s.fetched} fetched, ${s.dedupedNew} new, ${s.enriched} enriched, ${s.ranked} ranked`}
      description={[
        s.contactsGenerated > 0 ? `${s.contactsGenerated} contacts` : null,
        s.outreachGenerated > 0 ? `${s.outreachGenerated} outreach` : null,
        s.failed > 0 ? `${s.failed} failed` : null,
        result.recommendationPipeline?.drafted
          ? `${result.recommendationPipeline.drafted} Gmail drafts`
          : null,
        result.recommendationPipeline?.planned
          ? `${result.recommendationPipeline.planned} planned follow-ups`
          : null,
        result.enrichment?.fallbackCount ? `${result.enrichment.fallbackCount} fallbacks` : null,
      ].filter(Boolean).join(" · ") || undefined}
    />
  );
}

// ============================================================
// SECTION 1 — AI Job Analyst
// ============================================================

function AutoApplyPanel({
  logs,
  running,
  error,
  onRun,
  onRefresh,
  onJobsRefresh,
}: {
  logs: ApplicationLog[];
  running: boolean;
  error: string | null;
  onRun: () => void;
  onRefresh: () => void;
  onJobsRefresh: () => void;
}) {
  const [gmailStatus, setGmailStatus] = useState<{
    configured: boolean;
    connected: boolean;
    email?: string;
    error?: string;
  } | null>(null);
  const [gmailSyncRunning, setGmailSyncRunning] = useState(false);
  const [gmailSyncMessage, setGmailSyncMessage] = useState<string | null>(null);
  const latest = logs[0];
  const nextRun = latest
    ? new Date(new Date(latest.attemptedAt).getTime() + 5 * 60 * 60 * 1000)
    : null;
  const counts = {
    planned: logs.filter((log) => log.status === "planned").length,
    applied: logs.filter((log) => log.status === "applied").length,
    drafted: logs.filter((log) => log.status === "drafted").length,
    paused: logs.filter((log) => log.status === "paused").length,
    failed: logs.filter((log) => log.status === "failed").length,
  };

  useEffect(() => {
    async function loadGmailStatus() {
      try {
        const response = await fetch("/api/gmail/status");
        const data = (await response.json()) as {
          configured?: boolean;
          connected?: boolean;
          email?: string;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error || "Failed to load Gmail status");
        }
        setGmailStatus({
          configured: Boolean(data.configured),
          connected: Boolean(data.connected),
          email: data.email,
          error: data.error,
        });
      } catch (err) {
        setGmailStatus({
          configured: false,
          connected: false,
          error: err instanceof Error ? err.message : "Failed to load Gmail status",
        });
      }
    }

    void loadGmailStatus();
  }, []);

  const runGmailSync = async () => {
    setGmailSyncRunning(true);
    setGmailSyncMessage(null);
    try {
      const response = await fetch("/api/gmail/sync-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxMessages: 25 }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        processed?: number;
        imported?: number;
        error?: string;
      };
      if (!response.ok || data.success === false) {
        throw new Error(data.error || "Gmail sync failed");
      }
      setGmailSyncMessage(
        `Gmail sync checked ${data.processed ?? 0} alerts and imported ${data.imported ?? 0} jobs.`
      );
      await Promise.all([onRefresh(), onJobsRefresh()]);
    } catch (err) {
      setGmailSyncMessage(err instanceof Error ? err.message : "Gmail sync failed");
    } finally {
      setGmailSyncRunning(false);
    }
  };

  return (
    <Panel className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Job Discovery
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            Gmail + pharma/CRO recommendation pipeline
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Runs every 5 hours through the worker. It fetches jobs, ranks fit, chooses a CV, and leaves applications for manual review.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusChip
              tone={
                gmailStatus?.connected
                  ? gmailStatus?.error
                    ? "warning"
                    : "success"
                  : gmailStatus?.configured
                    ? "warning"
                    : "danger"
              }
            >
              {gmailStatus?.connected
                ? `Gmail connected${gmailStatus.email ? ` (${gmailStatus.email})` : ""}`
                : gmailStatus?.configured
                  ? "Gmail not connected"
                  : "Gmail not configured"}
            </StatusChip>
            <StatusChip tone="success">{counts.planned} planned</StatusChip>
            <StatusChip tone="neutral">{counts.applied} old applied logs</StatusChip>
            <StatusChip tone="info">{counts.drafted} drafted</StatusChip>
            <StatusChip tone="warning">{counts.paused} paused</StatusChip>
            <StatusChip tone={counts.failed > 0 ? "danger" : "neutral"}>{counts.failed} failed</StatusChip>
            {nextRun && (
              <StatusChip tone="neutral">
                Next approx {nextRun.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </StatusChip>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary" href="/api/gmail/auth/start">
            {gmailStatus?.connected ? "Reconnect Gmail" : "Connect Gmail"}
          </a>
          <ActionButton variant="secondary" onClick={() => void runGmailSync()} disabled={gmailSyncRunning}>
            <RefreshCw size={13} />
            {gmailSyncRunning ? "Syncing Gmail..." : "Sync Gmail Alerts"}
          </ActionButton>
          <ActionButton variant="secondary" onClick={onRefresh}>
            <RefreshCw size={13} />
            Refresh Logs
          </ActionButton>
          <ActionButton variant="primary" onClick={onRun} disabled={running}>
            <PlayCircle size={14} />
            {running ? "Running..." : "Run Recommendation Pipeline Now"}
          </ActionButton>
        </div>
      </div>
      {error && (
        <AlertBanner tone="danger" title="Recommendation pipeline failed" description={error} />
      )}
      {gmailStatus?.error && (
        <AlertBanner tone={gmailStatus.connected ? "warning" : "danger"} title="Gmail status" description={gmailStatus.error} />
      )}
      {gmailSyncMessage && !error && (
        <AlertBanner tone="info" title="Gmail sync" description={gmailSyncMessage} />
      )}
      <div className="space-y-3 md:hidden">
        {logs.slice(0, 8).map((log) => (
          <div key={log.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-white">{log.title}</p>
                <p className="mt-1 text-xs text-slate-500">{log.company}</p>
              </div>
              <StatusChip tone={applicationStatusTone(log.status)}>
                {log.status}
              </StatusChip>
            </div>
            <div className="mt-3 space-y-2 text-xs text-slate-400">
              <p>
                <span className="text-slate-500">When:</span>{" "}
                {new Date(log.attemptedAt).toLocaleString()}
              </p>
              <p>
                <span className="text-slate-500">CV:</span>{" "}
                {log.selectedCvPath?.split(/[\\/]/).pop() || "-"}
                {log.tailoredCvPath ? (
                  <span className="ml-2 text-emerald-300">tailored</span>
                ) : null}
              </p>
              <p>
                <span className="text-slate-500">Blocker:</span>{" "}
                {log.blocker || log.blockerDetail || "-"}
              </p>
              {log.applyUrl ? (
                <a
                  className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-200"
                  href={log.applyUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open apply URL <ExternalLink size={12} />
                </a>
              ) : null}
            </div>
          </div>
        ))}
        {logs.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-slate-500">
            No recommendations logged yet.
          </div>
        ) : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-white/10 text-[10px] uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="py-2 pr-3">When</th>
              <th className="py-2 pr-3">Job</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">CV</th>
              <th className="py-2 pr-3">Blocker</th>
              <th className="py-2 pr-3">Apply URL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {logs.slice(0, 8).map((log) => (
              <tr key={log.id} className="text-slate-300">
                <td className="py-2 pr-3 text-xs text-slate-500">
                  {new Date(log.attemptedAt).toLocaleString()}
                </td>
                <td className="py-2 pr-3">
                  <p className="font-medium text-white">{log.title}</p>
                  <p className="text-xs text-slate-500">{log.company}</p>
                </td>
                <td className="py-2 pr-3">
                  <StatusChip tone={applicationStatusTone(log.status)}>
                    {log.status}
                  </StatusChip>
                </td>
                <td className="py-2 pr-3 text-xs text-slate-400">
                  {log.selectedCvPath?.split(/[\\/]/).pop() || "-"}
                  {log.tailoredCvPath && (
                    <span className="ml-2 text-emerald-300">tailored</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs text-slate-400">
                  {log.blocker || log.blockerDetail || "-"}
                </td>
                <td className="py-2 pr-3">
                  {log.applyUrl ? (
                    <a
                      className="inline-flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200"
                      href={log.applyUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500">-</span>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                  No recommendations logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function applicationStatusTone(
  status: ApplicationLog["status"]
): "neutral" | "success" | "info" | "warning" | "danger" {
  if (status === "applied") return "success";
  if (status === "drafted" || status === "planned") return "info";
  if (status === "paused" || status === "skipped") return "warning";
  if (status === "failed") return "danger";
  return "neutral";
}

interface AnalystState {
  rawText: string;
  sourceTag: string;
  sourceLink: string;
  locationHint: string;
}

interface ParseResponse  { success: boolean; data: ParsedJobPosting;  meta: AIMetadata }
interface EvalResponse   { success: boolean; data: JobFitEvaluation;  meta: AIMetadata }
interface SaveResponse   { success: boolean }

function AnalystSection({ onJobSaved }: { onJobSaved: () => void }) {
  const [form, setForm] = useState<AnalystState>({
    rawText: "", sourceTag: "manual", sourceLink: "", locationHint: "",
  });
  const [parsed,     setParsed]     = useState<ParsedJobPosting | null>(null);
  const [evaluation, setEvaluation] = useState<JobFitEvaluation | null>(null);
  const [parseMeta,  setParseMeta]  = useState<AIMetadata | null>(null);
  const [evalMeta,   setEvalMeta]   = useState<AIMetadata | null>(null);

  const parseApi = useApi<ParseResponse>();
  const evalApi  = useApi<EvalResponse>();
  const saveApi  = useApi<SaveResponse>();

  const phase: "idle" | "parsing" | "evaluating" | "done" | "error" =
    parseApi.loading ? "parsing"
    : evalApi.loading ? "evaluating"
    : parseApi.error  ? "error"
    : parsed          ? "done"
    : "idle";

  const handleAnalyze = async () => {
    if (form.rawText.trim().length < 20) return;
    setParsed(null); setEvaluation(null);

    const r1 = await parseApi.call("/api/ai/parse-job", {
      method: "POST",
      body: JSON.stringify({ rawText: form.rawText }),
    });
    if (!r1?.success || !r1.data) return;
    setParsed(r1.data);
    setParseMeta(r1.meta);

    const r2 = await evalApi.call("/api/ai/evaluate-job", {
      method: "POST",
      body: JSON.stringify({ job: r1.data }),
    });
    if (r2?.success && r2.data) {
      setEvaluation(r2.data);
      setEvalMeta(r2.meta);
    }
  };

  const handleSave = async () => {
    if (!parsed) return;
    const result = await saveApi.call("/api/jobs/manual", {
      method: "POST",
      body: JSON.stringify({ rawText: form.rawText, parsed, evaluation }),
    });
    if (result?.success) onJobSaved();
  };

  const handleReset = () => {
    setForm({ rawText: "", sourceTag: "manual", sourceLink: "", locationHint: "" });
    setParsed(null); setEvaluation(null);
    setParseMeta(null); setEvalMeta(null);
  };

  return (
    <div className="space-y-4">
      {/* Input panel */}
      <Panel>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-white">AI Job Analyst</h2>
          </div>
          <PhaseChip phase={phase} />
        </div>

        <textarea
          className="input min-h-[140px] resize-y text-sm leading-relaxed"
          placeholder="Paste the full job posting here — title, company, requirements, responsibilities…"
          value={form.rawText}
          onChange={(e) => setForm((f) => ({ ...f, rawText: e.target.value }))}
        />

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <label className="label">Source</label>
            <input
              className="input"
              placeholder="e.g. reed.co.uk"
              value={form.sourceTag}
              onChange={(e) => setForm((f) => ({ ...f, sourceTag: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Source URL</label>
            <input
              className="input"
              placeholder="https://…"
              value={form.sourceLink}
              onChange={(e) => setForm((f) => ({ ...f, sourceLink: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Location hint</label>
            <input
              className="input"
              placeholder="e.g. Glasgow, Remote UK"
              value={form.locationHint}
              onChange={(e) => setForm((f) => ({ ...f, locationHint: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <ActionButton
            variant="primary"
            onClick={handleAnalyze}
            disabled={phase === "parsing" || phase === "evaluating" || form.rawText.trim().length < 20}
          >
            <Brain size={14} />
            {phase === "parsing" ? "Parsing…" : phase === "evaluating" ? "Evaluating…" : "Parse & Evaluate"}
          </ActionButton>
          {phase === "done" && (
            <ActionButton variant="secondary" onClick={handleSave} disabled={saveApi.loading}>
              {saveApi.loading ? "Saving…" : "Save to Inbox"}
            </ActionButton>
          )}
          {(parsed || form.rawText) && (
            <ActionButton variant="ghost" onClick={handleReset} className="text-slate-500">
              <X size={13} /> Clear
            </ActionButton>
          )}
          <span className="ml-auto text-[11px] text-slate-600 tabular-nums">
            {form.rawText.length > 0 ? `${form.rawText.length} chars` : ""}
          </span>
        </div>

        {(parseApi.error || evalApi.error) && (
          <AlertBanner tone="danger" title={parseApi.error || evalApi.error || "Analysis failed"} className="mt-3" />
        )}
        {saveApi.data?.success && (
          <AlertBanner tone="success" title="Saved to inbox" className="mt-3" />
        )}
      </Panel>

      {/* Analysis output */}
      {parsed && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Parsed summary */}
          <Panel>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-white leading-tight">
                  {parsed.title}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {parsed.company}
                  {parsed.location ? ` · ${parsed.location}` : ""}
                </p>
              </div>
              {evaluation && (
                <PriorityChip band={evaluation.priorityBand} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                ["Track", getRoleTrackLabel(parsed.roleTrack)],
                ["Remote",  parsed.remoteType],
                ["Type",    parsed.employmentType],
                ["Level",   parsed.seniority],
                ["Salary",  parsed.salaryText || "—"],
                ["Confidence", `${Math.round(parsed.confidence * 100)}%`],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
                  <p className="text-xs font-medium text-slate-300 mt-0.5 capitalize">{value}</p>
                </div>
              ))}
            </div>

            {parsed.summary && (
              <p className="text-sm text-slate-400 leading-6 mb-4">{parsed.summary}</p>
            )}

            <div className="space-y-3">
              {parsed.mustHaves.length > 0 && (
                <RequirementList label="Must haves" items={parsed.mustHaves} tone="success" />
              )}
              {parsed.niceToHaves.length > 0 && (
                <RequirementList label="Nice to haves" items={parsed.niceToHaves} tone="neutral" />
              )}
              {parsed.redFlags.length > 0 && (
                <RequirementList label="Red flags" items={parsed.redFlags} tone="danger" />
              )}
            </div>

            {parseMeta && (
              <p className="mt-4 text-[10px] font-mono text-slate-600">
                {parseMeta.model} · {parseMeta.durationMs}ms
                {parseMeta.fallbackUsed ? " · fallback" : ""}
              </p>
            )}
          </Panel>

          {/* Evaluation */}
          {evaluation ? (
            <Panel>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Fit Evaluation</h3>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-white tabular-nums">
                    {evaluation.fitScore}
                  </span>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500">FIT</p>
                    {evaluation.redFlagScore > 0 && (
                      <p className="text-xs text-rose-400">⚠ {evaluation.redFlagScore}</p>
                    )}
                  </div>
                </div>
              </div>

              <ScoreRow label="Fit" value={evaluation.fitScore} tone="success" />
              <ScoreRow label="Red flags" value={evaluation.redFlagScore} tone="danger" className="mt-2" />

              <div className="mt-4 space-y-3">
                {evaluation.whyMatched.length > 0 && (
                  <ReasonList label="Why matched" items={evaluation.whyMatched} tone="success" />
                )}
                {evaluation.whyNot.length > 0 && (
                  <ReasonList label="Concerns" items={evaluation.whyNot} tone="warning" />
                )}
              </div>

              {evaluation.strategicValue && (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Strategic value</p>
                  <p className="text-sm text-slate-300">{evaluation.strategicValue}</p>
                </div>
              )}

              {evaluation.actionRecommendation && (
                <div className="mt-3 rounded-xl border border-violet-400/20 bg-violet-400/8 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-violet-400 mb-1">Next action</p>
                  <p className="text-sm text-slate-200">{evaluation.actionRecommendation}</p>
                </div>
              )}

              {evalMeta && (
                <p className="mt-4 text-[10px] font-mono text-slate-600">
                  {evalMeta.model} · {evalMeta.durationMs}ms
                  {evalMeta.fallbackUsed ? " · fallback" : ""}
                </p>
              )}
            </Panel>
          ) : evalApi.loading ? (
            <Panel><LoadingState label="Evaluating fit…" /></Panel>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SECTION 2 — Ranked Job Inbox
// ============================================================

function InboxSection({
  jobs,
  sources,
  selectedJob,
  onSelect,
}: {
  jobs: ReturnType<typeof useJobs>;
  sources: string[];
  selectedJob: EnrichedJob | null;
  onSelect: (j: EnrichedJob | null) => void;
}) {
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);

  const sorted = useMemo(
    () =>
      [...jobs.ranked].sort(
        (a, b) => (b.fit?.data?.fitScore ?? 0) - (a.fit?.data?.fitScore ?? 0)
      ),
    [jobs.ranked]
  );

  const availableRoleTracks = useMemo(() => {
    const rankedTracks = new Set<string>();
    sorted.forEach((job) => {
      const roleTrack = job.parsed?.data?.roleTrack;
      if (roleTrack && roleTrack !== "pv") rankedTracks.add(roleTrack);
    });
    return ["clinical", "qa", "regulatory", "medinfo", "other"].filter((track) =>
      rankedTracks.has(track)
    );
  }, [sorted]);

  const filtered = useMemo(() => applyFilters(sorted, filters), [sorted, filters]);

  if (jobs.loading) {
    return <LoadingState label="Loading ranked jobs…" className="min-h-[300px]" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <JobFilterBar
          filters={filters}
          onChange={setFilters}
          availableSources={sources}
          availableRoleTracks={availableRoleTracks}
          jobCount={filtered.length}
          totalCount={sorted.length}
        />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="No ranked jobs yet"
          description="Run the pipeline to pull jobs from enabled sources and evaluate fit."
          action={<ActionButton variant="secondary" onClick={jobs.refresh}>Refresh</ActionButton>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No jobs match filters"
          description="Try loosening the fit threshold or clearing filters."
          action={
            <ActionButton variant="ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Clear filters
            </ActionButton>
          }
        />
      ) : (
        <div
          className={cn(
            "grid gap-3",
            selectedJob ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2"
          )}
        >
          {filtered.map((job) => (
            <RankedJobCard
              key={job.id}
              job={job}
              selected={selectedJob?.id === job.id}
              onSelect={onSelect}
              onTrack={() => jobs.trackJob(job.id)}
              onReject={() => jobs.rejectJob(job.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RankedJobCard({
  job,
  selected,
  onSelect,
  onTrack,
  onReject,
}: {
  job: EnrichedJob;
  selected?: boolean;
  onSelect: (j: EnrichedJob) => void;
  onTrack: () => void;
  onReject: () => void;
}) {
  const parsed = job.parsed?.data;
  const fit    = job.fit?.data;
  const title  = parsed?.title  || job.raw.title;
  const company = parsed?.company || job.raw.company;
  const location = parsed?.location || job.raw.location;

  const priorityDot = {
    high:   "bg-emerald-400",
    medium: "bg-amber-400",
    low:    "bg-blue-400",
    reject: "bg-rose-500",
  }[fit?.priorityBand ?? "low"] ?? "bg-slate-400";

  return (
    <div
      className={cn(
        "card-hover group cursor-pointer transition-all",
        selected && "border-white/25 bg-white/8"
      )}
      onClick={() => onSelect(job)}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
          <span className={cn("h-2.5 w-2.5 rounded-full", priorityDot)} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                {parsed?.roleTrack && parsed.roleTrack !== "other" && (
                  <span className="badge-neutral text-[9px]">
                    {getRoleTrackLabel(parsed.roleTrack)}
                  </span>
                )}
                <span className="badge-neutral text-[9px]">{job.raw.source}</span>
                {parsed?.remoteType === "remote" && (
                  <span className="badge-accent text-[9px]">Remote</span>
                )}
                {parsed?.remoteType === "hybrid" && (
                  <span className="badge-neutral text-[9px]">Hybrid</span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-white leading-tight">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{company}{location ? ` · ${location}` : ""}</p>
            </div>

            {fit && (
              <div className="flex flex-col items-end shrink-0 gap-0.5">
                <span className={cn(
                  "text-2xl font-bold tabular-nums leading-none",
                  fit.fitScore >= 70 ? "text-emerald-300"
                  : fit.fitScore >= 50 ? "text-amber-300"
                  : "text-slate-400"
                )}>
                  {fit.fitScore}
                </span>
                {fit.redFlagScore > 25 && (
                  <span className="text-[10px] font-semibold text-rose-400">
                    ⚠ {fit.redFlagScore}
                  </span>
                )}
                {fit.visaRisk && fit.visaRisk !== "green" && (
                    <span className={cn(
                      "text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
                      fit.visaRisk === "red" ? "bg-rose-400/15 text-rose-300"
                      : "bg-amber-400/15 text-amber-300"
                    )}>
                      Visa {fit.visaRisk}
                    </span>
                  )}
                {parsed?.salaryText && (
                  <span className="text-[10px] text-slate-600 mt-1 text-right max-w-[80px] truncate">
                    {parsed.salaryText}
                  </span>
                )}
              </div>
            )}
          </div>

          {fit?.strategicValue && (
            <p className="mt-2 text-xs text-slate-500 italic line-clamp-1">{fit.strategicValue}</p>
          )}

          {fit?.whyMatched?.length ? (
            <div className="mt-2 space-y-1">
              {fit.whyMatched.slice(0, 2).map((r, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <Check size={11} className="text-emerald-400 mt-0.5 shrink-0" />
                  <span className="text-[11px] text-slate-400 leading-4">{r}</span>
                </div>
              ))}
            </div>
          ) : null}

          {fit?.whyNot?.[0] && (
            <div className="flex items-start gap-1.5 mt-1">
              <AlertTriangle size={11} className="text-amber-400 mt-0.5 shrink-0" />
              <span className="text-[11px] text-slate-500 leading-4">{fit.whyNot[0]}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-white/8 pt-3">
        <button
          className="btn btn-secondary btn-sm"
          onClick={(e) => { e.stopPropagation(); onTrack(); }}
        >
          <Plus size={12} /> Track
        </button>
        <button
          className="btn btn-ghost btn-sm text-rose-400 hover:text-rose-300"
          onClick={(e) => { e.stopPropagation(); onReject(); }}
        >
          <X size={12} /> Reject
        </button>
        {job.raw.link && (
          <a
            href={job.raw.link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm ml-auto text-slate-500"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SECTION 3 — Tracked Pipeline
// ============================================================

const STAGE_ORDER: ReturnType<typeof useJobs>["tracked"][0]["status"][] = [
  "shortlisted", "tracked", "applied", "interview", "offer", "inbox", "archived", "rejected",
];
const STAGE_LABELS: Record<string, string> = {
  shortlisted: "Shortlisted",
  tracked:     "Tracked",
  applied:     "Applied",
  interview:   "Interview",
  offer:       "Offer",
  inbox:       "Inbox",
  archived:    "Archived",
  rejected:    "Rejected",
};

function PipelineSection({
  jobs,
  selectedJob,
  onSelect,
}: {
  jobs: ReturnType<typeof useJobs>;
  selectedJob: EnrichedJob | null;
  onSelect: (j: EnrichedJob | null) => void;
}) {
  const [stageFilter, setStageFilter] = useState<string>("all");

  const all = useMemo(
    () =>
      [...jobs.tracked, ...jobs.inbox, ...jobs.rejected]
        .filter((j, i, arr) => arr.findIndex((x) => x.id === j.id) === i)
        .sort((a, b) => (b.fit?.data?.fitScore ?? 0) - (a.fit?.data?.fitScore ?? 0)),
    [jobs.tracked, jobs.inbox, jobs.rejected]
  );

  const filtered = useMemo(
    () => stageFilter === "all" ? all : all.filter((j) => j.status === stageFilter),
    [all, stageFilter]
  );

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: all.length };
    for (const j of all) counts[j.status] = (counts[j.status] ?? 0) + 1;
    return counts;
  }, [all]);

  if (jobs.loading) return <LoadingState label="Loading pipeline…" className="min-h-[300px]" />;

  return (
    <div className="space-y-4">
      <SysFilterBar
        options={[
          { value: "all",         label: "All",         count: stageCounts.all ?? 0 },
          { value: "shortlisted", label: "Shortlisted", count: stageCounts.shortlisted ?? 0 },
          { value: "tracked",     label: "Tracked",     count: stageCounts.tracked ?? 0 },
          { value: "applied",     label: "Applied",     count: stageCounts.applied ?? 0 },
          { value: "interview",   label: "Interview",   count: stageCounts.interview ?? 0 },
          { value: "offer",       label: "Offer",       count: stageCounts.offer ?? 0 },
          { value: "inbox",       label: "Inbox",       count: stageCounts.inbox ?? 0 },
          { value: "rejected",    label: "Rejected",    count: stageCounts.rejected ?? 0 },
        ]}
        value={stageFilter}
        onChange={setStageFilter}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="No jobs in this stage"
          description="Track a ranked job to start managing your pipeline."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((job) => (
            <TrackedJobRow
              key={job.id}
              job={job}
              selected={selectedJob?.id === job.id}
              onSelect={() => onSelect(selectedJob?.id === job.id ? null : job)}
              onApply={() => jobs.markApplied(job.id)}
              onUnreject={() => jobs.unrejectJob(job.id)}
              onReject={() => jobs.rejectJob(job.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TrackedJobRow({
  job,
  selected,
  onSelect,
  onApply,
  onUnreject,
  onReject,
}: {
  job: EnrichedJob;
  selected?: boolean;
  onSelect: () => void;
  onApply: () => void;
  onUnreject: () => void;
  onReject: () => void;
}) {
  const parsed  = job.parsed?.data;
  const fit     = job.fit?.data;
  const title   = parsed?.title   || job.raw.title;
  const company = parsed?.company || job.raw.company;

  return (
    <div
      className={cn(
        "card-hover group cursor-pointer flex items-center gap-4",
        selected && "border-white/25 bg-white/8"
      )}
      onClick={onSelect}
    >
      <div className="flex flex-col items-center gap-1 shrink-0">
        <span className={cn("h-2 w-2 rounded-full", STAGE_DOT[job.status] ?? "bg-slate-500")} />
        <span className="text-[9px] uppercase tracking-wider text-slate-600 whitespace-nowrap">
          {STAGE_LABELS[job.status] || job.status}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate">{title}</p>
        <p className="text-xs text-slate-500 truncate">
          {company}
          {parsed?.roleTrack && parsed.roleTrack !== "other"
            ? ` · ${getRoleTrackLabel(parsed.roleTrack)}`
            : ""}
        </p>
        {fit?.actionRecommendation && (
          <p className="text-[11px] text-slate-600 mt-0.5 truncate">
            → {fit.actionRecommendation}
          </p>
        )}
        {job.followUpDate && (
          <p className={cn(
            "text-[10px] mt-0.5 font-medium",
            new Date(job.followUpDate) <= new Date() ? "text-rose-400" : "text-slate-500"
          )}>
            Follow-up: {new Date(job.followUpDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </p>
        )}
      </div>

      {fit && (
        <div className="flex flex-col items-end shrink-0 gap-0.5">
          <span className={cn(
            "text-base font-bold tabular-nums",
            fit.fitScore >= 70 ? "text-emerald-300"
            : fit.fitScore >= 50 ? "text-amber-300"
            : "text-slate-500"
          )}>
            {fit.fitScore}
          </span>
          <PriorityChip band={fit.priorityBand} className="text-[9px] py-0.5 px-2" />
        </div>
      )}

      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {job.status !== "applied" && (
          <button className="btn btn-ghost btn-sm text-violet-400" onClick={onApply} title="Mark applied">
            <Check size={13} />
          </button>
        )}
        {job.status === "rejected" ? (
          <button className="btn btn-ghost btn-sm text-slate-400" onClick={onUnreject} title="Unreject">
            <RefreshCw size={13} />
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm text-rose-400" onClick={onReject} title="Reject">
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Career Tools Cluster (detail rail supplement)
// ============================================================

const TOOLS = [
  { label: "Cover Letter",   href: "/career?tool=cover-letter",   icon: FileText  },
  { label: "Interview Prep", href: "/career?tool=interview",       icon: Brain     },
  { label: "Skill Gap",      href: "/career?tool=skill-gap",       icon: Target    },
  { label: "Salary",         href: "/career?tool=salary",          icon: TrendingUp },
  { label: "CV Optimizer",   href: "/career?tool=cv",              icon: Briefcase },
  { label: "Contacts",       href: "/career?tool=contacts",        icon: Users     },
];

function CareerToolsCluster({ job }: { job: EnrichedJob }) {
  const [expanded, setExpanded] = useState(false);
  const title = job.parsed?.data?.title || job.raw.title;

  return (
    <Panel tone="subtle">
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Career Tools
        </span>
        <ChevronDown
          size={14}
          className={cn("text-slate-600 transition-transform", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <a
                key={tool.label}
                href={tool.href}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-medium text-slate-400 transition-all hover:border-white/20 hover:text-white"
              >
                <Icon size={13} className="shrink-0" />
                {tool.label}
              </a>
            );
          })}
        </div>
      )}

      {expanded && (
        <p className="mt-2 text-[10px] text-slate-600">For: {title}</p>
      )}
    </Panel>
  );
}

// ============================================================
// Shared micro-components
// ============================================================

function PhaseChip({ phase }: { phase: "idle" | "parsing" | "evaluating" | "done" | "error" }) {
  if (phase === "idle") return null;
  const map = {
    parsing:    { tone: "info"    as const, label: "Parsing…" },
    evaluating: { tone: "info"    as const, label: "Evaluating…" },
    done:       { tone: "success" as const, label: "Done" },
    error:      { tone: "danger"  as const, label: "Failed" },
  };
  const { tone, label } = map[phase];
  return <StatusChip tone={tone}>{label}</StatusChip>;
}

function PriorityChip({ band, className }: { band?: string; className?: string }) {
  if (!band) return null;
  const cfg = PRIORITY_CHIP[band];
  if (!cfg) return null;
  return (
    <StatusChip tone={cfg.tone} className={className}>
      {cfg.label}
    </StatusChip>
  );
}

function ScoreRow({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "info" | "warning" | "neutral";
  className?: string;
}) {
  const barColor = {
    success: "bg-emerald-400",
    danger:  "bg-rose-400",
    info:    "bg-blue-400",
    warning: "bg-amber-400",
    neutral: "bg-slate-400",
  }[tone];
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
        <span className="text-xs font-mono text-slate-300">{value}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

function RequirementList({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "success" | "danger" | "neutral";
}) {
  const dotColor = { success: "text-emerald-400", danger: "text-rose-400", neutral: "text-slate-500" }[tone];
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">{label}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <span className={cn("mt-0.5 shrink-0 text-[10px]", dotColor)}>
              {tone === "success" ? "✓" : tone === "danger" ? "!" : "·"}
            </span>
            <span className="text-xs text-slate-400 leading-4">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReasonList({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "success" | "warning";
}) {
  const Icon = tone === "success" ? Check : AlertTriangle;
  const iconClass = tone === "success" ? "text-emerald-400" : "text-amber-400";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5">{label}</p>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <Icon size={11} className={cn("mt-0.5 shrink-0", iconClass)} />
            <span className="text-xs text-slate-400 leading-4">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
