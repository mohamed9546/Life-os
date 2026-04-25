import { EnrichedJob } from "@/types";
import { getRoleTrackLabel } from "@/lib/career/role-track-labels";
import {
  getEnrichedJobs,
  getInboxJobs,
  getRankedJobs,
  getRejectedJobs,
} from "@/lib/jobs/storage";
import { readObject, writeObject } from "@/lib/storage";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const NOTION_JOB_SYNC_MAP = "notion-job-sync-map";

type NotionSyncMap = Record<string, string>;

type NotionProperty = {
  id: string;
  type: string;
};

type NotionDatabase = {
  properties: Record<string, NotionProperty>;
};

export interface NotionSyncResult {
  configured: boolean;
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

function getNotionConfig() {
  const token =
    process.env.NOTION_API_KEY?.trim() ||
    process.env.NOTION_TOKEN?.trim() ||
    "";
  const databaseId = process.env.NOTION_DATABASE_ID?.trim() || "";
  return {
    token,
    databaseId,
    configured: Boolean(token && databaseId),
  };
}

function syncKey(userId: string, jobId: string): string {
  return `${userId}:${jobId}`;
}

function normalizePropertyName(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function notionFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const config = getNotionConfig();
  if (!config.configured) {
    throw new Error("Notion is not configured.");
  }

  return fetch(`${NOTION_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

async function getDatabase(): Promise<NotionDatabase> {
  const config = getNotionConfig();
  const response = await notionFetch(`/databases/${config.databaseId}`);
  if (!response.ok) {
    throw new Error(`Notion database lookup failed: ${response.status}`);
  }
  return (await response.json()) as NotionDatabase;
}

function getTitlePropertyName(database: NotionDatabase): string {
  for (const [name, property] of Object.entries(database.properties)) {
    if (property.type === "title") return name;
  }
  throw new Error("Notion database is missing a title property.");
}

function findPropertyName(
  database: NotionDatabase,
  aliases: string[],
  allowedTypes?: string[]
): string | null {
  const wanted = aliases.map(normalizePropertyName);
  for (const [name, property] of Object.entries(database.properties)) {
    if (allowedTypes && !allowedTypes.includes(property.type)) continue;
    if (wanted.includes(normalizePropertyName(name))) {
      return name;
    }
  }
  return null;
}

function buildSelectValue(name: string) {
  return { name: name.slice(0, 100) };
}

function setTextLikeProperty(
  properties: Record<string, unknown>,
  database: NotionDatabase,
  aliases: string[],
  value: string | null | undefined
) {
  if (!value) return;
  const name = findPropertyName(database, aliases, ["rich_text", "url"]);
  if (!name) return;
  const property = database.properties[name];
  properties[name] =
    property.type === "url"
      ? { url: value }
      : { rich_text: [{ text: { content: value.slice(0, 2000) } }] };
}

function setNumberProperty(
  properties: Record<string, unknown>,
  database: NotionDatabase,
  aliases: string[],
  value: number | null | undefined
) {
  if (typeof value !== "number" || Number.isNaN(value)) return;
  const name = findPropertyName(database, aliases, ["number"]);
  if (!name) return;
  properties[name] = { number: value };
}

function setOptionProperty(
  properties: Record<string, unknown>,
  database: NotionDatabase,
  aliases: string[],
  value: string | null | undefined
) {
  if (!value) return;
  const name = findPropertyName(database, aliases, ["select", "status"]);
  if (!name) return;
  const property = database.properties[name];
  properties[name] =
    property.type === "status"
      ? { status: buildSelectValue(value) }
      : { select: buildSelectValue(value) };
}

function setDateProperty(
  properties: Record<string, unknown>,
  database: NotionDatabase,
  aliases: string[],
  value: string | null | undefined
) {
  if (!value) return;
  const name = findPropertyName(database, aliases, ["date"]);
  if (!name) return;
  properties[name] = { date: { start: value } };
}

function buildJobProperties(database: NotionDatabase, job: EnrichedJob) {
  const properties: Record<string, unknown> = {};
  const titleName = getTitlePropertyName(database);
  properties[titleName] = {
    title: [{ text: { content: `${job.raw.title}`.slice(0, 2000) } }],
  };

  setTextLikeProperty(properties, database, ["company"], job.raw.company);
  setOptionProperty(properties, database, ["status", "stage"], job.status);
  setNumberProperty(properties, database, ["fit score", "fitscore", "score"], job.fit?.data?.fitScore);
  setOptionProperty(properties, database, ["priority", "priority band", "priorityband"], job.fit?.data?.priorityBand);
  setTextLikeProperty(properties, database, ["source"], job.raw.source);
  setTextLikeProperty(properties, database, ["location"], job.parsed?.data?.location || job.raw.location);
  setTextLikeProperty(properties, database, ["role track", "roletrack", "track"], getRoleTrackLabel(job.parsed?.data?.roleTrack));
  setTextLikeProperty(properties, database, ["apply url", "applyurl", "link", "url"], job.raw.link || null);
  setTextLikeProperty(
    properties,
    database,
    ["summary", "notes", "details"],
    job.parsed?.data?.summary || job.fit?.data?.whyMatched?.[0] || null
  );
  setDateProperty(properties, database, ["updated at", "updatedat"], job.updatedAt);
  setDateProperty(properties, database, ["fetched at", "fetchedat"], job.raw.fetchedAt);

  return properties;
}

async function readSyncMap(): Promise<NotionSyncMap> {
  return (await readObject<NotionSyncMap>(NOTION_JOB_SYNC_MAP)) || {};
}

async function writeSyncMap(map: NotionSyncMap): Promise<void> {
  await writeObject(NOTION_JOB_SYNC_MAP, map);
}

async function createPage(database: NotionDatabase, job: EnrichedJob): Promise<string> {
  const config = getNotionConfig();
  const response = await notionFetch("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: config.databaseId },
      properties: buildJobProperties(database, job),
    }),
  });
  if (!response.ok) {
    throw new Error(`Notion page create failed: ${response.status}`);
  }
  const data = (await response.json()) as { id: string };
  return data.id;
}

async function updatePage(pageId: string, database: NotionDatabase, job: EnrichedJob): Promise<boolean> {
  const response = await notionFetch(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: buildJobProperties(database, job) }),
  });
  if (response.ok) return true;
  if (response.status === 404) return false;
  throw new Error(`Notion page update failed: ${response.status}`);
}

function mergeJobs(jobs: EnrichedJob[]): EnrichedJob[] {
  const map = new Map<string, EnrichedJob>();
  for (const job of jobs) {
    const existing = map.get(job.id);
    if (!existing || existing.updatedAt < job.updatedAt) {
      map.set(job.id, job);
    }
  }
  return Array.from(map.values());
}

export async function syncJobsToNotion(userId: string, jobs: EnrichedJob[]): Promise<NotionSyncResult> {
  const config = getNotionConfig();
  if (!config.configured) {
    return {
      configured: false,
      synced: 0,
      created: 0,
      updated: 0,
      skipped: jobs.length,
      errors: [],
    };
  }

  const database = await getDatabase();
  const syncMap = await readSyncMap();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const job of mergeJobs(jobs)) {
    try {
      const key = syncKey(userId, job.id);
      const existingPageId = syncMap[key];
      if (existingPageId) {
        const ok = await updatePage(existingPageId, database, job);
        if (ok) {
          updated += 1;
          continue;
        }
      }

      const pageId = await createPage(database, job);
      syncMap[key] = pageId;
      created += 1;
    } catch (err) {
      skipped += 1;
      errors.push(
        `${job.raw.title} @ ${job.raw.company}: ${err instanceof Error ? err.message : "sync failed"}`
      );
    }
  }

  await writeSyncMap(syncMap);
  return {
    configured: true,
    synced: created + updated,
    created,
    updated,
    skipped,
    errors,
  };
}

export async function syncAllJobsToNotion(userId: string): Promise<NotionSyncResult> {
  const [inbox, ranked, rejected, enriched] = await Promise.all([
    getInboxJobs(userId),
    getRankedJobs(userId),
    getRejectedJobs(userId),
    getEnrichedJobs(userId),
  ]);
  return syncJobsToNotion(userId, [...inbox, ...ranked, ...rejected, ...enriched]);
}

export async function syncJobsToNotionBestEffort(userId: string, jobs: EnrichedJob[]) {
  try {
    return await syncJobsToNotion(userId, jobs);
  } catch (err) {
    console.warn("[notion] job sync failed:", err);
    return null;
  }
}

export async function syncAllJobsToNotionBestEffort(userId: string) {
  try {
    return await syncAllJobsToNotion(userId);
  } catch (err) {
    console.warn("[notion] full job sync failed:", err);
    return null;
  }
}
