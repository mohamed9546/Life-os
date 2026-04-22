"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAIHealth } from "@/hooks/use-ai-health";
import { ActivityTimeline, Panel, ScoreMeter, SectionHeading, StatCard, StatusChip } from "@/components/ui/system";
import { StatusBadge } from "@/components/status-badge";

interface JobsResponse {
  collections: {
    raw: number;
    enriched: number;
    inbox: number;
    ranked: number;
    rejected: number;
    tracked: number;
    applied: number;
  } | null;
  sources: {
    active: number;
    total: number;
    adapters: Array<{ id: string; name: string; active: boolean }>;
  };
}

export function OverviewDashboard() {
  const { health, usage, config, loading: aiLoading, error: aiError } = useAIHealth();
  const [jobsData, setJobsData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/jobs/stats");
        const data = (await response.json()) as JobsResponse;
        setJobsData(data);
      } catch {
        setJobsData(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const openOpportunities = jobsData?.collections
    ? jobsData.collections.inbox + jobsData.collections.ranked + jobsData.collections.tracked
    : 0;

  const executionScore = useMemo(() => {
    if (!jobsData?.collections) {
      return 0;
    }

    const tracked = jobsData.collections.tracked * 10;
    const ranked = jobsData.collections.ranked * 6;
    const applied = jobsData.collections.applied * 14;
    return Math.min(100, tracked + ranked + applied);
  }, [jobsData]);

  const unresolvedLoops = [
    `${jobsData?.collections?.inbox ?? 0} jobs still need manual triage.`,
    `${jobsData?.collections?.rejected ?? 0} jobs have been rejected and can be reviewed for pattern drift.`,
    health?.available
      ? "Local AI runtime is available for structured live tasks."
      : "AI runtime needs attention before parse and evaluation flows are relied on.",
  ];

  const actionTimeline = [
    {
      id: "actions-1",
      title: "Triage ranked roles with active sources first",
      body: "Prioritize Adzuna, Reed, Greenhouse, Lever, and SerpAPI matches before spending attention on fallback feeds.",
      meta: `${jobsData?.sources.active ?? 0} configured live sources`,
      tone: "info" as const,
    },
    {
      id: "actions-2",
      title: "Keep live AI tasks on gemma4:e2b",
      body: "Interactive parsing, evaluation, and summaries should stay on the compact model to avoid local latency spikes.",
      meta: health?.primaryModel || config?.model || "model pending",
      tone: health?.available ? ("success" as const) : ("warning" as const),
    },
    {
      id: "actions-3",
      title: "Use the automation center for heavy or repeated work",
      body: "Run-now controls, policy limits, and source diagnostics now live in the mission-control surface instead of being hidden in scripts.",
      meta: "Automation",
      tone: "neutral" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel tone="hero">
          <SectionHeading
            title="Command cockpit"
            description="One operating view for weekly focus, system posture, AI health, and current job pipeline pressure."
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Weekly focus
              </p>
              <p className="mt-3 text-lg font-semibold tracking-[-0.02em] text-slate-950">
                Push strong-fit CTA and clinical operations roles through triage and follow-up.
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Keep the surface calm: core API sources first, compact AI live flows, and manual approval before action execution.
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Current operating status
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusChip tone={health?.available ? "success" : "warning"}>
                  {health?.available ? "AI live" : "AI attention needed"}
                </StatusChip>
                <StatusChip tone={(jobsData?.sources.active || 0) > 0 ? "info" : "warning"}>
                  {jobsData?.sources.active || 0}/{jobsData?.sources.total || 0} active sources
                </StatusChip>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Recommendation: work ranked jobs with current contact readiness, then run manual enrichment or outreach refresh only where it improves interviewability.
              </p>
            </div>
          </div>
        </Panel>

        <Panel tone="subtle">
          <SectionHeading
            title="AI analyst surface"
            description="Structured runtime signals, not chatbot framing."
          />
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Runtime status</p>
                <p className="mt-1 text-xs text-slate-500">
                  {aiLoading ? "Checking runtime..." : health?.endpoint || config?.baseUrl || "No endpoint"}
                </p>
              </div>
              {aiLoading ? (
                <StatusBadge status="running" label="Checking" />
              ) : health?.available ? (
                <StatusBadge status="success" label="Online" />
              ) : (
                <StatusBadge status="failed" label="Offline" />
              )}
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Live default
              </p>
              <p className="mt-3 font-mono text-sm text-slate-900">
                {health?.primaryModel || config?.model || "gemma4:e2b"}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Parse-job, evaluate-job, summarize-week, and transaction categorization should stay on the compact local model for stable latency.
              </p>
            </div>

            <ScoreMeter label="Execution score" value={executionScore} tone="info" />
            <ScoreMeter
              label="AI usage pressure"
              value={Math.min(100, Math.round(((usage?.totalCalls ?? 0) / Math.max(1, config?.maxCallsPerDay || 1)) * 100))}
              tone="warning"
            />

            {aiError ? <p className="text-sm text-rose-700">{aiError}</p> : null}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open opportunities"
          value={openOpportunities}
          hint="Inbox, ranked, and tracked roles currently in play."
        />
        <StatCard
          label="Runway"
          value="Manual"
          hint="Money runway remains available through the Money module until linked data arrives."
          tone="warning"
        />
        <StatCard
          label="Pending follow-ups"
          value={jobsData?.collections?.tracked ?? 0}
          hint="Tracked jobs are the current follow-up queue."
          tone="success"
        />
        <StatCard
          label="Weekly execution"
          value={`${executionScore}%`}
          hint="A quick composite of tracked, ranked, and applied job activity."
          tone="info"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Panel>
          <SectionHeading
            title="Today and this week"
            description="Top actions, what to ignore, and unresolved loops surfaced as structured operations."
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Top 3 actions
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <li>Review top-ranked CTA and clinical operations roles with live source coverage.</li>
                <li>Refresh outreach only for roles with strong fit and contact readiness.</li>
                <li>Run a quick settings pass if any core source shows missing config.</li>
              </ul>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                What to ignore
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <li>Heavy-model experimentation in live routes while compact inference is working.</li>
                <li>Noisy fallback boards before core sources are fully processed.</li>
                <li>Low-fit or visa-risk roles that dilute the main career lane.</li>
              </ul>
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-slate-200 bg-white px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Unresolved loops
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              {unresolvedLoops.map((loop) => (
                <li key={loop}>{loop}</li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel>
          <SectionHeading
            title="AI review surface"
            description="Short strategic synthesis and next-best actions."
            actions={<Link href="/career" className="btn-secondary btn-sm">Open Career</Link>}
          />
          <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Strategic summary
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              The operating system is in a good state when core job sources are configured, the compact AI runtime is responsive,
              and the highest-signal work stays inside structured review surfaces instead of chat-like sprawl.
            </p>
          </div>
          <div className="mt-5">
            <ActivityTimeline items={actionTimeline} />
          </div>
        </Panel>
      </div>

      <Panel>
        <SectionHeading
          title="Source coverage"
          description="Live adapter state across the job ingestion layer."
          actions={<Link href="/settings" className="btn-secondary btn-sm">Manage connectors</Link>}
        />
        {loading ? (
          <div className="mt-5">
            <StatusBadge status="running" label="Loading source map" />
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(jobsData?.sources.adapters || []).map((adapter) => (
              <div
                key={adapter.id}
                className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <p className="text-sm font-medium text-slate-900">{adapter.name}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  {adapter.id}
                </p>
                <div className="mt-4">
                  {adapter.active ? (
                    <StatusChip tone="success">Live</StatusChip>
                  ) : (
                    <StatusChip tone="neutral">Inactive</StatusChip>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
