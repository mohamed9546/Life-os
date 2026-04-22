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
  hasOutreachDraft,
} from "@/lib/jobs/selectors";

interface JobDetailPanelProps {
  job: EnrichedJob;
  onTrack?: (id: string) => Promise<void> | void;
  onReject?: (id: string) => Promise<void> | void;
  onUnreject?: (id: string) => Promise<void> | void;
  onApply?: (id: string) => Promise<void> | void;
  onRefreshIntel?: (id: string) => Promise<void> | void;
  onRefreshContacts?: (id: string) => Promise<void> | void;
  onRefreshOutreach?: (id: string) => Promise<void> | void;
  onRerunParse?: (id: string) => Promise<void> | void;
  onRerunFit?: (id: string) => Promise<void> | void;
  onClose: () => void;
}

export function JobDetailPanel({
  job,
  onTrack,
  onReject,
  onUnreject,
  onApply,
  onRefreshIntel,
  onRefreshContacts,
  onRefreshOutreach,
  onRerunParse,
  onRerunFit,
  onClose,
}: JobDetailPanelProps) {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [tailorCvLoading, setTailorCvLoading] = useState(false);
  const [tailorCvError, setTailorCvError] = useState<string | null>(null);
  const [introState, setIntroState] = useState<
    Record<string, { loading: boolean; text: string | null; error: string | null }>
  >({});
  const parsed = job.parsed?.data;
  const fit = job.fit?.data;
  const title = parsed?.title || job.raw.title;
  const company = parsed?.company || job.raw.company;
  const location = parsed?.location || job.raw.location;
  const bestContact = getBestContact(job);
  const contactFreshness = getContactFreshness(job);
  const contactState = getJobContactState(job);
  const rankingState = getJobRankingState(job);

  const runAction = async (
    actionId: string,
    handler?: (id: string) => Promise<void> | void
  ) => {
    if (!handler) {
      return;
    }

    try {
      setActiveAction(actionId);
      await handler(job.id);
    } finally {
      setActiveAction(null);
    }
  };

  const handleTailorCV = async () => {
    setTailorCvLoading(true);
    setTailorCvError(null);
    try {
      const response = await fetch("/api/jobs/tailor-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "CV generation failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cv-${(parsed?.company || "tailored").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setTailorCvError(err instanceof Error ? err.message : "CV generation failed");
    } finally {
      setTailorCvLoading(false);
    }
  };

  const handleGenerateIntro = async (personId: string) => {
    setIntroState((prev) => ({ ...prev, [personId]: { loading: true, text: null, error: null } }));
    try {
      const response = await fetch("/api/ai/linkedin-intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId, jobId: job.id }),
      });
      const data = (await response.json()) as { intro?: string; charCount?: number; error?: string };
      if (!response.ok || data.error) throw new Error(data.error || "Failed to generate intro");
      setIntroState((prev) => ({
        ...prev,
        [personId]: { loading: false, text: data.intro ?? null, error: null },
      }));
    } catch (err) {
      setIntroState((prev) => ({
        ...prev,
        [personId]: {
          loading: false,
          text: null,
          error: err instanceof Error ? err.message : "Failed",
        },
      }));
    }
  };

  return (
    <div className="card overflow-y-auto max-h-[calc(100vh-8rem)] animate-fade-in">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <SourceChip source={job.raw.source} />
            {parsed?.roleTrack && parsed.roleTrack !== "other" && (
              <span className="badge-neutral">{parsed.roleTrack}</span>
            )}
            {parsed?.remoteType && parsed.remoteType !== "unknown" && (
              <span className="badge-neutral">{parsed.remoteType}</span>
            )}
            {parsed?.employmentType && parsed.employmentType !== "unknown" && (
              <span className="badge-neutral">{parsed.employmentType}</span>
            )}
            {parsed?.seniority && <span className="badge-neutral">{parsed.seniority}</span>}
            <StatusChip status={job.status} />
          </div>
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            {company} - {location}
          </p>
          {parsed?.salaryText && (
            <p className="text-sm font-medium text-success mt-1">{parsed.salaryText}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {fit && <PriorityBadge band={fit.priorityBand} />}
          {job.raw.postedAt && (
            <span className="text-2xs text-text-tertiary">
              {formatDate(job.raw.postedAt)}
            </span>
          )}
          <button
            className="text-xs text-text-tertiary hover:text-text-primary mt-1"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {fit && (
        <div className="grid grid-cols-2 gap-4 mb-5">
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

      {fit?.actionRecommendation && (
        <div className="bg-accent-subtle rounded-lg px-4 py-3 mb-5">
          <p className="text-xs font-semibold text-accent mb-1">AI Recommendation</p>
          <p className="text-sm text-text-primary">{fit.actionRecommendation}</p>
        </div>
      )}

      <div className="rounded-lg border border-surface-3 bg-surface-2 px-4 py-3 mb-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-text-primary">Contact readiness</p>
            <p className="text-sm text-text-secondary mt-1">{contactState}</p>
          </div>
          <div className="text-right">
            <p className="text-2xs text-text-tertiary">Ranking state</p>
            <p className="text-sm text-text-primary mt-1">{rankingState}</p>
          </div>
        </div>
        {bestContact && (
          <div className="mt-3">
            <p className="text-sm text-text-primary">
              {bestContact.fullName} · {bestContact.title}
            </p>
            {bestContact.email && (
              <a href={`mailto:${bestContact.email}`} className="block text-xs text-accent mt-1">
                {bestContact.email}
              </a>
            )}
            {contactFreshness.isStale && (
              <p className="text-2xs text-warning mt-2">
                Stored contacts are older than 14 days and should be refreshed.
              </p>
            )}
          </div>
        )}
      </div>

      {fit && (fit.whyMatched.length > 0 || fit.whyNot.length > 0) && (
        <div className="grid grid-cols-2 gap-4 mb-5">
          {fit.whyMatched.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-success mb-2">
                Why Matched ({fit.whyMatched.length})
              </p>
              <ul className="text-xs text-success/80 space-y-1">
                {fit.whyMatched.map((reason, index) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          {fit.whyNot.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-warning mb-2">
                Concerns ({fit.whyNot.length})
              </p>
              <ul className="text-xs text-warning/80 space-y-1">
                {fit.whyNot.map((reason, index) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {fit && (fit.strategicValue || fit.likelyInterviewability) && (
        <div className="grid grid-cols-2 gap-4 mb-5">
          {fit.strategicValue && (
            <InfoBlock title="Strategic Value" value={fit.strategicValue} />
          )}
          {fit.likelyInterviewability && (
            <InfoBlock title="Interviewability" value={fit.likelyInterviewability} />
          )}
        </div>
      )}

      {parsed?.redFlags && parsed.redFlags.length > 0 && (
        <div className="bg-danger-muted rounded-lg px-4 py-3 mb-5">
          <p className="text-xs font-semibold text-danger mb-2">
            Red Flags ({parsed.redFlags.length})
          </p>
          <ul className="text-xs text-danger/80 space-y-1">
            {parsed.redFlags.map((flag, index) => (
              <li key={index}>{flag}</li>
            ))}
          </ul>
        </div>
      )}

      {parsed &&
        ((parsed.mustHaves?.length || 0) > 0 || (parsed.niceToHaves?.length || 0) > 0) && (
          <div className="grid grid-cols-2 gap-4 mb-5">
            {parsed.mustHaves && parsed.mustHaves.length > 0 && (
              <ListBlock title={`Must Haves (${parsed.mustHaves.length})`} items={parsed.mustHaves} />
            )}
            {parsed.niceToHaves && parsed.niceToHaves.length > 0 && (
              <ListBlock title={`Nice to Haves (${parsed.niceToHaves.length})`} items={parsed.niceToHaves} />
            )}
          </div>
        )}

      {parsed?.summary && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-text-primary mb-1.5">AI Summary</p>
          <p className="text-sm text-text-secondary leading-relaxed">{parsed.summary}</p>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {onRerunParse && (
          <button
            className="btn-ghost btn-sm"
            onClick={() => void runAction("rerun-parse", onRerunParse)}
            disabled={activeAction !== null}
          >
            {activeAction === "rerun-parse" ? "Re-running Parse..." : "Re-run Parse"}
          </button>
        )}
        {onRerunFit && (
          <button
            className="btn-ghost btn-sm"
            onClick={() => void runAction("rerun-fit", onRerunFit)}
            disabled={activeAction !== null}
          >
            {activeAction === "rerun-fit" ? "Re-running Fit..." : "Re-run Fit"}
          </button>
        )}
        {onRefreshIntel && (
          <button
            className="btn-ghost btn-sm"
            onClick={() => void runAction("refresh-intel", onRefreshIntel)}
            disabled={activeAction !== null}
          >
            {activeAction === "refresh-intel" ? "Refreshing Intel..." : "Refresh Company Intel"}
          </button>
        )}
        {onRefreshContacts && (
          <button
            className="btn-ghost btn-sm"
            onClick={() => void runAction("refresh-contacts", onRefreshContacts)}
            disabled={activeAction !== null}
          >
            {activeAction === "refresh-contacts"
              ? "Refreshing Contacts..."
              : contactFreshness.isStale
                ? "Refresh Contacts"
                : "Refresh Decision Makers"}
          </button>
        )}
        {onRefreshOutreach && (
          <button
            className="btn-ghost btn-sm"
            onClick={() => void runAction("refresh-outreach", onRefreshOutreach)}
            disabled={activeAction !== null}
          >
            {activeAction === "refresh-outreach"
              ? "Refreshing Outreach..."
              : "Refresh Outreach Plan"}
          </button>
        )}
      </div>

      {(job.decisionMakers && job.decisionMakers.length > 0) && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-text-primary mb-2">
            People to Contact ({job.decisionMakers.length})
          </p>
          <div className="space-y-2">
            {job.decisionMakers.slice(0, 5).map((person) => (
              <div
                key={person.id}
                className="rounded-lg bg-surface-2 px-3 py-2 text-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-text-primary">{person.fullName}</p>
                    <p className="text-text-secondary mt-1">{person.title}</p>
                  </div>
                  {bestContact?.id === person.id && (
                    <span className="badge-neutral">Best contact</span>
                  )}
                </div>
                {person.email && (
                  <a
                    href={`mailto:${person.email}`}
                    className="block text-accent mt-1 break-all"
                  >
                    {person.email}
                  </a>
                )}
                {!person.email && person.linkedinUrl && (
                  <a
                    href={person.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-accent mt-1 break-all"
                  >
                    {person.linkedinUrl}
                  </a>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    className="btn-ghost btn-sm text-2xs"
                    onClick={() => void handleGenerateIntro(person.id)}
                    disabled={introState[person.id]?.loading}
                  >
                    {introState[person.id]?.loading ? "Generating..." : "Generate LinkedIn intro"}
                  </button>
                </div>
                {introState[person.id]?.error && (
                  <p className="text-2xs text-error mt-1">{introState[person.id].error}</p>
                )}
                {introState[person.id]?.text && (
                  <div className="mt-2 bg-surface-1 rounded px-3 py-2">
                    <p className="text-2xs text-text-secondary whitespace-pre-wrap leading-relaxed">
                      {introState[person.id].text}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-2xs text-text-tertiary">
                        {introState[person.id].text!.length} / 280 chars
                      </span>
                      <button
                        className="text-2xs text-accent"
                        onClick={() => void navigator.clipboard.writeText(introState[person.id].text!)}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-2xs text-text-tertiary mt-1">
                  Found {formatDate(person.foundAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(job.companyIntel || (job.decisionMakers && job.decisionMakers.length > 0)) && (
        <div className="mb-5 space-y-4">
          {job.companyIntel && (
            <div>
              <p className="text-xs font-semibold text-text-primary mb-2">Company Intelligence</p>
              <div className="grid grid-cols-2 gap-3">
                {job.companyIntel.industry && (
                  <InfoBlock title="Industry" value={job.companyIntel.industry} />
                )}
                {(job.companyIntel.employeeRange || job.companyIntel.employeeCount) && (
                  <InfoBlock
                    title="Company size"
                    value={job.companyIntel.employeeRange || job.companyIntel.employeeCount || ""}
                  />
                )}
                {job.companyIntel.location && (
                  <InfoBlock title="Location" value={job.companyIntel.location} />
                )}
                {job.companyIntel.latestFundingRound && (
                  <InfoBlock
                    title="Funding"
                    value={job.companyIntel.latestFundingRound}
                  />
                )}
              </div>
              {job.companyIntel.techStack && job.companyIntel.techStack.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {job.companyIntel.techStack.slice(0, 8).map((item, index) => (
                    <span key={index} className="badge-neutral text-2xs">
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {job.outreachStrategy && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-text-primary mb-2">Outreach Strategy</p>
          <div className="bg-surface-2 rounded-lg px-4 py-3 space-y-3">
            <InfoBlock
              title="Recommended action"
              value={job.outreachStrategy.recommendedAction}
            />
            <InfoBlock title="Timing" value={job.outreachStrategy.timing} />
            {job.outreachStrategy.targetContacts.length > 0 && (
              <div>
                <p className="text-2xs font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                  AI target contacts
                </p>
                <div className="space-y-2">
                  {job.outreachStrategy.targetContacts.slice(0, 3).map((contact, index) => (
                    <div key={`${contact.name}-${index}`} className="rounded-lg bg-surface-1 px-3 py-2">
                      <p className="text-xs text-text-primary font-medium">{contact.name}</p>
                      <p className="text-2xs text-text-secondary mt-1">{contact.title}</p>
                      <p className="text-2xs text-text-tertiary mt-1">
                        {contact.approachSuggestion}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {job.outreachStrategy.emailDraft && (
              <div>
                <p className="text-2xs font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                  Email Draft
                </p>
                <p className="text-xs text-text-secondary whitespace-pre-wrap">
                  {job.outreachStrategy.emailDraft}
                </p>
              </div>
            )}
            {job.outreachStrategy.linkedinMessageDraft && (
              <div>
                <p className="text-2xs font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                  LinkedIn Draft
                </p>
                <p className="text-xs text-text-secondary whitespace-pre-wrap">
                  {job.outreachStrategy.linkedinMessageDraft}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {parsed?.keywords && parsed.keywords.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-text-primary mb-2">Keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {parsed.keywords.map((keyword, index) => (
              <span key={index} className="badge-neutral text-2xs">
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {(job.parsed?.meta || job.fit?.meta) && (
        <div className="border-t border-surface-3 pt-3 mb-5">
          <p className="text-2xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
            AI Processing
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-2xs text-text-tertiary">
            {job.parsed?.meta && (
              <>
                <span>Parse model</span>
                <span className="font-mono">{job.parsed.meta.model}</span>
                <span>Parse confidence</span>
                <span className="font-mono">
                  {(job.parsed.meta.confidence * 100).toFixed(0)}%
                </span>
                <span>Parse time</span>
                <span className="font-mono">
                  {(job.parsed.meta.durationMs / 1000).toFixed(1)}s
                </span>
                <span>Parse attempts</span>
                <span className="font-mono">{job.parsed.meta.attemptCount}</span>
              </>
            )}
            {job.fit?.meta && (
              <>
                <span>Eval model</span>
                <span className="font-mono">{job.fit.meta.model}</span>
                <span>Eval confidence</span>
                <span className="font-mono">
                  {(job.fit.meta.confidence * 100).toFixed(0)}%
                </span>
                <span>Eval time</span>
                <span className="font-mono">
                  {(job.fit.meta.durationMs / 1000).toFixed(1)}s
                </span>
                <span>Eval attempts</span>
                <span className="font-mono">{job.fit.meta.attemptCount}</span>
              </>
            )}
            {(job.parsed?.meta || job.fit?.meta) && (
              <>
                <span>Outreach draft</span>
                <span className="font-mono">
                  {hasOutreachDraft(job) ? "ready" : "not ready"}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {parsed?.summary !== job.raw.description && job.raw.description && (
        <DescriptionSection description={job.raw.description} />
      )}

      <div className="flex flex-col gap-2 pt-3 border-t border-surface-3">
        {tailorCvError && (
          <p className="text-xs text-error">{tailorCvError}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {parsed && (
            <button
              className="btn-secondary btn-sm"
              onClick={() => void handleTailorCV()}
              disabled={tailorCvLoading}
            >
              {tailorCvLoading ? "Generating PDF..." : "Auto-Tailor CV"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
        {onTrack && job.status !== "tracked" && (
          <button
            className="btn-primary btn-sm"
            onClick={() => void runAction("track", onTrack)}
            disabled={activeAction !== null}
          >
            Track
          </button>
        )}
        {onReject && job.status !== "rejected" && (
          <button
            className="btn-danger btn-sm"
            onClick={() => void runAction("reject", onReject)}
            disabled={activeAction !== null}
          >
            Reject
          </button>
        )}
        {onUnreject && job.status === "rejected" && (
          <button
            className="btn-secondary btn-sm"
            onClick={() => void runAction("unreject", onUnreject)}
            disabled={activeAction !== null}
          >
            Undo Reject
          </button>
        )}
        {onApply && (job.status === "tracked" || job.status === "inbox") && (
          <button
            className="btn-secondary btn-sm"
            onClick={() => void runAction("apply", onApply)}
            disabled={activeAction !== null}
          >
            Mark Applied
          </button>
        )}
        {job.raw.link && (
          <a
            href={job.raw.link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost btn-sm ml-auto"
          >
            Open Original
          </a>
        )}
        </div>
      </div>
    </div>
  );
}

function DescriptionSection({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-5">
      <button
        className="text-xs font-semibold text-text-primary mb-1.5 hover:text-accent flex items-center gap-1"
        onClick={() => setExpanded(!expanded)}
      >
        Full Description {expanded ? "v" : ">"}
      </button>
      {expanded && (
        <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto bg-surface-2 rounded-lg p-3">
          {description}
        </div>
      )}
    </div>
  );
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-surface-2 rounded-lg px-3 py-2">
      <p className="text-2xs font-semibold text-text-tertiary uppercase tracking-wider mb-1">
        {title}
      </p>
      <p className="text-xs text-text-secondary">{value}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-text-primary mb-2">{title}</p>
      <ul className="text-xs text-text-secondary space-y-1">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function SourceChip({ source }: { source: string }) {
  const colors: Record<string, string> = {
    adzuna: "bg-emerald-500/10 text-emerald-400",
    reed: "bg-orange-500/10 text-orange-400",
    serpapi: "bg-slate-900/10 text-slate-700",
    greenhouse: "bg-green-500/10 text-green-400",
    lever: "bg-purple-500/10 text-purple-400",
    jooble: "bg-fuchsia-500/10 text-fuchsia-400",
    remotive: "bg-cyan-500/10 text-cyan-400",
    arbeitnow: "bg-yellow-500/10 text-yellow-400",
    himalayas: "bg-teal-500/10 text-teal-400",
    brightnetwork: "bg-sky-500/10 text-sky-400",
    linkedin: "bg-blue-500/10 text-blue-400",
    "rapidapi-linkedin": "bg-blue-500/10 text-blue-400",
    findwork: "bg-pink-500/10 text-pink-400",
    careerjet: "bg-amber-500/10 text-amber-400",
    themuse: "bg-rose-500/10 text-rose-400",
    scraper: "bg-gray-500/10 text-gray-400",
  };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium ${
        colors[source] || "bg-surface-3 text-text-tertiary"
      }`}
    >
      {source}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const colors: Record<string, string> = {
    inbox: "bg-accent/10 text-accent",
    tracked: "bg-success/10 text-success",
    rejected: "bg-danger/10 text-danger",
    applied: "bg-info/10 text-info",
    archived: "bg-gray-500/10 text-gray-400",
  };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium ${
        colors[status] || "bg-surface-3 text-text-tertiary"
      }`}
    >
      {status}
    </span>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
