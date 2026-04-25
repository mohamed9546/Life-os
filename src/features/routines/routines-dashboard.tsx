"use client";

import { useEffect, useMemo, useState } from "react";
import { Routine, RoutineCheckIn } from "@/types";
import { StatusBadge } from "@/components/status-badge";
import { DeepWorkTracker } from "./deep-work-tracker";
import { HabitHeatmap } from "./habit-heatmap";

type RoutinesTab = "routines" | "deep-work" | "heatmap";
const ROUTINES_TABS: { id: RoutinesTab; label: string }[] = [
  { id: "routines", label: "Routines" },
  { id: "deep-work", label: "Deep Work" },
  { id: "heatmap", label: "Heatmap" },
];

interface RoutinesResponse {
  routines: Routine[];
  checkIns: RoutineCheckIn[];
  summary: {
    total: number;
    enabled: number;
    dueToday: number;
    completedToday: number;
  };
  analytics?: {
    consistencyScore: number;
    completedLast7Days: number;
    skippedLast7Days: number;
    dueToday: number;
    skippedLoopWarnings: string[];
    nextBestAction: string;
  };
}

const INITIAL_FORM = {
  title: "",
  description: "",
  area: "career" as Routine["area"],
  cadence: "daily" as Routine["cadence"],
  aiPrompt: "",
};

export function RoutinesDashboard() {
  const [activeTab, setActiveTab] = useState<RoutinesTab>("routines");
  const [data, setData] = useState<RoutinesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [latestInsight, setLatestInsight] = useState<{
    insight: { data: { nextBestAction: string; skippedLoopWarnings: string[]; consistencyScore: number } };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/routines");
      const payload = (await response.json()) as RoutinesResponse | { error?: string };
      if (!response.ok || !("routines" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Failed to load routines");
      }
      setData(payload);
      const insightResponse = await fetch("/api/routines/insights");
      const insightPayload = (await insightResponse.json()) as
        | { latestInsight?: { insight: { data: { nextBestAction: string; skippedLoopWarnings: string[]; consistencyScore: number } } } | null }
        | { error?: string };
      if (insightResponse.ok && "latestInsight" in insightPayload) {
        setLatestInsight(insightPayload.latestInsight || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load routines");
    } finally {
      setLoading(false);
    }
  };

  const generateInsight = async () => {
    setInsightLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/routines/insights", { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to generate routine insight");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate routine insight");
    } finally {
      setInsightLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const submit = async () => {
    if (!form.title.trim()) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          area: form.area,
          cadence: form.cadence,
          aiPrompt: form.aiPrompt.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save routine");
      }
      setForm(INITIAL_FORM);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save routine");
    } finally {
      setSaving(false);
    }
  };

  const checkIn = async (routineId: string, status: "completed" | "skipped") => {
    setCheckingIn(`${routineId}:${status}`);
    setError(null);
    try {
      const response = await fetch("/api/routines/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routineId, status }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update routine");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update routine");
    } finally {
      setCheckingIn(null);
    }
  };

  const recentCheckIns = useMemo(() => (data?.checkIns || []).slice(0, 12), [data]);
  const routineTitles = useMemo(
    () =>
      new Map((data?.routines || []).map((routine) => [routine.id, routine.title])),
    [data]
  );

  if (loading && !data) {
    return (
      <div className="card text-center py-12">
        <StatusBadge status="running" label="Loading routines..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1">
        {ROUTINES_TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`min-w-fit flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all sm:min-w-0 ${activeTab === tab.id ? "bg-surface-0 text-text-primary shadow-sm" : "text-text-tertiary hover:text-text-primary"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "deep-work" && <DeepWorkTracker goals={[]} />}
      {activeTab === "heatmap" && <HabitHeatmap checkIns={data?.checkIns ?? []} />}

      {activeTab === "routines" && <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard label="Total routines" value={String(data?.summary.total || 0)} />
        <SummaryCard label="Enabled" value={String(data?.summary.enabled || 0)} />
        <SummaryCard label="Due today" value={String(data?.summary.dueToday || 0)} />
        <SummaryCard label="Completed today" value={String(data?.summary.completedToday || 0)} />
      </div>

      <section className="card space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Routine analytics
            </h2>
            <p className="text-sm text-text-secondary mt-2">
              Turn routine check-ins into operating-system signals for Life OS and next-step guidance.
            </p>
          </div>
          <button className="btn-secondary btn-sm w-full sm:w-auto" onClick={generateInsight} disabled={insightLoading}>
            {insightLoading ? "Generating..." : "Generate AI routine focus"}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Consistency score"
            value={String(data?.analytics?.consistencyScore || 0)}
          />
          <SummaryCard
            label="Completed 7d"
            value={String(data?.analytics?.completedLast7Days || 0)}
          />
          <SummaryCard
            label="Skipped 7d"
            value={String(data?.analytics?.skippedLast7Days || 0)}
          />
          <SummaryCard label="Due today" value={String(data?.analytics?.dueToday || 0)} />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-lg bg-surface-2 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
              Skipped-loop warnings
            </p>
            {(latestInsight?.insight.data.skippedLoopWarnings ||
              data?.analytics?.skippedLoopWarnings ||
              []).length === 0 ? (
              <p className="text-sm text-text-secondary">No repeated skipped loops detected.</p>
            ) : (
              <ul className="space-y-2 text-sm text-text-secondary">
                {(latestInsight?.insight.data.skippedLoopWarnings ||
                  data?.analytics?.skippedLoopWarnings ||
                  []).map((item, index) => (
                  <li key={`${item}-${index}`} className="rounded-lg bg-surface-1 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg bg-accent-subtle px-4 py-3">
            <p className="text-xs font-semibold text-accent mb-1">Next best action</p>
            <p className="text-sm text-text-primary">
              {latestInsight?.insight.data.nextBestAction ||
                data?.analytics?.nextBestAction ||
                "No AI routine focus yet."}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
        <section className="card space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Build a routine
            </h2>
            <p className="text-sm text-text-secondary mt-2">
              Turn repeated actions into structured check-ins so Career, Money, and Life OS have better behavioral data to work from.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Title</label>
              <input
                className="input"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Morning application review"
              />
            </div>
            <div>
              <label className="label">Area</label>
              <select
                className="input"
                value={form.area}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    area: event.target.value as Routine["area"],
                  }))
                }
              >
                <option value="career">Career</option>
                <option value="money">Money</option>
                <option value="life">Life</option>
                <option value="health">Health</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Cadence</label>
              <select
                className="input"
                value={form.cadence}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    cadence: event.target.value as Routine["cadence"],
                  }))
                }
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="label">AI note</label>
              <input
                className="input"
                value={form.aiPrompt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, aiPrompt: event.target.value }))
                }
                placeholder="What should the AI watch for?"
              />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="textarea"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Describe the repeatable routine and the outcome you want."
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button className="btn-primary w-full sm:w-auto" onClick={submit} disabled={saving}>
              {saving ? "Saving..." : "Save routine"}
            </button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        </section>

        <section className="card">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            Recent check-ins
          </h2>
          <div className="space-y-3 mt-4">
            {recentCheckIns.length === 0 ? (
              <p className="text-sm text-text-secondary">
                No routine check-ins yet. Mark a routine complete to start building habit data.
              </p>
            ) : (
              recentCheckIns.map((entry) => (
                <div key={entry.id} className="rounded-lg bg-surface-2 px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={entry.status === "completed" ? "success" : "skipped"} />
                    <span className="text-2xs text-text-tertiary">
                      {new Date(entry.completedAt).toLocaleString("en-GB")}
                    </span>
                  </div>
                  <p className="text-sm text-text-primary mt-2">
                    {routineTitles.get(entry.routineId) || entry.routineId}
                  </p>
                  {entry.note && <p className="text-sm text-text-secondary mt-1">{entry.note}</p>}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="space-y-4">
        {(data?.routines || []).length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-sm text-text-secondary">
              No routines yet. Add one above to start tracking repeated actions across the OS.
            </p>
          </div>
        ) : (
          data!.routines.map((routine) => (
            <div key={routine.id} className="card">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge-neutral">{routine.area}</span>
                    <span className="badge-neutral">{routine.cadence}</span>
                    <span className="badge-neutral">
                      {routine.enabled ? "enabled" : "disabled"}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mt-2">{routine.title}</h3>
                  {routine.description && (
                    <p className="text-sm text-text-secondary mt-2">{routine.description}</p>
                  )}
                  <div className="flex items-center gap-3 flex-wrap mt-3 text-2xs text-text-tertiary">
                    <span>Streak {routine.streak}</span>
                    <span>
                      Last complete{" "}
                      {routine.lastCompletedAt
                        ? new Date(routine.lastCompletedAt).toLocaleString("en-GB")
                        : "never"}
                    </span>
                  </div>
                  {routine.aiPrompt && (
                    <div className="rounded-lg bg-accent-subtle px-3 py-2 mt-3">
                      <p className="text-2xs font-semibold text-accent mb-1">AI context</p>
                      <p className="text-sm text-text-primary">{routine.aiPrompt}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    className="btn-primary btn-sm w-full sm:w-auto"
                    onClick={() => void checkIn(routine.id, "completed")}
                    disabled={checkingIn !== null}
                  >
                    {checkingIn === `${routine.id}:completed` ? "Saving..." : "Complete"}
                  </button>
                  <button
                    className="btn-secondary btn-sm w-full sm:w-auto"
                    onClick={() => void checkIn(routine.id, "skipped")}
                    disabled={checkingIn !== null}
                  >
                    {checkingIn === `${routine.id}:skipped` ? "Saving..." : "Skip"}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </section>
      </>}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
        {label}
      </p>
      <p className="text-2xl font-bold mt-3 text-text-primary">{value}</p>
    </div>
  );
}
