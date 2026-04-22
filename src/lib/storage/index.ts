// ============================================================
// Local JSON file storage layer.
// On Cloud Run (read-only FS), uses /tmp/data as fallback.
// When Supabase is configured, this layer is mostly bypassed.
// ============================================================

import { promises as fs } from "fs";
import path from "path";

// Cloud Run has a read-only filesystem except /tmp.
const PRIMARY_DATA_DIR = path.join(process.cwd(), "data");
const FALLBACK_DATA_DIR = "/tmp/data";
let resolvedDataDir: string | null = null;

async function getDataDir(): Promise<string> {
  if (resolvedDataDir) return resolvedDataDir;

  try {
    await fs.mkdir(PRIMARY_DATA_DIR, { recursive: true });
    // Verify write access — Docker volume mounts can be owned by root even
    // after mkdir succeeds, causing every subsequent write to fail with EACCES.
    await fs.access(PRIMARY_DATA_DIR, fs.constants.W_OK);
    resolvedDataDir = PRIMARY_DATA_DIR;
  } catch {
    // Read-only filesystem (Cloud Run) or unwritable Docker mount — use /tmp
    try {
      await fs.mkdir(FALLBACK_DATA_DIR, { recursive: true });
    } catch {
      // ignore
    }
    resolvedDataDir = FALLBACK_DATA_DIR;
  }
  return resolvedDataDir;
}

async function ensureDataDir(): Promise<void> {
  await getDataDir();
}

async function filePath(collection: string): Promise<string> {
  const dir = await getDataDir();
  return path.join(dir, `${collection}.json`);
}

/**
 * Read a full collection from disk.
 * Returns empty array if file doesn't exist.
 */
export async function readCollection<T>(collection: string): Promise<T[]> {
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
 * Write a full collection to disk (overwrite).
 */
export async function writeCollection<T>(
  collection: string,
  data: T[]
): Promise<void> {
  await ensureDataDir();
  const fp = await filePath(collection);
  try {
    await fs.writeFile(fp, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`[storage] Error writing ${collection}:`, err);
  }
}

/**
 * Append items to a collection.
 */
export async function appendToCollection<T>(
  collection: string,
  items: T[]
): Promise<void> {
  const existing = await readCollection<T>(collection);
  existing.push(...items);
  await writeCollection(collection, existing);
}

/**
 * Read a single config/object file (not an array).
 */
export async function readObject<T>(name: string): Promise<T | null> {
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
