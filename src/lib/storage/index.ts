// ============================================================
// Local JSON file storage layer.
// On Cloud Run (read-only FS), uses /tmp/data as fallback.
// When Supabase is configured, this layer is mostly bypassed.
// ============================================================

import { promises as fs } from "fs";
import path from "path";
import { createServiceClient } from "@/lib/supabase/service";

// Helper to get supabase if configured
function getSupabase() {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}

// Cloud Run has a read-only filesystem except /tmp.
const PRIMARY_DATA_DIR = path.join(process.cwd(), "data");
const FALLBACK_DATA_DIR = "/tmp/data";
let resolvedDataDir: string | null = null;
let warnedAboutEphemeralFallback = false;

function isCloudRunEnvironment(): boolean {
  return !!process.env.K_SERVICE || !!process.env.GOOGLE_CLOUD_PROJECT;
}

async function getDataDir(): Promise<string> {
  if (resolvedDataDir) return resolvedDataDir;

  if (isCloudRunEnvironment()) {
    try {
      await fs.mkdir(FALLBACK_DATA_DIR, { recursive: true });
    } catch {
      // ignore
    }
    resolvedDataDir = FALLBACK_DATA_DIR;
  } else {
    try {
      await fs.mkdir(PRIMARY_DATA_DIR, { recursive: true });
    } catch {
      // ignore
    }
    resolvedDataDir = PRIMARY_DATA_DIR;
  }

  return resolvedDataDir;
}

// Fires the first time we fall back to ephemeral /tmp on Cloud Run without
// Supabase. Without this the app silently writes to a per-instance tmpfs
// that's wiped on every deploy and container restart — looks fine in dev,
// then the phone sees "nothing happened" after each redeploy.
function warnEphemeralFallbackOnce(reason: string): void {
  if (!isCloudRunEnvironment()) return;
  if (warnedAboutEphemeralFallback) return;
  warnedAboutEphemeralFallback = true;
  console.error(
    `[storage] WARNING: Cloud Run detected but Supabase is not usable (${reason}). ` +
      `Writes will go to /tmp/data and be LOST on every container restart. ` +
      `Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on the service.`
  );
}

async function ensureDataDir(): Promise<void> {
  await getDataDir();
}

async function filePath(collection: string): Promise<string> {
  const dir = await getDataDir();
  return path.join(dir, `${collection}.json`);
}

/**
 * Read a full collection.
 * Uses Supabase storage_kv if available, otherwise falls back to disk.
 */
export async function readCollection<T>(collection: string): Promise<T[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("storage_kv")
        .select("value")
        .eq("key", collection)
        .maybeSingle();

      if (error) throw error;
      if (data && data.value) {
        return Array.isArray(data.value) ? data.value : [];
      }
      return [];
    } catch (err) {
      console.error(`[storage] Error reading collection ${collection} from Supabase:`, err);
      // Fallback to disk on error
    }
  } else {
    warnEphemeralFallbackOnce("getSupabase() returned null");
  }

  await ensureDataDir();
  const fp = await filePath(collection);
  try {
    const raw = await fs.readFile(fp, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    console.error(`[storage] Error reading ${collection}:`, err);
    return [];
  }
}

/**
 * Write a full collection (overwrite).
 */
export async function writeCollection<T>(
  collection: string,
  data: T[]
): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("storage_kv")
        .upsert({ key: collection, value: data, updated_at: new Date().toISOString() });
      if (error) throw error;
      return; // Return early if Supabase write succeeds
    } catch (err) {
      console.error(`[storage] Error writing collection ${collection} to Supabase:`, err);
      // Fallback to disk on error
    }
  } else {
    warnEphemeralFallbackOnce("getSupabase() returned null");
  }

  await ensureDataDir();
  const fp = await filePath(collection);
  try {
    await fs.writeFile(fp, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`[storage] Error writing ${collection}:`, err);
  }
}

// Per-collection lock chain. `appendToCollection` is read-modify-write
// against a single JSONB row, so concurrent callers (e.g. the pipeline
// firing multiple AI log entries while enriching in parallel) race and
// lose entries. Serializing per collection inside a single process is
// cheap and correct for the in-process case (the worker is a separate
// process but doesn't touch ai-log directly).
const appendLocks = new Map<string, Promise<unknown>>();

/**
 * Append items to a collection. Serialized per-collection within this
 * process so concurrent appends don't stomp on each other.
 */
export async function appendToCollection<T>(
  collection: string,
  items: T[]
): Promise<void> {
  const prev = appendLocks.get(collection) ?? Promise.resolve();
  const next = prev.then(async () => {
    const existing = await readCollection<T>(collection);
    existing.push(...items);
    await writeCollection(collection, existing);
  });
  // Swallow errors in the lock chain so one failure doesn't poison later
  // appends — the actual error still propagates to the caller below.
  appendLocks.set(
    collection,
    next.catch(() => undefined)
  );
  return next;
}

/**
 * Read a single config/object file (not an array).
 */
export async function readObject<T>(name: string): Promise<T | null> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("storage_kv")
        .select("value")
        .eq("key", name)
        .maybeSingle();

      if (error) throw error;
      if (data && data.value) {
        return data.value as T;
      }
      return null;
    } catch (err) {
      console.error(`[storage] Error reading object ${name} from Supabase:`, err);
      // Fallback to disk on error
    }
  } else {
    warnEphemeralFallbackOnce("getSupabase() returned null");
  }

  await ensureDataDir();
  const fp = await filePath(name);
  try {
    const raw = await fs.readFile(fp, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    console.error(`[storage] Error reading object ${name}:`, err);
    return null;
  }
}

/**
 * Write a single config/object file.
 */
export async function writeObject<T>(name: string, data: T): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("storage_kv")
        .upsert({ key: name, value: data, updated_at: new Date().toISOString() });
      if (error) throw error;
      return; // Return early if Supabase write succeeds
    } catch (err) {
      console.error(`[storage] Error writing object ${name} to Supabase:`, err);
      // Fallback to disk on error
    }
  } else {
    warnEphemeralFallbackOnce("getSupabase() returned null");
  }

  await ensureDataDir();
  const fp = await filePath(name);
  try {
    await fs.writeFile(fp, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`[storage] Error writing object ${name}:`, err);
  }
}

/**
 * Update items in a collection by ID.
 */
export async function updateInCollection<T extends { id: string }>(
  collection: string,
  id: string,
  updater: (item: T) => T
): Promise<boolean> {
  const items = await readCollection<T>(collection);
  let found = false;
  const updated = items.map((item) => {
    if (item.id === id) {
      found = true;
      return updater(item);
    }
    return item;
  });
  if (found) {
    await writeCollection(collection, updated);
  }
  return found;
}

/**
 * Remove an item from a collection by ID.
 */
export async function removeFromCollection<T extends { id: string }>(
  collection: string,
  id: string
): Promise<boolean> {
  const items = await readCollection<T>(collection);
  const filtered = items.filter((item) => item.id !== id);
  if (filtered.length < items.length) {
    await writeCollection(collection, filtered);
    return true;
  }
  return false;
}

// Collection name constants for type safety
export const Collections = {
  JOBS_RAW: "jobs-raw",
  JOBS_ENRICHED: "jobs-enriched",
  JOBS_RANKED: "jobs-ranked",
  JOBS_REJECTED: "jobs-rejected",
  JOBS_INBOX: "jobs-inbox",
  CAREER_PROFILES: "career-profiles",
  SAVED_SEARCHES: "saved-searches",
  SOURCE_PREFERENCES: "source-preferences",
  JOB_EVENTS: "job-events",
  JOB_INTEL: "job-intel",
  PIPELINE_RUNS: "pipeline-runs",
  WORKER_RUNS: "worker-runs",
  TRANSACTIONS: "transactions",
  MERCHANT_RULES: "merchant-rules",
  MONEY_REVIEWS: "money-reviews",
  DECISIONS: "decisions",
  DECISION_PATTERN_REVIEWS: "decision-pattern-reviews",
  WEEKLY_REVIEWS: "weekly-reviews",
  ROUTINE_INSIGHTS: "routine-insights",
  ROUTINES: "routines",
  ROUTINE_CHECKINS: "routine-checkins",
  IMPORT_RECORDS: "import-records",
  AI_LOG: "ai-log",
  WORKER_STATE: "worker-state",
} as const;

export const ConfigFiles = {
  APP_CONFIG: "app-config",
  USER_PROFILE: "user-profile",
  AI_USAGE: "ai-usage",
  AI_CONFIG: "ai-config",
} as const;
