import { v4 as uuid } from "uuid";
import {
  ApplicationLog,
  ApplicationAttemptStatus,
  ApplicationProfile,
  CvLibraryEntry,
  TargetCompany,
} from "@/types";
import { Collections, readCollection, writeCollection } from "@/lib/storage";
import {
  defaultApplicationProfile,
  defaultCvLibrary,
  defaultTargetCompanies,
} from "./defaults";

export interface ProcessedGmailAlert {
  id: string;
  userId: string;
  messageId: string;
  threadId?: string;
  source: string;
  processedAt: string;
}

function withUser<T extends { userId?: string }>(items: T[], userId: string): T[] {
  return items.filter((item) => !item.userId || item.userId === userId);
}

const ACTIONABLE_APPLICATION_STATUSES = new Set<ApplicationAttemptStatus>([
  "planned",
  "applied",
  "drafted",
  "paused",
]);

export function isActionableApplicationStatus(status: ApplicationAttemptStatus): boolean {
  return ACTIONABLE_APPLICATION_STATUSES.has(status);
}

export async function getTargetCompanies(): Promise<TargetCompany[]> {
  const existing = await readCollection<TargetCompany>(Collections.TARGET_COMPANIES);
  if (existing.length > 0) {
    return existing;
  }
  const seeded = defaultTargetCompanies();
  await writeCollection(Collections.TARGET_COMPANIES, seeded);
  return seeded;
}

export async function saveTargetCompanies(companies: TargetCompany[]) {
  await writeCollection(Collections.TARGET_COMPANIES, companies);
  return companies;
}

export async function getCvLibrary(): Promise<CvLibraryEntry[]> {
  const existing = await readCollection<CvLibraryEntry>(Collections.CV_LIBRARY);
  if (existing.length > 0) {
    return existing;
  }
  const seeded = defaultCvLibrary();
  await writeCollection(Collections.CV_LIBRARY, seeded);
  return seeded;
}

export async function saveCvLibrary(entries: CvLibraryEntry[]) {
  await writeCollection(Collections.CV_LIBRARY, entries);
  return entries;
}

export async function getApplicationProfile(
  userId: string,
  email: string
): Promise<ApplicationProfile> {
  const existing = await readCollection<ApplicationProfile>(
    Collections.APPLICATION_PROFILE
  );
  const profile = existing.find((item) => item.id === userId);
  if (profile) {
    return profile;
  }

  const created = defaultApplicationProfile(userId, email);
  await writeCollection(Collections.APPLICATION_PROFILE, [
    ...existing.filter((item) => item.id !== userId),
    created,
  ]);
  return created;
}

export async function saveApplicationProfile(profile: ApplicationProfile) {
  const existing = await readCollection<ApplicationProfile>(
    Collections.APPLICATION_PROFILE
  );
  await writeCollection(Collections.APPLICATION_PROFILE, [
    ...existing.filter((item) => item.id !== profile.id),
    { ...profile, updatedAt: new Date().toISOString() },
  ]);
}

export async function getApplicationLogs(
  userId: string,
  limit = 100
): Promise<ApplicationLog[]> {
  const logs = await readCollection<ApplicationLog & { userId?: string }>(
    Collections.APPLICATION_LOGS
  );
  return withUser(logs, userId)
    .sort(
      (left, right) =>
        new Date(right.attemptedAt).getTime() - new Date(left.attemptedAt).getTime()
    )
    .slice(0, limit)
    .map(({ userId: _userId, ...log }) => log);
}

export async function appendApplicationLogs(
  userId: string,
  logs: ApplicationLog[]
): Promise<ApplicationLog[]> {
  if (logs.length === 0) {
    return [];
  }

  const existing = await readCollection<ApplicationLog & { userId?: string }>(
    Collections.APPLICATION_LOGS
  );
  const next = [
    ...logs.map((log) => ({ ...log, userId })),
    ...existing,
  ].slice(0, 1000);
  await writeCollection(Collections.APPLICATION_LOGS, next);
  return logs;
}

export async function hasApplicationAttempt(
  userId: string,
  input: { dedupeKey?: string; sourceJobId?: string; applyUrl?: string }
): Promise<boolean> {
  const logs = (await getApplicationLogs(userId, 1000)).filter((log) =>
    isActionableApplicationStatus(log.status)
  );
  const normalizedUrl = normalizeUrl(input.applyUrl || "");
  return logs.some((log) => {
    if (input.dedupeKey && log.dedupeKey === input.dedupeKey) return true;
    if (normalizedUrl && normalizeUrl(log.applyUrl) === normalizedUrl) return true;
    return false;
  });
}

export async function getProcessedGmailAlerts(
  userId: string
): Promise<ProcessedGmailAlert[]> {
  const items = await readCollection<ProcessedGmailAlert>(
    Collections.PROCESSED_GMAIL_ALERTS
  );
  return items.filter((item) => item.userId === userId);
}

export async function markGmailAlertsProcessed(
  userId: string,
  alerts: Array<Omit<ProcessedGmailAlert, "id" | "userId" | "processedAt">>
) {
  if (alerts.length === 0) return;
  const existing = await readCollection<ProcessedGmailAlert>(
    Collections.PROCESSED_GMAIL_ALERTS
  );
  const seen = new Set(existing.map((item) => `${item.userId}:${item.messageId}`));
  const now = new Date().toISOString();
  const created = alerts
    .filter((alert) => !seen.has(`${userId}:${alert.messageId}`))
    .map((alert) => ({
      ...alert,
      id: uuid(),
      userId,
      processedAt: now,
    }));

  if (created.length > 0) {
    await writeCollection(Collections.PROCESSED_GMAIL_ALERTS, [
      ...created,
      ...existing,
    ].slice(0, 2000));
  }
}

export function normalizeUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}
