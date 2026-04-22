"use client";

import { useState } from "react";
import { formatDistanceToNow, subDays, isAfter } from "date-fns";
import { Briefcase, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

interface Job {
  id: string;
  title: string;
  company: string;
  status?: string;
  trackedAt?: string;
  appliedAt?: string;
  fitScore?: number;
  [key: string]: unknown;
}

const STATUS_COLORS: Record<string, string> = {
  tracked:   "bg-accent",
  applied:   "bg-warning",
  interview: "bg-success",
  offer:     "bg-success",
  rejected:  "bg-danger",
  inbox:     "bg-text-tertiary",
  ranked:    "bg-info",
};

const FILTERS = [
  { label: "7d",  days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 9999 },
];

export function JobTimeline({ jobs }: { jobs: Job[] }) {
  const [filterIdx, setFilterIdx] = useState(1);
  const [selected, setSelected] = useState<Job | null>(null);

  const cutoff = subDays(new Date(), FILTERS[filterIdx].days);
  const filtered = jobs
    .filter(j => {
      const d = j.trackedAt ?? j.appliedAt;
      return d && isAfter(new Date(d), cutoff);
    })
    .sort((a, b) => {
      const da = a.trackedAt ?? a.appliedAt ?? "";
      const db = b.trackedAt ?? b.appliedAt ?? "";
      return db.localeCompare(da);
    });

  return (
    <div className="flex gap-6">
      {/* Timeline */}
      <div className="flex-1 min-w-0">
        {/* Filter */}
        <div className="flex items-center gap-1 mb-6">
          {FILTERS.map((f, i) => (
            <button
              key={f.label}
              onClick={() => setFilterIdx(i)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterIdx === i
                  ? "bg-accent-subtle text-accent border border-accent/20"
                  : "text-text-tertiary hover:text-text-primary hover:bg-surface-2"
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-text-tertiary">{filtered.length} events</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Briefcase} title="No activity in this period" description="Try a wider time range." />
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-surface-3" />

            <div className="space-y-4">
              {filtered.map((job) => {
                const date = job.trackedAt ?? job.appliedAt ?? "";
                const status = job.status ?? "inbox";
                const isSelected = selected?.id === job.id;
                return (
                  <div
                    key={job.id}
                    className="flex gap-4 cursor-pointer"
                    onClick={() => setSelected(isSelected ? null : job)}
                  >
                    {/* Node */}
                    <div
                      className={`timeline-node flex-shrink-0 mt-1 z-10 ${STATUS_COLORS[status] ?? "bg-text-tertiary"} ${
                        isSelected ? "ring-2 ring-offset-2 ring-offset-surface-0 ring-accent" : ""
                      }`}
                    />
                    {/* Content */}
                    <div
                      className={`flex-1 card py-3 px-4 transition-all duration-150 ${
                        isSelected ? "border-accent/30 shadow-glow" : "hover:border-surface-4"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{job.title}</p>
                          <p className="text-xs text-text-secondary mt-0.5">{job.company}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`badge ${STATUS_COLORS[status]?.replace("bg-", "badge-") ?? "badge-neutral"}`}>
                            {status}
                          </span>
                          {date && (
                            <span className="text-2xs text-text-tertiary whitespace-nowrap">
                              {formatDistanceToNow(new Date(date), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && job.fitScore != null && (
                        <div className="mt-3 pt-3 border-t border-surface-3 flex items-center gap-2">
                          <span className="text-2xs text-text-tertiary">Fit score</span>
                          <div className="flex-1 progress-bar">
                            <div
                              className={`progress-fill ${(job.fitScore as number) >= 70 ? "bg-success" : (job.fitScore as number) >= 40 ? "bg-warning" : "bg-danger"}`}
                              style={{ width: `${job.fitScore}%` }}
                            />
                          </div>
                          <span className="text-2xs font-mono text-text-secondary">{job.fitScore}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
