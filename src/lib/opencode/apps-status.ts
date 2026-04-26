import { differenceInCalendarDays } from "date-fns";
import { ApplicationLog, EnrichedJob } from "@/types";
import { getApplicationLogs } from "@/lib/applications/storage";
import {
  getEnrichedJobs,
  getInboxJobs,
  getRankedJobs,
  getRejectedJobs,
} from "@/lib/jobs/storage";
import { writeOpenCodeJson, writeOpenCodeText } from "./storage";
import { getSourceLabel } from "@/lib/jobs/source-meta";
import { inferShortlistLaneFromText, type ShortlistLane } from "@/lib/career/shortlist-lanes";

export interface OpenCodeApplicationStatusItem {
  dedupeKey: string;
  title: string;
  company: string;
  source: string;
  sourceLabel: string;
  appStatus: ApplicationLog["status"] | "none";
  pipelineStatus: EnrichedJob["status"] | "unknown";
  fitScore: number | null;
  attemptedAt: string | null;
  daysSilent: number | null;
  followUpStage: "first" | "second" | null;
  ghosted: boolean;
  lane: ShortlistLane;
  gmailDraftId?: string;
  applyUrl?: string;
}

export interface OpenCodeAppsStatus {
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
  candidates: OpenCodeApplicationStatusItem[];
}

function getMostRecentLogs(logs: ApplicationLog[]): Map<string, ApplicationLog> {
  const latest = new Map<string, ApplicationLog>();
  for (const log of logs) {
    const existing = latest.get(log.dedupeKey);
    if (!existing || new Date(log.attemptedAt) > new Date(existing.attemptedAt)) {
      latest.set(log.dedupeKey, log);
    }
  }
  return latest;
}

function getMostRelevantJobs(jobs: EnrichedJob[]): Map<string, EnrichedJob> {
  const latest = new Map<string, EnrichedJob>();
  for (const job of jobs) {
    const existing = latest.get(job.dedupeKey);
    if (!existing || new Date(job.updatedAt) > new Date(existing.updatedAt)) {
      latest.set(job.dedupeKey, job);
    }
  }
  return latest;
}

function determineFollowUpStage(daysSilent: number | null): "first" | "second" | null {
  if (daysSilent == null) return null;
  if (daysSilent >= 18) return "second";
  if (daysSilent >= 8) return "first";
  return null;
}

export async function buildOpenCodeAppsStatus(
  userId: string
): Promise<OpenCodeAppsStatus> {
  const [logs, ranked, enriched, inbox, rejected] = await Promise.all([
    getApplicationLogs(userId, 1000),
    getRankedJobs(userId),
    getEnrichedJobs(userId),
    getInboxJobs(userId),
    getRejectedJobs(userId),
  ]);

  const logMap = getMostRecentLogs(logs);
  const allJobs = [...ranked, ...enriched, ...inbox, ...rejected].filter((job) =>
    ["applied", "interview", "offer", "tracked", "shortlisted"].includes(job.status)
  );
  const jobMap = getMostRelevantJobs(allJobs);
  const keys = new Set<string>([...logMap.keys(), ...jobMap.keys()]);
  const today = new Date();

  const candidates = Array.from(keys)
    .map((dedupeKey) => {
      const log = logMap.get(dedupeKey) || null;
      const job = jobMap.get(dedupeKey) || null;
      const attemptedAt = log?.attemptedAt || null;
      const daysSilent = attemptedAt
        ? differenceInCalendarDays(today, new Date(attemptedAt))
        : null;
      const followUpStage = determineFollowUpStage(daysSilent);
      const appStatus = log?.status || "none";
      const pipelineStatus = job?.status || "unknown";
      const actionable = ["planned", "drafted", "applied", "paused"].includes(appStatus);
      const ghosted = actionable && (daysSilent ?? 0) >= 21 && pipelineStatus !== "interview" && pipelineStatus !== "offer";
      const lane = inferShortlistLaneFromText({
        roleTrack: job?.parsed?.data?.roleTrack,
        title: job?.parsed?.data?.title || job?.raw.title || log?.title,
        summary: job?.parsed?.data?.summary || "",
        keywords: job?.parsed?.data?.keywords || [],
      });

      return {
        dedupeKey,
        title: job?.raw.title || log?.title || "Unknown role",
        company: job?.raw.company || log?.company || "Unknown company",
        source: job?.raw.source || log?.source || "unknown",
        sourceLabel: getSourceLabel(job?.raw.source || log?.source || "unknown"),
        appStatus,
        pipelineStatus,
        fitScore: job?.fit?.data?.fitScore ?? log?.fitScore ?? null,
        attemptedAt,
        daysSilent,
        followUpStage: actionable ? followUpStage : null,
        ghosted,
        lane,
        gmailDraftId: log?.gmailDraftId,
        applyUrl: log?.applyUrl || job?.raw.link,
      } satisfies OpenCodeApplicationStatusItem;
    })
    .sort((left, right) => {
      const followUpRank = (item: OpenCodeApplicationStatusItem) =>
        item.followUpStage === "second" ? 3 : item.followUpStage === "first" ? 2 : item.ghosted ? 1 : 0;
      const followUpDiff = followUpRank(right) - followUpRank(left);
      if (followUpDiff !== 0) return followUpDiff;
      return (right.fitScore || 0) - (left.fitScore || 0);
    });

  const summary: OpenCodeAppsStatus = {
    generatedAt: new Date().toISOString(),
    totals: {
      tracked: candidates.filter((item) => item.pipelineStatus === "tracked" || item.pipelineStatus === "shortlisted").length,
      applied: candidates.filter((item) => item.pipelineStatus === "applied" || item.appStatus === "applied").length,
      interview: candidates.filter((item) => item.pipelineStatus === "interview").length,
      offer: candidates.filter((item) => item.pipelineStatus === "offer").length,
      rejected: candidates.filter((item) => item.pipelineStatus === "rejected").length,
      drafted: candidates.filter((item) => item.appStatus === "drafted").length,
      planned: candidates.filter((item) => item.appStatus === "planned").length,
      paused: candidates.filter((item) => item.appStatus === "paused").length,
      ghosted: candidates.filter((item) => item.ghosted).length,
      followUpFirstDue: candidates.filter((item) => item.followUpStage === "first").length,
      followUpSecondDue: candidates.filter((item) => item.followUpStage === "second").length,
    },
    candidates,
  };

  await writeOpenCodeJson("apps-status.json", summary);
  await writeOpenCodeText("apps-status.md", renderOpenCodeAppsStatusMarkdown(summary));
  return summary;
}

export function renderOpenCodeAppsStatusMarkdown(status: OpenCodeAppsStatus): string {
  const lines = [
    `# Application Status`,
    ``,
    `Generated: ${status.generatedAt}`,
    ``,
    `- Tracked: ${status.totals.tracked}`,
    `- Applied: ${status.totals.applied}`,
    `- Interview: ${status.totals.interview}`,
    `- Offer: ${status.totals.offer}`,
    `- Rejected: ${status.totals.rejected}`,
    `- Drafted: ${status.totals.drafted}`,
    `- Planned: ${status.totals.planned}`,
    `- Paused: ${status.totals.paused}`,
    `- Ghosted: ${status.totals.ghosted}`,
    `- Follow-up due (day 8): ${status.totals.followUpFirstDue}`,
    `- Follow-up due (day 18): ${status.totals.followUpSecondDue}`,
    ``,
    `## Priority Queue`,
    ``,
    `| Role | Source | App | Pipeline | Fit | Days Silent | Next |`,
    `|---|---|---|---|---:|---:|---|`,
  ];

  for (const item of status.candidates.slice(0, 12)) {
    lines.push(
      `| ${item.title} @ ${item.company} | ${item.sourceLabel} | ${item.appStatus} | ${item.pipelineStatus} | ${item.fitScore ?? "-"} | ${item.daysSilent ?? "-"} | ${item.followUpStage ? `${item.followUpStage} follow-up` : item.ghosted ? "ghosted" : "watch"} |`
    );
  }

  return `${lines.join("\n")}\n`;
}
