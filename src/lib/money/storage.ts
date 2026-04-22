import { readCollection, writeCollection, Collections } from "@/lib/storage";
import { Transaction } from "@/types";

type StoredTransaction = Transaction & { userId?: string };

function scopeItems<T extends { userId?: string }>(items: T[], userId: string): T[] {
  return items.filter((item) => !item.userId || item.userId === userId);
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
  const items = await readCollection<StoredTransaction>(Collections.TRANSACTIONS);
  return scopeItems(items, userId)
    .map(({ userId: _userId, ...item }) => item)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function saveTransactions(
  transactions: Transaction[],
  userId: string
): Promise<void> {
  const existing = await readCollection<StoredTransaction>(Collections.TRANSACTIONS);
  const otherUsers = existing.filter((item) => item.userId && item.userId !== userId);
  const currentUsers = scopeItems(existing, userId);
  const nextMap = new Map(currentUsers.map((item) => [item.id, item]));

  for (const transaction of transactions) {
    nextMap.set(transaction.id, { ...transaction, userId });
  }

  await writeCollection(Collections.TRANSACTIONS, [
    ...otherUsers,
    ...Array.from(nextMap.values()),
  ]);
}

export async function createTransaction(
  input: Omit<Transaction, "id" | "createdAt" | "updatedAt">,
  userId: string
): Promise<Transaction> {
  const now = new Date().toISOString();
  const transaction: Transaction = {
    id: `txn-${Date.now()}`,
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  await saveTransactions([transaction], userId);
  return transaction;
}

export async function updateTransaction(
  id: string,
  updater: (transaction: Transaction) => Transaction,
  userId: string
): Promise<Transaction | null> {
  const transactions = await getTransactions(userId);
  const current = transactions.find((transaction) => transaction.id === id);
  if (!current) {
    return null;
  }

  const updated = updater(current);
  await saveTransactions([updated], userId);
  return updated;
}
