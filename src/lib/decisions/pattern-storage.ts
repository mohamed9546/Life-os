import { Collections, readCollection, writeCollection } from "@/lib/storage";
import { AIResult, DecisionPatternReview } from "@/types";

export interface StoredDecisionPatternReviewEntry {
  id: string;
  userId?: string;
  review: AIResult<DecisionPatternReview>;
  input: unknown;
  createdAt: string;
  updatedAt: string;
}

function scopeItems<T extends { userId?: string }>(items: T[], userId: string): T[] {
  return items.filter((item) => !item.userId || item.userId === userId);
}

export async function getDecisionPatternReviews(
  userId: string
): Promise<StoredDecisionPatternReviewEntry[]> {
  const items = await readCollection<StoredDecisionPatternReviewEntry>(
    Collections.DECISION_PATTERN_REVIEWS
  );
  return scopeItems(items, userId)
    .map(({ userId: _userId, ...item }) => item)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveDecisionPatternReview(
  entry: Omit<StoredDecisionPatternReviewEntry, "id" | "createdAt" | "updatedAt" | "userId">,
  userId: string
): Promise<StoredDecisionPatternReviewEntry> {
  const items = await readCollection<StoredDecisionPatternReviewEntry>(
    Collections.DECISION_PATTERN_REVIEWS
  );
  const now = new Date().toISOString();
  const nextEntry: StoredDecisionPatternReviewEntry = {
    id: `decision-pattern-${Date.now()}`,
    userId,
    review: entry.review,
    input: entry.input,
    createdAt: now,
    updatedAt: now,
  };

  const otherUsers = items.filter((item) => item.userId && item.userId !== userId);
  const currentUsers = scopeItems(items, userId).slice(0, 12);
  await writeCollection(Collections.DECISION_PATTERN_REVIEWS, [
    nextEntry,
    ...currentUsers,
    ...otherUsers,
  ]);
  return nextEntry;
}
