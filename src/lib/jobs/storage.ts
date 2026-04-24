// ============================================================
// User-scoped job storage helpers.
// Supabase-backed when configured, with a local preview fallback.
// ============================================================

import {
  appendToCollection,
  Collections,
  readCollection,
  writeCollection,
} from "@/lib/storage";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentAppUser } from "@/lib/auth/session";
import { EnrichedJob, RawJobItem, UserJobStatus } from "@/types";

type StoredRawJob = RawJobItem & { dedupeKey?: string; userId?: string };
type StoredEnrichedJob = EnrichedJob & { userId?: string };
type StoredJobIntel = {
  id: string;
  userId?: string;
  companyIntel?: EnrichedJob["companyIntel"];
  decisionMakers?: EnrichedJob["decisionMakers"];
  outreachStrategy?: EnrichedJob["outreachStrategy"];
  updatedAt: string;
};

async function resolveActorId(explicitUserId?: string): Promise<string> {
  if (explicitUserId) {
    return explicitUserId;
  }

  const fallback = process.env.LIFE_OS_DEFAULT_USER_ID || "preview-user";

  try {
    const currentUser = await getCurrentAppUser();
    return currentUser?.id || fallback;
  } catch {
    return fallback;
  }
}

function getSupabase() {
  return createServiceClient();
}

function warnDbFallback(operation: string, error: unknown) {
  console.warn(`[jobs/storage] Supabase ${operation} failed; using local JSON fallback.`, error);
}

function sortByFitScore(jobs: EnrichedJob[]): EnrichedJob[] {
  return [...jobs].sort(
    (a, b) => (b.fit?.data?.fitScore || 0) - (a.fit?.data?.fitScore || 0)
  );
}

function mapDbJob(row: any): EnrichedJob {
  return {
    id: row.id,
    raw: row.raw,
    parsed: row.parsed,
    fit: row.fit,
    status: row.status,
    userNotes: row.user_notes || undefined,
    dedupeKey: row.dedupe_key,
    sourceQueryId: row.source_query_id || null,
    userId: row.user_id,
    followUpDate: row.follow_up_date || null,
    followUpNote: row.follow_up_note || null,
    stageChangedAt: row.stage_changed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDbRawJob(row: any): RawJobItem {
  return row.payload;
}

function mapJobForDb(userId: string, job: EnrichedJob) {
  return {
    id: job.id,
    user_id: userId,
    status: job.status,
    dedupe_key: job.dedupeKey,
    raw: job.raw,
    parsed: job.parsed,
    fit: job.fit,
    user_notes: job.userNotes || null,
    source_query_id: job.sourceQueryId || null,
    follow_up_date: job.followUpDate || null,
    follow_up_note: job.followUpNote || null,
    stage_changed_at: job.stageChangedAt || null,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  };
}

function withUser<T extends { userId?: string }>(items: T[], userId: string): T[] {
  return items
    .filter((item) => !item.userId || item.userId === userId)
    .map((item) => ({ ...item, userId }));
}

async function readFallbackJobIntel(userId: string): Promise<Map<string, StoredJobIntel>> {
  const items = await readCollection<StoredJobIntel>(Collections.JOB_INTEL);
  const scoped = withUser(items, userId);
  return new Map(scoped.map((item) => [item.id, item]));
}

async function persistFallbackJobIntel(userId: string, jobs: EnrichedJob[]) {
  const existing = await readCollection<StoredJobIntel>(Collections.JOB_INTEL);
  const untouched = existing.filter((item) => item.userId && item.userId !== userId);
  const currentUserRecords = existing.filter((item) => !item.userId || item.userId === userId);
  const nextMap = new Map(currentUserRecords.map((item) => [item.id, item]));
  for (const job of jobs) {
    const hasIntel =
      Boolean(job.companyIntel) ||
      Boolean(job.outreachStrategy) ||
      Boolean(job.decisionMakers && job.decisionMakers.length > 0);

    if (!hasIntel) {
      nextMap.delete(job.id);
      continue;
    }

    nextMap.set(job.id, {
      id: job.id,
      userId,
      companyIntel: job.companyIntel,
      decisionMakers: job.decisionMakers,
      outreachStrategy: job.outreachStrategy,
      updatedAt: job.updatedAt,
    });
  }

  await writeCollection(Collections.JOB_INTEL, [
    ...untouched,
    ...Array.from(nextMap.values()),
  ]);
}

async function mergeJobIntel(userId: string, jobs: EnrichedJob[]): Promise<EnrichedJob[]> {
  const intelMap = await readFallbackJobIntel(userId);
  return jobs.map((job) => {
    const intel = intelMap.get(job.id);
    if (!intel) {
      return job;
    }

    return {
      ...job,
      companyIntel: job.companyIntel ?? intel.companyIntel ?? null,
      decisionMakers: job.decisionMakers?.length
        ? job.decisionMakers
        : intel.decisionMakers || [],
      outreachStrategy: job.outreachStrategy ?? intel.outreachStrategy ?? null,
    };
  });
}

async function readFallbackRawJobs(userId: string): Promise<RawJobItem[]> {
  const items = await readCollection<StoredRawJob>(Collections.JOBS_RAW);
  return withUser(items, userId).map(({ userId: _userId, ...job }) => job);
}

async function readFallbackJobs(
  collection: string,
  userId: string
): Promise<EnrichedJob[]> {
  const items = await readCollection<StoredEnrichedJob>(collection);
  return withUser(items, userId).map(({ userId: _userId, ...job }) => job);
}

async function readFallbackMergedJobs(userId: string): Promise<EnrichedJob[]> {
  const [inbox, enriched, rejected, ranked] = await Promise.all([
    readFallbackJobs(Collections.JOBS_INBOX, userId),
    readFallbackJobs(Collections.JOBS_ENRICHED, userId),
    readFallbackJobs(Collections.JOBS_REJECTED, userId),
    readFallbackJobs(Collections.JOBS_RANKED, userId),
  ]);

  const merged = new Map<string, EnrichedJob>();
  for (const job of [...ranked, ...rejected, ...enriched, ...inbox]) {
    const existing = merged.get(job.id);
    if (!existing || existing.updatedAt < job.updatedAt) {
      merged.set(job.id, job);
    }
  }

  return Array.from(merged.values());
}

async function writeFallbackRawJobs(userId: string, jobs: RawJobItem[]) {
  const existing = await readCollection<StoredRawJob>(Collections.JOBS_RAW);
  const next = existing.filter((item) => item.userId && item.userId !== userId);
  next.push(...jobs.map((job) => ({ ...job, userId })));
  await writeCollection(Collections.JOBS_RAW, next);
}

async function writeFallbackJobs(
  collection: string,
  userId: string,
  jobs: EnrichedJob[]
) {
  const existing = await readCollection<StoredEnrichedJob>(collection);
  const next = existing.filter((item) => item.userId && item.userId !== userId);
  next.push(...jobs.map((job) => ({ ...job, userId })));
  await writeCollection(collection, next);
}

async function readDbJobs(userId: string, statuses?: UserJobStatus[]) {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    let query = supabase
      .from("jobs")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (statuses && statuses.length > 0) {
      query = query.in("status", statuses);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapDbJob);
  } catch (err) {
    warnDbFallback("job read", err);
    return null;
  }
}

async function readDbRawJobs(userId: string) {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("raw_jobs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDbRawJob);
  } catch (err) {
    warnDbFallback("raw job read", err);
    return null;
  }
}

async function upsertDbJobs(userId: string, jobs: EnrichedJob[]) {
  const supabase = getSupabase();
  if (!supabase) return null;

  if (jobs.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from("jobs")
      .upsert(jobs.map((job) => mapJobForDb(userId, job)), { onConflict: "id" })
      .select("*");

    if (error) throw error;
    return (data || []).map(mapDbJob);
  } catch (err) {
    warnDbFallback("job upsert", err);
    return null;
  }
}

async function replaceDbJobsByStatus(
  userId: string,
  statuses: UserJobStatus[],
  jobs: EnrichedJob[]
) {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { error } = await supabase
      .from("jobs")
      .delete()
      .eq("user_id", userId)
      .in("status", statuses);
    if (error) throw error;
    return upsertDbJobs(userId, jobs);
  } catch (err) {
    warnDbFallback("job replace", err);
    return null;
  }
}

async function upsertDbRawJobs(userId: string, jobs: RawJobItem[]) {
  const supabase = getSupabase();
  if (!supabase) return null;

  if (jobs.length === 0) return [];

  try {
    const now = new Date().toISOString();
    const { error } = await supabase.from("raw_jobs").upsert(
      jobs.map((job, index) => ({
        id: `${userId}-${job.source}-${job.sourceJobId || index}-${job.fetchedAt}`,
        user_id: userId,
        source: job.source,
        payload: job,
        dedupe_key: (job as RawJobItem & { dedupeKey?: string }).dedupeKey || null,
        fetched_at: job.fetchedAt,
        created_at: now,
        updated_at: now,
      })),
      { onConflict: "id" }
    );
    if (error) throw error;
  } catch (err) {
    warnDbFallback("raw job upsert", err);
    return null;
  }

  return jobs;
}

export async function getRawJobs(userId?: string): Promise<RawJobItem[]> {
  const actorId = await resolveActorId(userId);
  const dbJobs = await readDbRawJobs(actorId);
  if (dbJobs) {
    return dbJobs;
  }
  return readFallbackRawJobs(actorId);
}

export async function saveRawJobs(
  jobs: RawJobItem[],
  userId?: string
): Promise<void> {
  const actorId = await resolveActorId(userId);
  const dbResult = await upsertDbRawJobs(actorId, jobs);
  if (dbResult) {
    return;
  }

  const existing = await readCollection<StoredRawJob>(Collections.JOBS_RAW);
  const next = [
    ...existing,
    ...jobs.map((job) => ({ ...job, userId: actorId })),
  ];
  await writeCollection(Collections.JOBS_RAW, next);
}

export async function overwriteRawJobs(
  jobs: RawJobItem[],
  userId?: string
): Promise<void> {
  const actorId = await resolveActorId(userId);
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from("raw_jobs").delete().eq("user_id", actorId);
      if (error) throw error;
      const dbResult = await upsertDbRawJobs(actorId, jobs);
      if (dbResult) {
        return;
      }
    } catch (err) {
      warnDbFallback("raw job overwrite", err);
    }
  }

  await writeFallbackRawJobs(actorId, jobs);
}

export async function getEnrichedJobs(userId?: string): Promise<EnrichedJob[]> {
  const actorId = await resolveActorId(userId);
  const dbJobs = await readDbJobs(actorId, ["shortlisted", "tracked", "applied", "interview", "offer", "archived"]);
  if (dbJobs) {
    return mergeJobIntel(actorId, dbJobs);
  }
  const jobs = await readFallbackMergedJobs(actorId);
  return mergeJobIntel(
    actorId,
    jobs.filter((job) => ["shortlisted", "tracked", "applied", "interview", "offer", "archived"].includes(job.status))
  );
}

export async function saveEnrichedJobs(
  jobs: EnrichedJob[],
  userId?: string
): Promise<void> {
  const actorId = await resolveActorId(userId);
  await persistFallbackJobIntel(actorId, jobs);
  const dbResult = await upsertDbJobs(actorId, jobs);
  if (dbResult) {
    return;
  }

  const existing = await readCollection<StoredEnrichedJob>(Collections.JOBS_ENRICHED);
  await writeCollection(Collections.JOBS_ENRICHED, [
    ...existing,
    ...jobs.map((job) => ({ ...job, userId: actorId })),
  ]);
}

export async function overwriteEnrichedJobs(
  jobs: EnrichedJob[],
  userId?: string
): Promise<void> {
  const actorId = await resolveActorId(userId);
  await persistFallbackJobIntel(actorId, jobs);
  const dbResult = await replaceDbJobsByStatus(actorId, ["shortlisted", "tracked", "applied", "interview", "offer", "archived"], jobs);
  if (dbResult) {
    return;
  }
  await writeFallbackJobs(Collections.JOBS_ENRICHED, actorId, jobs);
}

export async function updateEnrichedJob(
  id: string,
  updater: (job: EnrichedJob) => EnrichedJob,
  userId?: string
): Promise<boolean> {
  const actorId = await resolveActorId(userId);
  const jobs = await getEnrichedJobs(actorId);
  const current = jobs.find((job) => job.id === id);
  if (!current) return false;

  const updated = updater(current);
  const next = jobs.map((job) => (job.id === id ? updated : job));
  await overwriteEnrichedJobs(next, actorId);
  return true;
}

export async function getJobById(
  id: string,
  userId?: string
): Promise<EnrichedJob | null> {
  const actorId = await resolveActorId(userId);
  const dbJobs = await readDbJobs(actorId);
  if (dbJobs) {
    const merged = await mergeJobIntel(actorId, dbJobs);
    return merged.find((job) => job.id === id) || null;
  }

  const jobs = await readFallbackMergedJobs(actorId);
  const merged = await mergeJobIntel(actorId, jobs);
  return merged.find((job) => job.id === id) || null;
}

export async function getInboxJobs(userId?: string): Promise<EnrichedJob[]> {
  const actorId = await resolveActorId(userId);
  const dbJobs = await readDbJobs(actorId, ["inbox"]);
  if (dbJobs) {
    return mergeJobIntel(actorId, dbJobs);
  }
  const jobs = await readFallbackMergedJobs(actorId);
  return mergeJobIntel(
    actorId,
    jobs.filter((job) => job.status === "inbox")
  );
}

export async function saveToInbox(
  jobs: EnrichedJob[],
  userId?: string
): Promise<void> {
  const actorId = await resolveActorId(userId);
  const normalized = jobs.map((job) => ({ ...job, status: "inbox" as const }));
  await persistFallbackJobIntel(actorId, normalized);
  const dbResult = await upsertDbJobs(actorId, normalized);
  if (dbResult) {
    return;
  }

  const existing = await readCollection<StoredEnrichedJob>(Collections.JOBS_INBOX);
  await writeCollection(Collections.JOBS_INBOX, [
    ...existing,
    ...normalized.map((job) => ({ ...job, userId: actorId })),
  ]);
}

export async function overwriteInbox(
  jobs: EnrichedJob[],
  userId?: string
): Promise<void> {
  const actorId = await resolveActorId(userId);
  await persistFallbackJobIntel(actorId, jobs);
  const dbResult = await replaceDbJobsByStatus(actorId, ["inbox"], jobs);
  if (dbResult) {
    return;
  }
  await writeFallbackJobs(Collections.JOBS_INBOX, actorId, jobs);
}

export async function removeFromInbox(id: string, userId?: string): Promise<boolean> {
  const actorId = await resolveActorId(userId);
  const inbox = await getInboxJobs(actorId);
  const filtered = inbox.filter((job) => job.id !== id);
  if (filtered.length === inbox.length) return false;
  await overwriteInbox(filtered, actorId);
  return true;
}

export async function getRankedJobs(userId?: string): Promise<EnrichedJob[]> {
  const actorId = await resolveActorId(userId);
  const dbJobs = await readDbJobs(actorId, ["inbox", "tracked", "applied"]);
  if (dbJobs) {
    return sortByFitScore(await mergeJobIntel(actorId, dbJobs));
  }

  const ranked = (await readFallbackMergedJobs(actorId)).filter((job) =>
    ["inbox", "shortlisted", "tracked", "applied", "interview", "offer"].includes(job.status)
  );
  return sortByFitScore(await mergeJobIntel(actorId, ranked));
}

export async function overwriteRankedJobs(
  jobs: EnrichedJob[],
  userId?: string
): Promise<void> {
  const actorId = await resolveActorId(userId);
  await persistFallbackJobIntel(actorId, jobs);
  const dbResult = await upsertDbJobs(actorId, jobs);
  if (dbResult) {
    return;
  }
  await writeFallbackJobs(Collections.JOBS_RANKED, actorId, jobs);
}

export async function updateStoredJob(
  id: string,
  updater: (job: EnrichedJob) => EnrichedJob,
  userId?: string
): Promise<boolean> {
  const actorId = await resolveActorId(userId);
  const current = await getJobById(id, actorId);
  if (!current) {
    return false;
  }

  const updated = updater(current);
  await persistFallbackJobIntel(actorId, [updated]);

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .upsert([mapJobForDb(actorId, updated)], { onConflict: "id" })
        .select("id");
      if (error) throw error;
      if (data && data.length > 0) {
        return true;
      }
    } catch (err) {
      warnDbFallback("job update", err);
    }
  }

  const collections = [
    Collections.JOBS_INBOX,
    Collections.JOBS_ENRICHED,
    Collections.JOBS_REJECTED,
    Collections.JOBS_RANKED,
  ];

  let updatedAny = false;

  for (const collection of collections) {
    const items = await readCollection<StoredEnrichedJob>(collection);
    let changed = false;
    const nextItems = items.map((item) => {
      const sameUser = !item.userId || item.userId === actorId;
      if (!sameUser || item.id !== id) {
        return item;
      }

      updatedAny = true;
      changed = true;
      return {
        ...updated,
        userId: actorId,
      };
    });

    if (changed) {
      await writeCollection(collection, nextItems);
    }
  }

  return updatedAny;
}

export async function getRejectedJobs(userId?: string): Promise<EnrichedJob[]> {
  const actorId = await resolveActorId(userId);
  const dbJobs = await readDbJobs(actorId, ["rejected"]);
  if (dbJobs) {
    return mergeJobIntel(actorId, dbJobs);
  }
  const jobs = await readFallbackMergedJobs(actorId);
  return mergeJobIntel(
    actorId,
    jobs.filter((job) => job.status === "rejected")
  );
}

export async function saveToRejected(
  jobs: EnrichedJob[],
  userId?: string
): Promise<void> {
  const actorId = await resolveActorId(userId);
  const normalized = jobs.map((job) => ({ ...job, status: "rejected" as const }));
  await persistFallbackJobIntel(actorId, normalized);
  const dbResult = await upsertDbJobs(actorId, normalized);
  if (dbResult) {
    return;
  }

  const existing = await readCollection<StoredEnrichedJob>(Collections.JOBS_REJECTED);
  await writeCollection(Collections.JOBS_REJECTED, [
    ...existing,
    ...normalized.map((job) => ({ ...job, userId: actorId })),
  ]);
}

async function updateJobStatus(
  id: string,
  status: UserJobStatus,
  userId?: string
): Promise<boolean> {
  const actorId = await resolveActorId(userId);
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("user_id", actorId)
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (data && data.length > 0) {
        return true;
      }
    } catch (err) {
      warnDbFallback("job status update", err);
    }
  }

  const collections = [
    Collections.JOBS_INBOX,
    Collections.JOBS_ENRICHED,
    Collections.JOBS_REJECTED,
    Collections.JOBS_RANKED,
  ];

  for (const collection of collections) {
    const items = await readCollection<StoredEnrichedJob>(collection);
    const index = items.findIndex(
      (item) => item.id === id && (!item.userId || item.userId === actorId)
    );
    if (index >= 0) {
      items[index] = {
        ...items[index],
        status,
        userId: actorId,
        updatedAt: new Date().toISOString(),
      };
      await writeCollection(collection, items);
      return true;
    }
  }

  return false;
}

export async function trackJob(id: string, userId?: string): Promise<boolean> {
  return updateJobStatus(id, "tracked", userId);
}

export async function rejectJob(id: string, userId?: string): Promise<boolean> {
  return updateJobStatus(id, "rejected", userId);
}

export async function unrejectJob(id: string, userId?: string): Promise<boolean> {
  return updateJobStatus(id, "inbox", userId);
}

export async function markApplied(id: string, userId?: string): Promise<boolean> {
  return updateJobStatus(id, "applied", userId);
}

export async function changeStage(id: string, status: UserJobStatus, userId?: string): Promise<boolean> {
  const actorId = await resolveActorId(userId);
  const supabase = getSupabase();
  const now = new Date().toISOString();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .update({ status, stage_changed_at: now, updated_at: now })
        .eq("user_id", actorId)
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (data && data.length > 0) {
        return true;
      }
    } catch (err) {
      warnDbFallback("job stage update", err);
    }
  }

  return updateStoredJob(
    id,
    (job) => ({ ...job, status, stageChangedAt: now, updatedAt: now }),
    actorId
  );
}

export async function setFollowUp(
  id: string,
  followUpDate: string | null,
  followUpNote: string | null,
  userId?: string
): Promise<boolean> {
  const actorId = await resolveActorId(userId);
  const now = new Date().toISOString();
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .update({ follow_up_date: followUpDate, follow_up_note: followUpNote, updated_at: now })
        .eq("user_id", actorId)
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (data && data.length > 0) {
        return true;
      }
    } catch (err) {
      warnDbFallback("job follow-up update", err);
    }
  }

  return updateStoredJob(
    id,
    (job) => ({ ...job, followUpDate, followUpNote, updatedAt: now }),
    actorId
  );
}

export async function updateJobNotes(
  id: string,
  notes: string,
  userId?: string
): Promise<boolean> {
  const actorId = await resolveActorId(userId);
  const now = new Date().toISOString();
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .update({ user_notes: notes, updated_at: now })
        .eq("user_id", actorId)
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (data && data.length > 0) {
        return true;
      }
    } catch (err) {
      warnDbFallback("job notes update", err);
    }
  }

  return updateStoredJob(
    id,
    (job) => ({ ...job, userNotes: notes, updatedAt: now }),
    actorId
  );
}

export async function getAllDedupeKeys(userId?: string): Promise<Set<string>> {
  const [raw, enriched, inbox, ranked, rejected] = await Promise.all([
    getRawJobs(userId),
    getEnrichedJobs(userId),
    getInboxJobs(userId),
    getRankedJobs(userId),
    getRejectedJobs(userId),
  ]);

  const keys = new Set<string>();

  for (const job of raw) {
    if ((job as RawJobItem & { dedupeKey?: string }).dedupeKey) {
      keys.add((job as RawJobItem & { dedupeKey?: string }).dedupeKey!);
    }
  }

  for (const collection of [enriched, inbox, ranked, rejected]) {
    for (const job of collection) {
      if (job.dedupeKey) {
        keys.add(job.dedupeKey);
      }
    }
  }

  return keys;
}

export async function getJobStats(userId?: string): Promise<{
  raw: number;
  enriched: number;
  inbox: number;
  ranked: number;
  rejected: number;
  tracked: number;
  applied: number;
}> {
  const [raw, enriched, inbox, ranked, rejected] = await Promise.all([
    getRawJobs(userId),
    getEnrichedJobs(userId),
    getInboxJobs(userId),
    getRankedJobs(userId),
    getRejectedJobs(userId),
  ]);

  return {
    raw: raw.length,
    enriched: enriched.length,
    inbox: inbox.length,
    ranked: ranked.length,
    rejected: rejected.length,
    tracked: enriched.filter((job) => job.status === "tracked").length,
    applied: enriched.filter((job) => job.status === "applied").length,
  };
}
