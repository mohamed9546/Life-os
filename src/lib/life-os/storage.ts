import { readCollection, writeCollection, Collections } from "@/lib/storage";
import { AIResult, WeeklyReview } from "@/types";

export interface StoredWeeklyReviewEntry {
  id: string;
  userId?: string;
  review: AIResult<WeeklyReview>;
  input: unknown;
  createdAt: string;
  updatedAt: string;
}

function scopeItems<T extends { userId?: string }>(items: T[], userId: string): T[] {
  return items.filter((item) => !item.userId || item.userId === userId);
}

export async function getWeeklyReviewEntries(
  userId: string
): Promise<StoredWeeklyReviewEntry[]> {
  const items = await readCollection<StoredWeeklyReviewEntry>(Collections.WEEKLY_REVIEWS);
  return scopeItems(items, userId)
    .map(({ userId: _userId, ...item }) => item)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveWeeklyReviewEntry(
  entry: Omit<StoredWeeklyReviewEntry, "id" | "createdAt" | "updatedAt" | "userId">,
  userId: string
): Promise<StoredWeeklyReviewEntry> {
  const existing = await readCollection<StoredWeeklyReviewEntry>(Collections.WEEKLY_REVIEWS);
  const now = new Date().toISOString();
  const nextEntry: StoredWeeklyReviewEntry = {
    id: `review-${Date.now()}`,
    userId,
    review: entry.review,
    input: entry.input,
    createdAt: now,
    updatedAt: now,
  };

  const otherUsers = existing.filter((item) => item.userId && item.userId !== userId);
  const currentUsers = scopeItems(existing, userId).slice(0, 24);

  await writeCollection(Collections.WEEKLY_REVIEWS, [
    nextEntry,
    ...currentUsers,
    ...otherUsers,
  ]);

  return nextEntry;
}
