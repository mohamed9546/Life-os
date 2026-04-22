import { Collections, readCollection, writeCollection } from "@/lib/storage";
import { AIResult, MerchantRule, MoneyReview } from "@/types";

export interface StoredMoneyReviewEntry {
  id: string;
  userId?: string;
  review: AIResult<MoneyReview>;
  input: unknown;
  createdAt: string;
  updatedAt: string;
}

function scopeItems<T extends { userId?: string }>(items: T[], userId: string): T[] {
  return items.filter((item) => !item.userId || item.userId === userId);
}

export async function getMoneyReviewEntries(
  userId: string
): Promise<StoredMoneyReviewEntry[]> {
  const items = await readCollection<StoredMoneyReviewEntry>(Collections.MONEY_REVIEWS);
  return scopeItems(items, userId)
    .map(({ userId: _userId, ...item }) => item)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveMoneyReviewEntry(
  entry: Omit<StoredMoneyReviewEntry, "id" | "createdAt" | "updatedAt" | "userId">,
  userId: string
): Promise<StoredMoneyReviewEntry> {
  const items = await readCollection<StoredMoneyReviewEntry>(Collections.MONEY_REVIEWS);
  const now = new Date().toISOString();
  const nextEntry: StoredMoneyReviewEntry = {
    id: `money-review-${Date.now()}`,
    userId,
    review: entry.review,
    input: entry.input,
    createdAt: now,
    updatedAt: now,
  };

  const otherUsers = items.filter((item) => item.userId && item.userId !== userId);
  const currentUsers = scopeItems(items, userId).slice(0, 24);
  await writeCollection(Collections.MONEY_REVIEWS, [nextEntry, ...currentUsers, ...otherUsers]);
  return nextEntry;
}

export async function getMerchantRules(userId: string): Promise<MerchantRule[]> {
  const items = await readCollection<(MerchantRule & { userId?: string })>(Collections.MERCHANT_RULES);
  return scopeItems(items, userId)
    .map(({ userId: _userId, ...item }) => item)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveMerchantRule(
  input: Omit<MerchantRule, "id" | "createdAt" | "updatedAt">,
  userId: string
): Promise<MerchantRule> {
  const items = await readCollection<(MerchantRule & { userId?: string })>(Collections.MERCHANT_RULES);
  const now = new Date().toISOString();
  const nextRule: MerchantRule & { userId?: string } = {
    id: `merchant-rule-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    userId,
    ...input,
  };

  const otherUsers = items.filter((item) => item.userId && item.userId !== userId);
  const currentUsers = scopeItems(items, userId);
  await writeCollection(Collections.MERCHANT_RULES, [nextRule, ...currentUsers, ...otherUsers]);
  const { userId: _userId, ...rule } = nextRule;
  return rule;
}

export async function findMerchantRule(
  description: string,
  userId: string
): Promise<MerchantRule | null> {
  const normalized = description.toLowerCase();
  const rules = await getMerchantRules(userId);
  return (
    rules.find((rule) => normalized.includes(rule.matchText.trim().toLowerCase())) || null
  );
}
