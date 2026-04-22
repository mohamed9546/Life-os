import { Collections, readCollection, writeCollection } from "@/lib/storage";
import { ImportRecord } from "@/types";

type StoredImportRecord = ImportRecord & { userId?: string };

function scopeItems<T extends { userId?: string }>(items: T[], userId: string): T[] {
  return items.filter((item) => !item.userId || item.userId === userId);
}

export async function getImportRecords(userId: string): Promise<ImportRecord[]> {
  const items = await readCollection<StoredImportRecord>(Collections.IMPORT_RECORDS);
  return scopeItems(items, userId)
    .map(({ userId: _userId, ...item }) => item)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveImportRecord(
  record: Omit<ImportRecord, "id" | "createdAt" | "updatedAt">,
  userId: string
): Promise<ImportRecord> {
  const items = await readCollection<StoredImportRecord>(Collections.IMPORT_RECORDS);
  const now = new Date().toISOString();

  const nextRecord: StoredImportRecord = {
    ...record,
    id: `import-${Date.now()}`,
    userId,
    createdAt: now,
    updatedAt: now,
  };

  const otherUsers = items.filter((item) => item.userId && item.userId !== userId);
  const currentUsers = scopeItems(items, userId).slice(0, 49);

  await writeCollection(Collections.IMPORT_RECORDS, [
    nextRecord,
    ...currentUsers,
    ...otherUsers,
  ]);

  const { userId: _userId, ...result } = nextRecord;
  return result;
}
