import { v4 as uuid } from "uuid";
import {
  ApplicationBlockerKind,
  ApplicationLog,
  AutoApplyPipelineResult,
  EnrichedJob,
} from "@/types";
import { requireAppUser } from "@/lib/auth/session";
import { resolvePipelineEnrichmentBudget } from "@/lib/jobs/pipeline/config";
import { deduplicateJobs } from "@/lib/jobs/pipeline/dedupe";
import { enrichJobs } from "@/lib/jobs/pipeline/enrich";
import { rankJobs } from "@/lib/jobs/pipeline/rank";
import {
  getEnrichedJobs,
  getInboxJobs,
  getJobById,
  getRankedJobs,
  overwriteRankedJobs,
  saveRawJobs,
  saveToInbox,
  saveToRejected,
} from "@/lib/jobs/storage";
import { syncGmailJobAlerts } from "./gmail";
import { fetchTargetCompanyJobs } from "./companies";
import {
  appendApplicationLogs,
  getApplicationLogs,
  hasApplicationAttempt,
} from "./storage";
import { buildCvPacket } from "./cv";
import { draftColdOutreachForJob } from "./cold-outreach";

export interface AutoApplyOptions {
  maxApplications?: number;
  /**
   * Kept for API compatibility. The pipeline is review-only now and never
   * opens browser automation or submits applications automatically.
   */
  skipBrowser?: boolean;
}

export async function runApplicationForJob(
  userId: string,
  email: string,
  jobId: string,
  options?: { skipBrowser?: boolean }
): Promise<ApplicationLog> {
  const job = await getJobById(jobId, userId);
  if (!job) {
    throw new Error("Job not found");
  }

  const packet = await buildCvPacket(job);

  if (!isEligibleForAutoApply(job)) {
    const reason =
      job.fit?.data.visaRisk === "red"
        ? "red-visa-risk"
        : job.fit?.data.priorityBand === "low" || job.fit?.data.priorityBand === "reject"
          ? "low-fit"
          : "unsupported-flow";
    const log = buildLog(job, {
      status: "skipped",
      blocker: reason,
      detail: "Job is not eligible for auto apply.",
    });
    await appendApplicationLogs(userId, [log]);
    return log;
  }

  if (!packet.selectedCv || !packet.selectedCvPath) {
    const log = buildLog(job, {
      status: "paused",
      blocker: "missing-cv",
      detail: packet.reason,
    });
    await appendApplicationLogs(userId, [log]);
    return log;
  }

  const outreach = await draftColdOutreachForJob(userId, job);
  const log = buildLog(job, {
    status: outreach.draftId ? "drafted" : "planned",
    selectedCvId: packet.selectedCv.id,
    selectedCvPath: packet.selectedCvPath,
    tailoredCvPath: packet.tailoredCvPath,
    detail: buildReviewOnlyDetail(job, outreach.detail),
    gmailDraftId: outreach.draftId || undefined,
  });
  await appendApplicationLogs(userId, [log]);
  return log;
}

export async function runAutoApplyPipeline(
  options?: AutoApplyOptions
): Promise<AutoApplyPipelineResult> {
  const user = await requireAppUser();
  const logs: ApplicationLog[] = [];
  let fetched = 0;
  let imported = 0;
  let rankedCount = 0;
  const maxApplications = options?.maxApplications || 8;

  const [gmailResult, companyResult] = await Promise.allSettled([
    syncGmailJobAlerts(user.id, { maxMessages: 25 }),
    fetchTargetCompanyJobs({ maxCompanies: 12, maxJobsPerCompany: 15 }),
  ]);

  const rawJobs = [
    ...(gmailResult.status === "fulfilled" ? gmailResult.value.jobs : []),
    ...(companyResult.status === "fulfilled" ? companyResult.value.jobs : []),
  ];
  fetched = rawJobs.length;

  if (rawJobs.length > 0) {
    const deduped = await deduplicateJobs(rawJobs);
    if (deduped.newJobs.length > 0) {
      await saveRawJobs(deduped.newJobs, user.id);
      imported = deduped.newJobs.length;

      const enrichment = await enrichJobs(deduped.newJobs, {
        maxBatchSize: Math.min(resolvePipelineEnrichmentBudget("worker"), 10),
      });
      const inbox = enrichment.enriched.filter((job) => job.status === "inbox");
      const rejected = enrichment.enriched.filter((job) => job.status === "rejected");
      if (inbox.length > 0) await saveToInbox(inbox, user.id);
      if (rejected.length > 0) await saveToRejected(rejected, user.id);
    }
  }

  const [inboxJobs, enrichedJobs] = await Promise.all([
    getInboxJobs(user.id),
    getEnrichedJobs(user.id),
  ]);
  const rankedResult = rankJobs([
    ...inboxJobs,
    ...enrichedJobs.filter((job) =>
      ["tracked", "applied", "inbox", "shortlisted"].includes(job.status)
    ),
  ]);
  if (rankedResult.ranked.length > 0) {
    await overwriteRankedJobs(rankedResult.ranked, user.id);
  }
  rankedCount = rankedResult.stats.total;

  const ranked = await getRankedJobs(user.id);
  const remaining = Math.max(0, maxApplications - countActionableLogs(logs));
  if (remaining > 0) {
    logs.push(
      ...(await applyEligibleJobs(user.id, ranked, {
        maxApplications: remaining,
      }))
    );
  }

  await appendApplicationLogs(user.id, logs);

  return summarizeAutoApplyResult({
    fetched,
    imported,
    ranked: rankedCount,
    logs,
  });
}

async function applyEligibleJobs(
  userId: string,
  ranked: EnrichedJob[],
  options: { maxApplications: number }
): Promise<ApplicationLog[]> {
  const logs: ApplicationLog[] = [];
  const eligible = ranked
    .filter(isEligibleForAutoApply)
    .sort((left, right) => (right.fit?.data.fitScore || 0) - (left.fit?.data.fitScore || 0))
    .slice(0, Math.max(options.maxApplications * 5, options.maxApplications));
  const existingLogs = await getApplicationLogs(userId, 1000);
  const existingKeys = new Set(existingLogs.map((log) => log.dedupeKey));

  for (const job of eligible) {
    if (
      existingKeys.has(job.dedupeKey) ||
      (await hasApplicationAttempt(userId, {
        dedupeKey: job.dedupeKey,
        sourceJobId: job.raw.sourceJobId,
        applyUrl: job.raw.link,
      }))
    ) {
      logs.push(buildLog(job, {
        status: "skipped",
        blocker: "already-applied",
        detail: "Already present in application logs.",
      }));
      continue;
    }

    const packet = await buildCvPacket(job);
    if (!packet.selectedCv || !packet.selectedCvPath) {
      logs.push(buildLog(job, {
        status: "paused",
        blocker: "missing-cv",
        detail: packet.reason,
      }));
      continue;
    }

    const outreach = await draftColdOutreachForJob(userId, job);
    logs.push(buildLog(job, {
      status: outreach.draftId ? "drafted" : "planned",
      selectedCvId: packet.selectedCv.id,
      selectedCvPath: packet.selectedCvPath,
      tailoredCvPath: packet.tailoredCvPath,
      detail: buildReviewOnlyDetail(job, outreach.detail),
      gmailDraftId: outreach.draftId || undefined,
    }));

    if (countActionableLogs(logs) >= options.maxApplications) {
      break;
    }
  }

  return logs;
}

function countActionableLogs(logs: ApplicationLog[]): number {
  return logs.filter((log) =>
    ["applied", "paused", "drafted", "planned"].includes(log.status)
  ).length;
}

function summarizeAutoApplyResult(input: {
  fetched: number;
  imported: number;
  ranked: number;
  logs: ApplicationLog[];
}): AutoApplyPipelineResult {
  return {
    fetched: input.fetched,
    imported: input.imported,
    ranked: input.ranked,
    planned: input.logs.filter((log) => log.status === "planned").length,
    applied: input.logs.filter((log) => log.status === "applied").length,
    drafted: input.logs.filter((log) => log.status === "drafted").length,
    paused: input.logs.filter((log) => log.status === "paused").length,
    skipped: input.logs.filter((log) => log.status === "skipped").length,
    failed: input.logs.filter((log) => log.status === "failed").length,
    logs: input.logs,
  };
}

export function isEligibleForAutoApply(job: EnrichedJob): boolean {
  const fit = job.fit?.data;
  if (!fit) return false;
  if (!["high", "medium"].includes(fit.priorityBand)) return false;
  if (fit.visaRisk === "red") return false;
  if (job.status === "applied" || job.status === "rejected" || job.status === "archived") {
    return false;
  }
  if (!job.raw.link) return false;
  return true;
}

function buildLog(
  job: EnrichedJob,
  input: {
    status: ApplicationLog["status"];
    blocker?: ApplicationBlockerKind | string;
    detail?: string;
    selectedCvId?: string;
    selectedCvPath?: string;
    tailoredCvPath?: string | null;
    evidence?: string;
    gmailDraftId?: string;
  }
): ApplicationLog {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    jobId: job.id,
    dedupeKey: job.dedupeKey,
    source: job.raw.source,
    company: job.raw.company,
    title: job.raw.title,
    applyUrl: job.raw.link,
    selectedCvId: input.selectedCvId,
    selectedCvPath: input.selectedCvPath,
    tailoredCvPath: input.tailoredCvPath,
    status: input.status,
    blocker: input.blocker as ApplicationBlockerKind | undefined,
    blockerDetail: input.detail,
    fitBand: job.fit?.data.priorityBand,
    fitScore: job.fit?.data.fitScore,
    browserEvidence: input.evidence,
    gmailDraftId: input.gmailDraftId,
    attemptedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function isEmailApply(link: string): boolean {
  return /^mailto:/i.test(link);
}

function buildReviewOnlyDetail(job: EnrichedJob, outreachDetail?: string): string {
  const suffix = outreachDetail ? ` ${outreachDetail}` : "";
  if (isEmailApply(job.raw.link)) {
    return `Review-only mode: email application detected. No application email was sent.${suffix}`;
  }
  return `Review-only mode: recommended for manual review. No browser automation or submission was started.${suffix}`;
}
