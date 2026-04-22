import { readCollection, writeCollection, Collections } from "@/lib/storage";
import { Decision } from "@/types";

type StoredDecision = Decision & { userId?: string };

function scopeItems<T extends { userId?: string }>(items: T[], userId: string): T[] {
  return items.filter((item) => !item.userId || item.userId === userId);
}

export async function getDecisions(userId: string): Promise<Decision[]> {
  const items = await readCollection<StoredDecision>(Collections.DECISIONS);
  return scopeItems(items, userId)
    .map(({ userId: _userId, ...item }) => item)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveDecisions(decisions: Decision[], userId: string): Promise<void> {
  const existing = await readCollection<StoredDecision>(Collections.DECISIONS);
  const otherUsers = existing.filter((item) => item.userId && item.userId !== userId);
  const currentUsers = scopeItems(existing, userId);
  const nextMap = new Map(currentUsers.map((item) => [item.id, item]));

  for (const decision of decisions) {
    nextMap.set(decision.id, { ...decision, userId });
  }

  await writeCollection(Collections.DECISIONS, [
    ...otherUsers,
    ...Array.from(nextMap.values()),
  ]);
}

export async function createDecision(
  input: Omit<Decision, "id" | "createdAt" | "updatedAt">,
  userId: string
): Promise<Decision> {
  const now = new Date().toISOString();
  const decision: Decision = {
    id: `decision-${Date.now()}`,
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  await saveDecisions([decision], userId);
  return decision;
}

export async function updateDecision(
  id: string,
  updater: (decision: Decision) => Decision,
  userId: string
): Promise<Decision | null> {
  const decisions = await getDecisions(userId);
  const current = decisions.find((decision) => decision.id === id);
  if (!current) {
    return null;
  }

  const updated = updater(current);
  await saveDecisions([updated], userId);
  return updated;
}
