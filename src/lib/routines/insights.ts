import { Collections, readCollection, writeCollection } from "@/lib/storage";
import { AIResult, RoutineAnalytics } from "@/types";

export interface StoredRoutineInsightEntry {
  id: string;
  userId?: string;
  insight: AIResult<
    Pick<RoutineAnalytics, "consistencyScore" | "skippedLoopWarnings" | "nextBestAction">
  >;
  input: RoutineAnalytics;
  createdAt: string;
  updatedAt: string;
}

function scopeItems<T extends { userId?: string }>(items: T[], userId: string): T[] {
  return items.filter((item) => !item.userId || item.userId === userId);
}

export async function getRoutineInsights(userId: string): Promise<StoredRoutineInsightEntry[]> {
  const items = await readCollection<StoredRoutineInsightEntry>(Collections.ROUTINE_INSIGHTS);
  return scopeItems(items, userId)
    .map(({ userId: _userId, ...item }) => item)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveRoutineInsight(
  entry: Omit<StoredRoutineInsightEntry, "id" | "createdAt" | "updatedAt" | "userId">,
  userId: string
): Promise<StoredRoutineInsightEntry> {
  const items = await readCollection<StoredRoutineInsightEntry>(Collections.ROUTINE_INSIGHTS);
  const now = new Date().toISOString();
  const nextEntry: StoredRoutineInsightEntry = {
    id: `routine-insight-${Date.now()}`,
    userId,
    insight: entry.insight,
    input: entry.input,
    createdAt: now,
    updatedAt: now,
  };

  const otherUsers = items.filter((item) => item.userId && item.userId !== userId);
  const currentUsers = scopeItems(items, userId).slice(0, 12);
  await writeCollection(Collections.ROUTINE_INSIGHTS, [
    nextEntry,
    ...currentUsers,
    ...otherUsers,
  ]);
  return nextEntry;
}
