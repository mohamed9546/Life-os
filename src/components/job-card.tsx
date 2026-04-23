"use client";

import { useState } from "react";
import { EnrichedJob } from "@/types";
import { PriorityBadge } from "./priority-badge";
import { ScoreBar } from "./score-bar";
import {
  getBestContact,
  getContactFreshness,
  getJobContactState,
  getJobRankingState,
} from "@/lib/jobs/selectors";

interface JobCardProps {
  job: EnrichedJob;
  onTrack?: (id: string) => void;
  onReject?: (id: string) => void;
  onSelect?: (job: EnrichedJob) => void;
  selected?: boolean;
  compact?: boolean;
}

export function JobCard({
  job,
  onTrack,
  onReject,
  onSelect,
  selected,
  compact,
}: JobCardProps) {
  const [contactsExpanded, setContactsExpanded] = useState(false);
  const parsed = job.parsed?.data;
  const fit = job.fit?.data;
  const title = parsed?.title || job.raw.title;
  const company = parsed?.company || job.raw.company;
  const location = parsed?.location || job.raw.location;
  const source = job.raw.source;
  const hasIntel = Boolean(job.companyIntel);
  const contactCount = job.decisionMakers?.length || 0;
  const bestContact = getBestContact(job);
  const contactFreshness = getContactFreshness(job);
  const contactState = getJobContactState(job);
  const rankingState = getJobRankingState(job);

  if (compact) {
    return (
      <div
        className={`card-hover cursor-pointer ${selected ? "border-accent bg-surface-2" : ""}`}
        onClick={() => onSelect?.(job)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-text-primary truncate">{title}</h3>
            <p className="text-xs text-text-secondary mt-0.5 truncate">
              {company} - {location}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <SourceBadge source={source} />
              {parsed?.roleTrack && parsed.roleTrack !== "other" && (
                <span className="badge-neutral">{parsed.roleTrack}</span>
              )}
              {parsed?.remoteType && parsed.remoteType !== "unknown" && (
                <span className="badge-neutral">{parsed.remoteType}</span>
              )}
              {fit?.visaRisk && (
                <span className={`px-1.5 py-0.5 rounded text-2xs font-medium ${
                  fit.visaRisk === 'red' ? 'bg-danger/10 text-danger' : 
                  fit.visaRisk === 'amber' ? 'bg-warning/10 text-warning' : 
                  'bg-success/10 text-success'
                }`}>
                  Visa: {fit.visaRisk}
                </span>
              )}
              {hasIntel && <span className="badge-neutral">intel</span>}
              <span className="badge-neutral">
                {contactCount > 0 ? `${contactCount} contacts` : "No contacts"}
              </span>
              {bestContact?.title && (
                <span className="badge-neutral truncate max-w-40">{bestContact.title}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {fit && <PriorityBadge band={fit.priorityBand} />}
            {fit && <span className="text-xs font-mono text-text-tertiary">{fit.fitScore}</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card animate-fade-in">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <SourceBadge source={source} />
            {parsed?.roleTrack && parsed.roleTrack !== "other" && (
              <span className="badge-neutral">{parsed.roleTrack}</span>
            )}
            {fit?.visaRisk && (
              <span className={`px-1.5 py-0.5 rounded text-2xs font-medium ${
                fit.visaRisk === 'red' ? 'bg-danger/10 text-danger' : 
                fit.visaRisk === 'amber' ? 'bg-warning/10 text-warning' : 
                'bg-success/10 text-success'
              }`}>
                Visa: {fit.visaRisk}
              </span>
            )}
            <span className="badge-neutral">{contactState}</span>
          </div>
          <h3 className="text-base font-bold text-text-primary">{title}</h3>
          <p className="text-sm text-text-secondary mt-0.5">
            {company} - {location}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {fit && <PriorityBadge band={fit.priorityBand} />}
          {job.raw.postedAt && (
            <span className="text-2xs text-text-tertiary">{formatTimeAgo(job.raw.postedAt)}</span>
          )}
        </div>
      </div>

      {fit && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <ScoreBar score={fit.fitScore} label="Fit Score" />
          <ScoreBar
            score={fit.redFlagScore}
            label="Red Flags"
            colorClass={
              fit.redFlagScore > 50
                ? "bg-danger"
                : fit.redFlagScore > 25
                  ? "bg-warning"
                  : "bg-success"
            }
          />
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary mb-3">
        {parsed?.employmentType && parsed.employmentType !== "unknown" && (
          <span>{parsed.employmentType}</span>
        )}
        {parsed?.seniority && <span>{parsed.seniority}</span>}
        {parsed?.remoteType && parsed.remoteType !== "unknown" && <span>{parsed.remoteType}</span>}
        {parsed?.salaryText && <span className="text-success">{parsed.salaryText}</span>}
        {job.companyIntel?.industry && <span>{job.companyIntel.industry}</span>}
        {job.companyIntel?.employeeRange && <span>{job.companyIntel.employeeRange}</span>}
        <span>{rankingState}</span>
      </div>

      {parsed?.summary && (
        <p className="text-xs text-text-secondary mb-3 line-clamp-2">{parsed.summary}</p>
      )}

      {fit && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          {fit.whyMatched.length > 0 && (
            <div>
              <p className="text-2xs font-semibold text-success mb-1">Why Matched</p>
              <ul className="text-2xs text-success/80 space-y-0.5">
                {fit.whyMatched.slice(0, 3).map((reason, index) => (
                  <li key={`${job.id}-match-${index}`} className="truncate">
                    - {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {fit.whyNot.length > 0 && (
            <div>
              <p className="text-2xs font-semibold text-warning mb-1">Concerns</p>
              <ul className="text-2xs text-warning/80 space-y-0.5">
                {fit.whyNot.slice(0, 3).map((reason, index) => (
                  <li key={`${job.id}-concern-${index}`} className="truncate">
                    - {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {fit?.actionRecommendation && (
        <div className="bg-accent-subtle rounded-lg px-3 py-2 mb-3">
          <p className="text-2xs font-semibold text-accent mb-0.5">Recommended</p>
          <p className="text-xs text-text-primary">{fit.actionRecommendation}</p>
        </div>
      )}

      <div className="bg-surface-2 rounded-lg px-3 py-2 mb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-2xs font-semibold text-text-primary">Contact Strategy</p>
          <div className="flex items-center gap-2 flex-wrap">
            {bestContact?.email && <span className="badge-neutral">Email ready</span>}
            {job.outreachStrategy?.emailDraft && <span className="badge-neutral">Draft ready</span>}
          </div>
        </div>
        {bestContact ? (
          <>
            <p className="text-xs text-text-primary mt-1">
              {bestContact.fullName} · {bestContact.title}
            </p>
            {bestContact.email ? (
              <a
                href={`mailto:${bestContact.email}`}
                className="block text-2xs text-accent mt-1 break-all"
              >
                {bestContact.email}
              </a>
            ) : (
              <p className="text-2xs text-text-secondary mt-1">
                No verified email yet. Use LinkedIn or refresh contacts.
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-text-secondary mt-1">
            No decision maker attached yet. Refresh contacts or rerun outreach for this role.
          </p>
        )}
        {contactFreshness.isStale && (
          <p className="text-2xs text-warning mt-1">
            Contacts are stale and should be refreshed.
          </p>
        )}
        {contactCount > 0 && (
          <button
            className="btn-ghost btn-sm mt-3"
            onClick={() => setContactsExpanded((current) => !current)}
          >
            {contactsExpanded ? "Hide contact tray" : "Show contact tray"}
          </button>
        )}
      </div>

      {contactsExpanded && contactCount > 0 && (
        <div className="bg-surface-2 rounded-lg px-3 py-2 mb-3">
          <p className="text-2xs font-semibold text-text-primary mb-2">People to contact</p>
          <div className="space-y-2">
            {(job.decisionMakers || []).slice(0, 3).map((contact) => (
              <div key={contact.id} className="rounded-lg bg-surface-1 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-text-primary">{contact.fullName}</p>
                    <p className="text-2xs text-text-secondary mt-1">{contact.title}</p>
                  </div>
                  {contact.email && <span className="badge-neutral">Email</span>}
                </div>
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="block text-2xs text-accent mt-1 break-all"
                  >
                    {contact.email}
                  </a>
                )}
                {!contact.email && contact.linkedinUrl && (
                  <a
                    href={contact.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-2xs text-accent mt-1 break-all"
                  >
                    LinkedIn profile
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-surface-3">
        {onTrack && job.status !== "tracked" && (
          <button className="btn-primary btn-sm" onClick={() => onTrack(job.id)}>
            Track
          </button>
        )}
        {onReject && job.status !== "rejected" && (
          <button className="btn-danger btn-sm" onClick={() => onReject(job.id)}>
            Reject
          </button>
        )}
        {job.raw.link && (
          <a
            href={job.raw.link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost btn-sm ml-auto"
          >
            Open
          </a>
        )}
      </div>

      {parsed?.keywords && parsed.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3 pt-2 border-t border-surface-3">
          {parsed.keywords.slice(0, 8).map((keyword, index) => (
            <span key={`${job.id}-keyword-${index}`} className="badge-neutral text-2xs">
              {keyword}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    linkedin: "bg-blue-500/10 text-blue-400",
    "rapidapi-linkedin": "bg-blue-500/10 text-blue-400",
    adzuna: "bg-emerald-500/10 text-emerald-400",
    reed: "bg-orange-500/10 text-orange-400",
    serpapi: "bg-slate-900/10 text-slate-700",
    greenhouse: "bg-green-500/10 text-green-400",
    lever: "bg-purple-500/10 text-purple-400",
    remotive: "bg-cyan-500/10 text-cyan-400",
    arbeitnow: "bg-yellow-500/10 text-yellow-400",
    himalayas: "bg-teal-500/10 text-teal-400",
    brightnetwork: "bg-sky-500/10 text-sky-400",
    indeed: "bg-indigo-500/10 text-indigo-400",
    findwork: "bg-pink-500/10 text-pink-400",
    manual: "bg-surface-3 text-text-secondary",
    scraper: "bg-gray-500/10 text-gray-400",
  };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium ${colors[source] || "bg-surface-3 text-text-tertiary"}`}
    >
      {source}
    </span>
  );
}

function formatTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
