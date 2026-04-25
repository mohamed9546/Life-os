"use client";

import { useEffect, useState } from "react";
import { AIResult, WeeklyReview } from "@/types";
import { StatusBadge } from "@/components/status-badge";
import { LifeBalanceWheel } from "./life-balance-wheel";
import { LifeOSScore } from "./life-os-score";
import { MorningBriefing } from "./morning-briefing";
import { LifeTimeline } from "./life-timeline";
import { WeeklyReview as WeeklyReviewForm } from "./weekly-review";
import { SmartTaskPrioritizer } from "./smart-task-prioritizer";
import { LifeOSExport } from "./life-os-export";

type LifeOSTab = "weekly" | "balance" | "score" | "briefing" | "timeline" | "review" | "tasks" | "export";
const LIFE_OS_TABS: { id: LifeOSTab; label: string }[] = [
  { id: "weekly", label: "Weekly Review" },
  { id: "balance", label: "Balance Wheel" },
  { id: "score", label: "OS Score" },
  { id: "briefing", label: "Morning Brief" },
  { id: "timeline", label: "Life Timeline" },
  { id: "review", label: "Review Form" },
  { id: "tasks", label: "Task Prioritizer" },
  { id: "export", label: "Export" },
];

interface WeeklyReviewEntry {
  id: string;
  review: AIResult<WeeklyReview>;
  input: {
    jobsReviewed: number;
    jobsTracked: number;
    jobsApplied: number;
    transactionCount: number;
    totalSpend: number;
    openDecisions: number;
    completedDecisions: number;
  };
  createdAt: string;
}

interface WeeklyReviewResponse {
  entries: WeeklyReviewEntry[];
  comparison?: {
    repeatedRisks: string[];
    repeatedFocusThemes: string[];
    risingSignals: string[];
    changedSignals: string[];
  } | null;
}

export function LifeOSDashboard() {
  const [activeTab, setActiveTab] = useState<LifeOSTab>("weekly");
  const [entries, setEntries] = useState<WeeklyReviewEntry[]>([]);
  const [comparison, setComparison] = useState<WeeklyReviewResponse["comparison"]>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/life-os/weekly-review");
      const payload = (await response.json()) as WeeklyReviewResponse | { error?: string };
      if (!response.ok || !("entries" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Failed to load reviews");
      }
      setEntries(payload.entries);
      setComparison(payload.comparison || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/life-os/weekly-review", {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to generate weekly review");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate weekly review");
    } finally {
      setGenerating(false);
    }
  };

  const latest = entries[0];

  if (loading && entries.length === 0) {
    return (
      <div className="card text-center py-12">
        <StatusBadge status="running" label="Loading Life OS review..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1">
        {LIFE_OS_TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`min-w-fit flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all sm:min-w-0 ${activeTab === tab.id ? "bg-surface-0 text-text-primary shadow-sm" : "text-text-tertiary hover:text-text-primary"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "balance" && <LifeBalanceWheel />}
      {activeTab === "score" && <LifeOSScore />}
      {activeTab === "briefing" && <MorningBriefing />}
      {activeTab === "timeline" && <LifeTimeline />}
      {activeTab === "review" && <WeeklyReviewForm />}
      {activeTab === "tasks" && <SmartTaskPrioritizer />}
      {activeTab === "export" && <LifeOSExport />}

      {activeTab === "weekly" && <>
      <section className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Weekly review engine
            </h2>
            <p className="text-sm text-text-secondary mt-2">
              This pulls together your current Career, Money, and Decisions data into one AI weekly review.
            </p>
          </div>
          <button className="btn-primary w-full sm:w-auto" onClick={generate} disabled={generating}>
            {generating ? "Generating..." : "Generate weekly review"}
          </button>
        </div>
        {error && <p className="text-sm text-danger mt-4">{error}</p>}
      </section>

      {latest ? (
        <section className="card space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Latest weekly review</h2>
              <p className="text-sm text-text-secondary mt-1">
                {new Date(latest.createdAt).toLocaleString("en-GB")}
              </p>
            </div>
            <span className="badge-neutral">
              confidence {(latest.review.meta.confidence * 100).toFixed(0)}%
            </span>
          </div>

          <div className="rounded-lg bg-accent-subtle px-4 py-3">
            <p className="text-xs font-semibold text-accent mb-1">Weekly summary</p>
            <p className="text-sm text-text-primary">{latest.review.data.weeklySummary}</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ReviewList title="Wins" items={latest.review.data.wins || []} />
            <ReviewList title="Risks" items={latest.review.data.risks || []} />
            <ReviewList title="Recommended focus" items={latest.review.data.recommendedFocus || []} />
            <ReviewList title="What to ignore" items={latest.review.data.whatToIgnore || []} />
            <ReviewList title="Unfinished loops" items={latest.review.data.unfinishedLoops || []} />
            <ReviewList
              title="Next week operating focus"
              items={latest.review.data.nextWeekOperatingFocus || []}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <AdviceCard title="Energy advice" value={latest.review.data.energyAdvice} />
            <AdviceCard title="Job search advice" value={latest.review.data.jobSearchAdvice} />
            <AdviceCard title="Money advice" value={latest.review.data.moneyAdvice} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SnapshotCard label="Jobs reviewed" value={String(latest.input.jobsReviewed)} />
            <SnapshotCard label="Jobs tracked" value={String(latest.input.jobsTracked)} />
            <SnapshotCard label="Transactions" value={String(latest.input.transactionCount)} />
            <SnapshotCard label="Open decisions" value={String(latest.input.openDecisions)} />
          </div>

          {comparison && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <ReviewList title="Repeated risks" items={comparison.repeatedRisks} />
              <ReviewList title="Repeated focus themes" items={comparison.repeatedFocusThemes} />
              <ReviewList title="Rising signals" items={comparison.risingSignals} />
              <ReviewList title="Changed signals" items={comparison.changedSignals} />
            </div>
          )}
        </section>
      ) : (
        <div className="card text-center py-12">
          <p className="text-sm text-text-secondary">
            No weekly review yet. Generate one once you have some jobs, transactions, or decisions in the system.
          </p>
        </div>
      )}

      {entries.length > 1 && (
        <section className="card">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            Review history
          </h2>
          <div className="space-y-3 mt-4">
            {entries.slice(1).map((entry) => (
              <div key={entry.id} className="rounded-lg bg-surface-2 px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {new Date(entry.createdAt).toLocaleString("en-GB")}
                    </p>
                    <p className="text-sm text-text-secondary mt-2">
                      {entry.review.data.weeklySummary}
                    </p>
                  </div>
                  <span className="badge-neutral">
                    {(entry.review.meta.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      </>}
    </div>
  );
}

function ReviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
        {title}
      </p>
      <ul className="space-y-2 text-sm text-text-secondary">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="rounded-lg bg-surface-2 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdviceCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
        {title}
      </p>
      <p className="text-sm text-text-secondary">{value}</p>
    </div>
  );
}

function SnapshotCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-4 py-3">
      <p className="text-2xs font-semibold uppercase tracking-wider text-text-tertiary">
        {label}
      </p>
      <p className="text-lg font-semibold text-text-primary mt-2">{value}</p>
    </div>
  );
}
