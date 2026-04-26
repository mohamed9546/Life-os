"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertBanner, Panel } from "@/components/ui/system";

type OpsLane = "primary" | "secondary" | "all";

interface AppsStatusResponse {
  generatedAt: string;
  totals: {
    tracked: number;
    applied: number;
    interview: number;
    offer: number;
    rejected: number;
    drafted: number;
    planned: number;
    paused: number;
    ghosted: number;
    followUpFirstDue: number;
    followUpSecondDue: number;
  };
  candidates: Array<{
    dedupeKey: string;
    title: string;
    company: string;
    sourceLabel: string;
    appStatus: string;
    pipelineStatus: string;
    fitScore: number | null;
    daysSilent: number | null;
    followUpStage: "first" | "second" | null;
    ghosted: boolean;
    lane: "primary" | "secondary" | "off-target";
  }>;
}

export function OpenCodeAppsStatusPanel() {
  const [data, setData] = useState<AppsStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lane, setLane] = useState<OpsLane>("primary");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/opencode/apps-status", { cache: "no-store" });
        const payload = (await response.json()) as AppsStatusResponse | { error?: string };
        if (!response.ok || !("totals" in payload)) {
          throw new Error(("error" in payload && payload.error) || "Failed to load application ops status");
        }
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load application ops status");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <Panel className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Application Ops
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">Follow-up radar and outcome state</h2>
          <p className="mt-1 text-sm text-slate-400">
            Track which applications are alive, ghosted, or due for a first or second follow-up.
          </p>
        </div>
        {data?.generatedAt && (
          <span className="text-xs text-slate-500">
            Updated {new Date(data.generatedAt).toLocaleString("en-GB")}
          </span>
        )}
      </div>

      {error && <AlertBanner tone="danger" title="Application ops" description={error} />}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-6 w-10 animate-pulse rounded bg-white/10" />
            </div>
          ))}
        </div>
      ) : data ? (
        <>
          <div className="flex flex-wrap gap-2">
            <LaneButton active={lane === "primary"} onClick={() => setLane("primary")}>CTA-first ops</LaneButton>
            <LaneButton active={lane === "secondary"} onClick={() => setLane("secondary")}>Secondary lane ops</LaneButton>
            <LaneButton active={lane === "all"} onClick={() => setLane("all")}>All application ops</LaneButton>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <StatCard label="Applied" value={data.totals.applied} />
            <StatCard label="Interview" value={data.totals.interview} />
            <StatCard label="Offer" value={data.totals.offer} />
            <StatCard label="Ghosted" value={data.totals.ghosted} tone="danger" />
            <StatCard label="Follow-up day 8" value={data.totals.followUpFirstDue} tone="warning" />
            <StatCard label="Follow-up day 18" value={data.totals.followUpSecondDue} tone="warning" />
          </div>

          <div className="space-y-2">
            {filterOpsCandidates(data.candidates, lane).slice(0, 8).map((item) => (
              <div key={item.dedupeKey} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-400 truncate">
                      {item.company} · {item.sourceLabel}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <Pill label={item.appStatus} />
                    <Pill label={item.pipelineStatus} subtle />
                    <Pill label={item.lane === "primary" ? "CTA-first" : item.lane === "secondary" ? "Secondary" : "Other"} subtle />
                    {item.fitScore != null ? <Pill label={`Fit ${item.fitScore}`} subtle /> : null}
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {item.followUpStage === "second"
                    ? `Second follow-up due after ${item.daysSilent ?? 0} days of silence.`
                    : item.followUpStage === "first"
                    ? `First follow-up due after ${item.daysSilent ?? 0} days of silence.`
                    : item.ghosted
                    ? `Likely ghosted after ${item.daysSilent ?? 0} days.`
                    : item.daysSilent != null
                    ? `${item.daysSilent} days since last application action.`
                    : "No application action logged yet."}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </Panel>
  );
}

function filterOpsCandidates(candidates: AppsStatusResponse["candidates"], lane: OpsLane) {
  if (lane === "all") {
    return candidates;
  }
  if (lane === "primary") {
    return candidates.filter((item) => item.lane === "primary");
  }
  return candidates.filter((item) => item.lane === "secondary");
}

function LaneButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${active ? "bg-violet-500/15 text-violet-200" : "bg-white/5 text-slate-400 hover:text-slate-200"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "danger";
}) {
  const toneClass = tone === "danger" ? "text-rose-300" : tone === "warning" ? "text-amber-300" : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function Pill({ label, subtle = false }: { label: string; subtle?: boolean }) {
  return (
    <span className={`rounded-full px-2 py-1 font-semibold uppercase tracking-[0.18em] ${subtle ? "bg-white/5 text-slate-400" : "bg-blue-500/10 text-blue-300"}`}>
      {label}
    </span>
  );
}
