"use client";

import { useEffect, useState } from "react";

interface MonthReviewResponse {
  generatedAt: string;
  month: string;
  metrics: {
    applicationsDrafted: number;
    applicationsApplied: number;
    interviews: number;
    offers: number;
    followUpsDue: number;
    ghosted: number;
    deepWorkHours: number;
    journalEntries: number;
    paperNotes: number;
    regulatoryDigests: number;
    shutdownEntries: number;
  };
  highlights: string[];
}

export function OpenCodeMonthReview() {
  const [data, setData] = useState<MonthReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/opencode/month-review", { cache: "no-store" });
        const payload = (await response.json()) as MonthReviewResponse | { error?: string };
        if (!response.ok || !("metrics" in payload)) {
          throw new Error(("error" in payload && payload.error) || "Failed to load month review");
        }
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load month review");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  if (loading) {
    return (
      <div className="card py-12 text-center text-sm text-text-secondary">
        Building this month&apos;s review...
      </div>
    );
  }

  if (error) {
    return (
      <div className="card py-12 text-center text-sm text-danger">
        {error}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-5">
      <section className="card space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Month review</h2>
            <p className="text-sm text-text-secondary mt-1">
              Operational metrics across applications, deep work, and knowledge capture for {data.month}.
            </p>
          </div>
          <span className="badge-neutral">
            {new Date(data.generatedAt).toLocaleString("en-GB")}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <MetricCard label="Drafted" value={String(data.metrics.applicationsDrafted)} />
          <MetricCard label="Applied" value={String(data.metrics.applicationsApplied)} />
          <MetricCard label="Interviews" value={String(data.metrics.interviews)} />
          <MetricCard label="Follow-ups due" value={String(data.metrics.followUpsDue)} />
          <MetricCard label="Ghosted" value={String(data.metrics.ghosted)} />
          <MetricCard label="Deep work" value={`${data.metrics.deepWorkHours}h`} />
          <MetricCard label="Journal" value={String(data.metrics.journalEntries)} />
          <MetricCard label="Paper notes" value={String(data.metrics.paperNotes)} />
          <MetricCard label="Reg digests" value={String(data.metrics.regulatoryDigests)} />
          <MetricCard label="Shutdowns" value={String(data.metrics.shutdownEntries)} />
        </div>
      </section>

      <section className="card">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
          Highlights
        </h3>
        <ul className="space-y-3 mt-4 text-sm text-text-secondary">
          {data.highlights.map((item, index) => (
            <li key={index} className="rounded-lg bg-surface-2 px-4 py-3">
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-4 py-3">
      <p className="text-2xs font-semibold uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="text-lg font-semibold text-text-primary mt-2">{value}</p>
    </div>
  );
}
