import { differenceInCalendarDays } from "date-fns";
import { getRoleTrackLabel } from "@/lib/career/role-track-labels";
import { getSourceLabel } from "@/lib/jobs/source-meta";
import {
  getEnrichedJobs,
  getInboxJobs,
  getRankedJobs,
  getRejectedJobs,
} from "@/lib/jobs/storage";
import { ConfigFiles, readObject, writeObject } from "@/lib/storage";
import { getApplicationLogs, getCvLibrary } from "./storage";
import {
  ApplicationLog,
  ApplicationOutcomeRecord,
  ApplicationOutcomeSnapshot,
  ApplicationOutcomeStageLeakageEntry,
  ApplicationOutcomeSummaryEntry,
  CvLibraryEntry,
  EnrichedJob,
} from "@/types";

export const APPLICATION_OUTCOME_ETL_VERSION = 1;
export const FIRST_FOLLOW_UP_DAYS = 8;
export const SECOND_FOLLOW_UP_DAYS = 18;
export const GHOSTED_DAYS = 21;
export const APPLICATION_OUTCOMES_STORAGE_KEY = ConfigFiles.APPLICATION_OUTCOMES;

type StoredApplicationOutcomeSnapshots = {
  version: number;
  snapshotsByUserId: Record<string, ApplicationOutcomeSnapshot>;
};

const ACTIONABLE_ATTEMPT_STATUSES = new Set(["planned", "drafted", "applied", "paused"]);
const RESPONSE_STATUSES = new Set(["interview", "offer", "rejected"]);
const PIPELINE_ONLY_STATUSES = new Set(["tracked", "shortlisted"]);
const USEFUL_ROLE_STATUSES = new Set(["shortlisted", "tracked", "applied", "interview", "offer"]);

interface BuildOptions {
  now?: Date;
}

interface SummaryBucket {
  key: string;
  label: string;
  totalRecords: number;
  attemptRecords: number;
  pipelineOnlyRecords: number;
  usefulRoles: number;
  appliedAttempts: number;
  responded: number;
  interviews: number;
  rejections: number;
  offers: number;
  ghosted: number;
  followUpDue: number;
}

type SummarySelector = (record: ApplicationOutcomeRecord) => { key: string; label: string } | null;

function normalizePath(value?: string | null): string | null {
  if (!value) return null;
  return value.trim().replace(/\\/g, "/").toLowerCase();
}

function buildCvLookup(entries: CvLibraryEntry[]) {
  const byId = new Map<string, string>();
  const byPath = new Map<string, string>();

  for (const entry of entries) {
    byId.set(entry.id, entry.label);
    const normalizedPath = normalizePath(entry.path);
    if (normalizedPath) {
      byPath.set(normalizedPath, entry.label);
    }
  }

  return { byId, byPath };
}

function getMostRelevantJobs(jobs: EnrichedJob[]) {
  const byId = new Map<string, EnrichedJob>();
  const byDedupeKey = new Map<string, EnrichedJob>();

  for (const job of jobs) {
    const existingById = byId.get(job.id);
    if (!existingById || new Date(job.updatedAt) > new Date(existingById.updatedAt)) {
      byId.set(job.id, job);
    }

    const existingByKey = byDedupeKey.get(job.dedupeKey);
    if (!existingByKey || new Date(job.updatedAt) > new Date(existingByKey.updatedAt)) {
      byDedupeKey.set(job.dedupeKey, job);
    }
  }

  return { byId, byDedupeKey };
}

function resolveJobForLog(
  log: ApplicationLog,
  jobIndex: ReturnType<typeof getMostRelevantJobs>
): EnrichedJob | null {
  if (log.jobId && jobIndex.byId.has(log.jobId)) {
    return jobIndex.byId.get(log.jobId) || null;
  }
  return jobIndex.byDedupeKey.get(log.dedupeKey) || null;
}

function maxIsoDate(values: Array<string | null | undefined>): string | null {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function isActionableAttemptStatus(status: string | null | undefined): boolean {
  return Boolean(status && ACTIONABLE_ATTEMPT_STATUSES.has(status));
}

function isResponseStatus(status: string | null | undefined): boolean {
  return Boolean(status && RESPONSE_STATUSES.has(status));
}

function deriveCurrentStatus(pipelineStatus: string | null, latestAttemptStatus: string | null): string {
  return pipelineStatus || latestAttemptStatus || "unknown";
}

function deriveCvVersion(
  log: Pick<ApplicationLog, "selectedCvId" | "selectedCvPath" | "tailoredCvPath">,
  cvLookup: ReturnType<typeof buildCvLookup>
): string {
  if (log.selectedCvId && cvLookup.byId.has(log.selectedCvId)) {
    return cvLookup.byId.get(log.selectedCvId) || "unknown";
  }

  const selectedPath = normalizePath(log.selectedCvPath);
  if (selectedPath && cvLookup.byPath.has(selectedPath)) {
    return cvLookup.byPath.get(selectedPath) || "unknown";
  }

  const tailoredPath = normalizePath(log.tailoredCvPath);
  if (tailoredPath && cvLookup.byPath.has(tailoredPath)) {
    return cvLookup.byPath.get(tailoredPath) || "unknown";
  }

  return "unknown";
}

function deriveRecruiterName(job: EnrichedJob | null): string | null {
  const decisionMaker = job?.decisionMakers?.find((person) => person.fullName?.trim());
  if (decisionMaker?.fullName?.trim()) {
    return decisionMaker.fullName.trim();
  }

  const outreachTarget = job?.outreachStrategy?.targetContacts?.find((contact) => contact.name?.trim());
  if (outreachTarget?.name?.trim()) {
    return outreachTarget.name.trim();
  }

  return null;
}

function deriveNotes(log: ApplicationLog | null, job: EnrichedJob | null): string | null {
  const values = [log?.blockerDetail, job?.followUpNote, job?.userNotes]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return values[0] || null;
}

function deriveFollowUpStage(daysSinceApplication: number | null): "first" | "second" | null {
  if (daysSinceApplication == null) return null;
  if (daysSinceApplication >= SECOND_FOLLOW_UP_DAYS) return "second";
  if (daysSinceApplication >= FIRST_FOLLOW_UP_DAYS) return "first";
  return null;
}

function isAppliedAttemptRecord(record: ApplicationOutcomeRecord): boolean {
  if (record.recordKind !== "application_attempt") {
    return false;
  }

  return (
    record.latestAttemptStatus === "applied" ||
    ["applied", "interview", "offer", "rejected"].includes(record.currentStatus)
  );
}

function isUsefulOutcomeRecord(record: ApplicationOutcomeRecord): boolean {
  if (USEFUL_ROLE_STATUSES.has(record.currentStatus)) {
    return true;
  }

  if (record.currentStatus !== "rejected") {
    return false;
  }

  return (
    record.recordKind === "application_attempt" &&
    Boolean(record.applicationAttemptId || record.applicationDate || record.responseReceived)
  );
}

function deriveStageLeakageKey(record: ApplicationOutcomeRecord): { key: string; label: string } {
  if (record.recordKind === "pipeline_job") {
    return {
      key: record.currentStatus,
      label: record.currentStatus === "shortlisted" ? "Shortlisted (No attempt)" : "Tracked (No attempt)",
    };
  }

  if (record.responseReceived) {
    if (record.offerReceived) return { key: "offer", label: "Offer" };
    if (record.interviewReceived) return { key: "interview", label: "Interview" };
    if (record.rejectionReceived) return { key: "rejected", label: "Rejected" };
  }

  if (isAppliedAttemptRecord(record)) {
    return { key: "applied", label: "Applied Awaiting Response" };
  }

  return {
    key: record.latestAttemptStatus || "unknown",
    label: record.latestAttemptStatus ? getSourceLabel(record.latestAttemptStatus).replace(/^Gmail · /, "") : "Unknown",
  };
}

function createSummaryBucket(key: string, label: string): SummaryBucket {
  return {
    key,
    label,
    totalRecords: 0,
    attemptRecords: 0,
    pipelineOnlyRecords: 0,
    usefulRoles: 0,
    appliedAttempts: 0,
    responded: 0,
    interviews: 0,
    rejections: 0,
    offers: 0,
    ghosted: 0,
    followUpDue: 0,
  };
}

function finalizeSummaryBucket(bucket: SummaryBucket): ApplicationOutcomeSummaryEntry {
  return {
    ...bucket,
    responseRate:
      bucket.appliedAttempts > 0
        ? Number(((bucket.responded / bucket.appliedAttempts) * 100).toFixed(1))
        : null,
    interviewRate:
      bucket.appliedAttempts > 0
        ? Number(((bucket.interviews / bucket.appliedAttempts) * 100).toFixed(1))
        : null,
    offerRate:
      bucket.appliedAttempts > 0
        ? Number(((bucket.offers / bucket.appliedAttempts) * 100).toFixed(1))
        : null,
  };
}

function sortSummaryEntries(entries: ApplicationOutcomeSummaryEntry[]) {
  return [...entries].sort((left, right) => {
    if ((right.appliedAttempts || 0) !== (left.appliedAttempts || 0)) {
      return right.appliedAttempts - left.appliedAttempts;
    }
    if ((right.responded || 0) !== (left.responded || 0)) {
      return right.responded - left.responded;
    }
    if ((right.totalRecords || 0) !== (left.totalRecords || 0)) {
      return right.totalRecords - left.totalRecords;
    }
    return left.label.localeCompare(right.label);
  });
}

function summarizeDimension(
  records: ApplicationOutcomeRecord[],
  selector: SummarySelector,
  options?: { attemptsOnly?: boolean }
): ApplicationOutcomeSummaryEntry[] {
  const buckets = new Map<string, SummaryBucket>();

  for (const record of records) {
    if (options?.attemptsOnly && record.recordKind !== "application_attempt") {
      continue;
    }

    const selected = selector(record);
    if (!selected) {
      continue;
    }

    const bucket = buckets.get(selected.key) || createSummaryBucket(selected.key, selected.label);
    bucket.totalRecords += 1;
    if (record.recordKind === "application_attempt") {
      bucket.attemptRecords += 1;
    } else {
      bucket.pipelineOnlyRecords += 1;
    }
    if (isUsefulOutcomeRecord(record)) {
      bucket.usefulRoles += 1;
    }
    if (isAppliedAttemptRecord(record)) {
      bucket.appliedAttempts += 1;
    }
    if (record.responseReceived) {
      bucket.responded += 1;
    }
    if (record.interviewReceived) {
      bucket.interviews += 1;
    }
    if (record.rejectionReceived) {
      bucket.rejections += 1;
    }
    if (record.offerReceived) {
      bucket.offers += 1;
    }
    if (record.ghosted) {
      bucket.ghosted += 1;
    }
    if (record.followUpDue) {
      bucket.followUpDue += 1;
    }

    buckets.set(selected.key, bucket);
  }

  return sortSummaryEntries(Array.from(buckets.values()).map(finalizeSummaryBucket));
}

function summarizeOverall(records: ApplicationOutcomeRecord[]): ApplicationOutcomeSummaryEntry {
  const bucket = createSummaryBucket("overall", "Overall");

  for (const record of records) {
    bucket.totalRecords += 1;
    if (record.recordKind === "application_attempt") {
      bucket.attemptRecords += 1;
    } else {
      bucket.pipelineOnlyRecords += 1;
    }
    if (isUsefulOutcomeRecord(record)) {
      bucket.usefulRoles += 1;
    }
    if (isAppliedAttemptRecord(record)) {
      bucket.appliedAttempts += 1;
    }
    if (record.responseReceived) {
      bucket.responded += 1;
    }
    if (record.interviewReceived) {
      bucket.interviews += 1;
    }
    if (record.rejectionReceived) {
      bucket.rejections += 1;
    }
    if (record.offerReceived) {
      bucket.offers += 1;
    }
    if (record.ghosted) {
      bucket.ghosted += 1;
    }
    if (record.followUpDue) {
      bucket.followUpDue += 1;
    }
  }

  return finalizeSummaryBucket(bucket);
}

function summarizeStageLeakage(records: ApplicationOutcomeRecord[]): ApplicationOutcomeStageLeakageEntry[] {
  const buckets = new Map<string, ApplicationOutcomeStageLeakageEntry>();

  for (const record of records) {
    const stage = deriveStageLeakageKey(record);
    const bucket =
      buckets.get(stage.key) || {
        key: stage.key,
        label: stage.label,
        totalRecords: 0,
        attemptRecords: 0,
        pipelineOnlyRecords: 0,
        responded: 0,
        ghosted: 0,
        followUpDue: 0,
      };

    bucket.totalRecords += 1;
    if (record.recordKind === "application_attempt") {
      bucket.attemptRecords += 1;
    } else {
      bucket.pipelineOnlyRecords += 1;
    }
    if (record.responseReceived) {
      bucket.responded += 1;
    }
    if (record.ghosted) {
      bucket.ghosted += 1;
    }
    if (record.followUpDue) {
      bucket.followUpDue += 1;
    }

    buckets.set(stage.key, bucket);
  }

  return Array.from(buckets.values()).sort((left, right) => right.totalRecords - left.totalRecords || left.label.localeCompare(right.label));
}

function sortRecords(records: ApplicationOutcomeRecord[]) {
  return [...records].sort((left, right) => {
    const leftTime = new Date(left.latestStatusDate || left.applicationDate || 0).getTime();
    const rightTime = new Date(right.latestStatusDate || right.applicationDate || 0).getTime();
    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }
    return left.recordId.localeCompare(right.recordId);
  });
}

function buildAttemptRecord(
  log: ApplicationLog,
  job: EnrichedJob | null,
  cvLookup: ReturnType<typeof buildCvLookup>,
  now: Date
): ApplicationOutcomeRecord {
  const pipelineStatus = job?.status || null;
  const latestAttemptStatus = log.status;
  const currentStatus = deriveCurrentStatus(pipelineStatus, latestAttemptStatus);
  const responseReceived = isResponseStatus(pipelineStatus) || isResponseStatus(latestAttemptStatus);
  const responseDate = responseReceived && isResponseStatus(pipelineStatus) ? job?.stageChangedAt || null : null;
  const applicationDate = log.attemptedAt;
  const latestStatusDate = maxIsoDate([
    responseDate,
    job?.stageChangedAt,
    log.updatedAt,
    log.attemptedAt,
    job?.updatedAt,
  ]);
  const daysSinceApplication = differenceInCalendarDays(now, new Date(applicationDate));
  const followUpStage =
    isActionableAttemptStatus(latestAttemptStatus) && !responseReceived
      ? deriveFollowUpStage(daysSinceApplication)
      : null;
  const ghosted =
    isActionableAttemptStatus(latestAttemptStatus) &&
    !responseReceived &&
    daysSinceApplication >= GHOSTED_DAYS &&
    !isResponseStatus(pipelineStatus);

  return {
    recordId: log.id,
    recordKind: "application_attempt",
    applicationAttemptId: log.id,
    jobId: log.jobId || job?.id || null,
    dedupeKey: log.dedupeKey,
    source: log.source || job?.raw.source || "unknown",
    company: log.company || job?.raw.company || "Unknown company",
    roleTitle: job?.parsed?.data?.title || job?.raw.title || log.title || "Unknown role",
    roleTrack: job?.parsed?.data?.roleTrack || null,
    cvVersion: deriveCvVersion(log, cvLookup),
    pipelineStatus,
    latestAttemptStatus,
    currentStatus,
    applicationDate,
    latestStatusDate,
    responseReceived,
    responseDate,
    interviewReceived: pipelineStatus === "interview",
    rejectionReceived: pipelineStatus === "rejected",
    offerReceived: pipelineStatus === "offer",
    ghosted,
    daysSinceApplication,
    daysToResponse:
      responseDate != null
        ? differenceInCalendarDays(new Date(responseDate), new Date(applicationDate))
        : null,
    followUpDue: followUpStage !== null && !responseReceived,
    followUpStage,
    recruiterName: deriveRecruiterName(job),
    agencyName: null,
    location: job?.parsed?.data?.location || job?.raw.location || null,
    remoteType: job?.parsed?.data?.remoteType || job?.raw.remoteType || null,
    salaryText: job?.parsed?.data?.salaryText || job?.raw.salaryText || null,
    fitScore: job?.fit?.data?.fitScore ?? log.fitScore ?? null,
    matchScore: null,
    notes: deriveNotes(log, job),
  };
}

function buildPipelineOnlyRecord(job: EnrichedJob): ApplicationOutcomeRecord {
  return {
    recordId: job.dedupeKey,
    recordKind: "pipeline_job",
    applicationAttemptId: null,
    jobId: job.id,
    dedupeKey: job.dedupeKey,
    source: job.raw.source,
    company: job.raw.company,
    roleTitle: job.parsed?.data?.title || job.raw.title,
    roleTrack: job.parsed?.data?.roleTrack || null,
    cvVersion: "unknown",
    pipelineStatus: job.status,
    latestAttemptStatus: null,
    currentStatus: job.status,
    applicationDate: null,
    latestStatusDate: maxIsoDate([job.stageChangedAt, job.updatedAt]),
    responseReceived: false,
    responseDate: null,
    interviewReceived: false,
    rejectionReceived: false,
    offerReceived: false,
    ghosted: false,
    daysSinceApplication: null,
    daysToResponse: null,
    followUpDue: false,
    followUpStage: null,
    recruiterName: deriveRecruiterName(job),
    agencyName: null,
    location: job.parsed?.data?.location || job.raw.location || null,
    remoteType: job.parsed?.data?.remoteType || job.raw.remoteType || null,
    salaryText: job.parsed?.data?.salaryText || job.raw.salaryText || null,
    fitScore: job.fit?.data?.fitScore ?? null,
    matchScore: null,
    notes: deriveNotes(null, job),
  };
}

export function summariseApplicationOutcomes(records: ApplicationOutcomeRecord[]) {
  const sorted = sortRecords(records);
  return {
    overall: summarizeOverall(sorted),
    byTrack: summarizeDimension(sorted, (record) => ({
      key: record.roleTrack || "unknown",
      label: record.roleTrack ? getRoleTrackLabel(record.roleTrack) : "Unknown",
    })),
    bySource: summarizeDimension(sorted, (record) => ({
      key: record.source || "unknown",
      label: getSourceLabel(record.source || "unknown"),
    })),
    byCvVersion: summarizeDimension(
      sorted,
      (record) => ({ key: record.cvVersion || "unknown", label: record.cvVersion || "unknown" }),
      { attemptsOnly: true }
    ),
    byCompany: summarizeDimension(sorted, (record) => ({
      key: record.company || "unknown",
      label: record.company || "Unknown company",
    })),
    byRecruiter: summarizeDimension(sorted, (record) =>
      record.recruiterName ? { key: record.recruiterName, label: record.recruiterName } : null
    ),
    stageLeakage: summarizeStageLeakage(sorted),
    followUpDue: sorted.filter((record) => record.followUpDue),
    ghosted: sorted.filter((record) => record.ghosted),
  };
}

export async function buildApplicationOutcomeSnapshot(
  userId: string,
  options?: BuildOptions
): Promise<ApplicationOutcomeSnapshot> {
  const now = options?.now || new Date();
  const [applicationLogs, rankedJobs, enrichedJobs, inboxJobs, rejectedJobs, cvLibrary] = await Promise.all([
    getApplicationLogs(userId, 1000),
    getRankedJobs(userId),
    getEnrichedJobs(userId),
    getInboxJobs(userId),
    getRejectedJobs(userId),
    getCvLibrary(),
  ]);

  const cvLookup = buildCvLookup(cvLibrary);
  const allJobs = [...rankedJobs, ...enrichedJobs, ...inboxJobs, ...rejectedJobs];
  const jobIndex = getMostRelevantJobs(allJobs);

  const attemptRecords = applicationLogs.map((log) => buildAttemptRecord(log, resolveJobForLog(log, jobIndex), cvLookup, now));

  const attemptedDedupeKeys = new Set(applicationLogs.map((log) => log.dedupeKey));
  const pipelineOnlyRecords = Array.from(jobIndex.byDedupeKey.values())
    .filter((job) => PIPELINE_ONLY_STATUSES.has(job.status) && !attemptedDedupeKeys.has(job.dedupeKey))
    .map((job) => buildPipelineOnlyRecord(job));

  const records = sortRecords([...attemptRecords, ...pipelineOnlyRecords]);

  return {
    userId,
    generatedAt: now.toISOString(),
    etlVersion: APPLICATION_OUTCOME_ETL_VERSION,
    thresholds: {
      firstFollowUpDays: FIRST_FOLLOW_UP_DAYS,
      secondFollowUpDays: SECOND_FOLLOW_UP_DAYS,
      ghostedDays: GHOSTED_DAYS,
    },
    records,
    summaries: summariseApplicationOutcomes(records),
  };
}

export async function getLatestApplicationOutcomeSnapshot(
  userId: string
): Promise<ApplicationOutcomeSnapshot | null> {
  const stored = await readObject<StoredApplicationOutcomeSnapshots>(APPLICATION_OUTCOMES_STORAGE_KEY);
  if (!stored?.snapshotsByUserId) {
    return null;
  }

  return stored.snapshotsByUserId[userId] || null;
}

export async function saveApplicationOutcomeSnapshot(
  snapshot: ApplicationOutcomeSnapshot
): Promise<ApplicationOutcomeSnapshot> {
  const stored =
    (await readObject<StoredApplicationOutcomeSnapshots>(APPLICATION_OUTCOMES_STORAGE_KEY)) || {
      version: APPLICATION_OUTCOME_ETL_VERSION,
      snapshotsByUserId: {},
    };

  const next: StoredApplicationOutcomeSnapshots = {
    version: APPLICATION_OUTCOME_ETL_VERSION,
    snapshotsByUserId: {
      ...stored.snapshotsByUserId,
      [snapshot.userId]: snapshot,
    },
  };

  await writeObject(APPLICATION_OUTCOMES_STORAGE_KEY, next);
  return snapshot;
}
