"use client";

import {
  DEFAULT_VISIBLE_ROLE_TRACKS,
  getRoleTrackLabel,
} from "@/lib/career/role-track-labels";
import { getContactFreshness, hasOutreachDraft } from "@/lib/jobs/selectors";
import { getSourceLabel } from "@/lib/jobs/source-meta";

export interface JobFilters {
  query: string;
  source: string;
  fetchedWindow: string;
  roleTrack: string;
  remoteType: string;
  employmentType: string;
  priorityBand: string;
  contactState: string;
  minScore: number;
}

export const DEFAULT_FILTERS: JobFilters = {
  query: "",
  source: "all",
  fetchedWindow: "all",
  roleTrack: "all",
  remoteType: "all",
  employmentType: "all",
  priorityBand: "all",
  contactState: "all",
  minScore: 0,
};

interface FilterBarProps {
  filters: JobFilters;
  onChange: (filters: JobFilters) => void;
  availableSources: string[];
  availableRoleTracks: string[];
  jobCount: number;
  totalCount: number;
}

export function FilterBar({
  filters,
  onChange,
  availableSources,
  availableRoleTracks,
  jobCount,
  totalCount,
}: FilterBarProps) {
  const update = (patch: Partial<JobFilters>) => {
    onChange({ ...filters, ...patch });
  };

  const hasFilters =
    filters.query.trim().length > 0 ||
    filters.source !== "all" ||
    filters.fetchedWindow !== "all" ||
    filters.roleTrack !== "all" ||
    filters.remoteType !== "all" ||
    filters.employmentType !== "all" ||
    filters.priorityBand !== "all" ||
    filters.contactState !== "all" ||
    filters.minScore > 0;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-3 py-3 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
      <input
        className="input min-w-[14rem] flex-1 text-xs"
        value={filters.query}
        onChange={(e) => update({ query: e.target.value })}
        placeholder="Search title, company, location"
      />

      <select
        className="input w-36 text-xs"
        value={filters.source}
        onChange={(e) => update({ source: e.target.value })}
      >
        <option value="all">All Sources</option>
        <option value="gmail">Gmail Alerts</option>
        {[...availableSources].sort((left, right) =>
          getSourceLabel(left).localeCompare(getSourceLabel(right))
        ).map((s) => (
          <option key={s} value={s}>
            {getSourceLabel(s)}
          </option>
        ))}
      </select>

      <select
        className="input w-36 text-xs"
        value={filters.fetchedWindow}
        onChange={(e) => update({ fetchedWindow: e.target.value })}
      >
        <option value="all">Any fetch date</option>
        <option value="3d">Last 3 days</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
      </select>

      <select
        className="input w-36 text-xs"
        value={filters.roleTrack}
        onChange={(e) => update({ roleTrack: e.target.value })}
      >
        <option value="all">All Career Paths</option>
        {(availableRoleTracks.length > 0
          ? availableRoleTracks
          : [...DEFAULT_VISIBLE_ROLE_TRACKS]
        ).map((track) => (
          <option key={track} value={track}>
            {getRoleTrackLabel(track)}
          </option>
        ))}
      </select>

      <select
        className="input w-36 text-xs"
        value={filters.remoteType}
        onChange={(e) => update({ remoteType: e.target.value })}
      >
        <option value="all">All Remote</option>
        <option value="remote">Remote</option>
        <option value="hybrid">Hybrid</option>
        <option value="onsite">Onsite</option>
      </select>

      <select
        className="input w-36 text-xs"
        value={filters.employmentType}
        onChange={(e) => update({ employmentType: e.target.value })}
      >
        <option value="all">All Types</option>
        <option value="permanent">Permanent</option>
        <option value="contract">Contract</option>
        <option value="temp">Temporary</option>
      </select>

      <select
        className="input w-36 text-xs"
        value={filters.priorityBand}
        onChange={(e) => update({ priorityBand: e.target.value })}
      >
        <option value="all">All Priority</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
        <option value="reject">Reject</option>
      </select>

      <select
        className="input w-48 text-xs"
        value={filters.contactState}
        onChange={(e) => update({ contactState: e.target.value })}
      >
        <option value="all">All Contact States</option>
        <option value="has-contacts">Has contacts</option>
        <option value="has-email">Has email</option>
        <option value="has-draft">Outreach draft</option>
        <option value="needs-refresh">Needs refresh</option>
        <option value="unscored">Unscored</option>
      </select>

      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Min score
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={filters.minScore}
          onChange={(e) => update({ minScore: parseInt(e.target.value) })}
          className="w-20 accent-accent"
        />
        <span className="w-6 text-xs font-mono text-slate-700">
          {filters.minScore}
        </span>
      </div>

      {hasFilters && (
        <>
          <button
            className="btn-ghost text-xs px-2 py-1"
            onClick={() => onChange(DEFAULT_FILTERS)}
          >
            Clear filters
          </button>
          {jobCount !== totalCount && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              {jobCount} of {totalCount}
            </span>
          )}
        </>
      )}
    </div>
  );
}

export function applyFilters(
  jobs: import("@/types").EnrichedJob[],
  filters: JobFilters
): import("@/types").EnrichedJob[] {
  return jobs.filter((job) => {
    if (filters.query.trim()) {
      const parsed = job.parsed?.data;
      const haystack = [
        parsed?.title,
        job.raw.title,
        parsed?.company,
        job.raw.company,
        parsed?.location,
        job.raw.location,
        parsed?.summary,
        job.raw.source,
      ]
        .filter(Boolean)
        .join("\n")
        .toLowerCase();
      if (!haystack.includes(filters.query.trim().toLowerCase())) return false;
    }
    if (filters.source === "gmail") {
      if (!job.raw.source.startsWith("gmail-")) return false;
    } else if (filters.source !== "all" && job.raw.source !== filters.source) {
      return false;
    }
    if (filters.fetchedWindow !== "all") {
      const days = parseInt(filters.fetchedWindow.replace(/\D/g, ""), 10);
      const fetchedAt = new Date(job.raw.fetchedAt).getTime();
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      if (Number.isNaN(fetchedAt) || fetchedAt < cutoff) return false;
    }
    if (
      filters.roleTrack !== "all" &&
      job.parsed?.data?.roleTrack !== filters.roleTrack
    )
      return false;
    if (filters.remoteType !== "all") {
      const remote = job.parsed?.data?.remoteType || "unknown";
      if (remote !== filters.remoteType) return false;
    }
    if (filters.employmentType !== "all") {
      const emp = job.parsed?.data?.employmentType || "unknown";
      if (emp !== filters.employmentType) return false;
    }
    if (filters.priorityBand !== "all") {
      const band = job.fit?.data?.priorityBand;
      if (band !== filters.priorityBand) return false;
    }
    if (filters.contactState === "has-contacts" && (job.decisionMakers?.length || 0) === 0)
      return false;
    if (
      filters.contactState === "has-email" &&
      !(job.decisionMakers || []).some((person) => Boolean(person.email))
    )
      return false;
    if (filters.contactState === "has-draft" && !hasOutreachDraft(job))
      return false;
    if (filters.contactState === "needs-refresh" && !getContactFreshness(job).isStale)
      return false;
    if (filters.contactState === "unscored" && job.fit?.data)
      return false;
    if (filters.minScore > 0 && (job.fit?.data?.fitScore || 0) < filters.minScore)
      return false;
    return true;
  });
}
