import { Collections, readCollection, writeCollection } from "@/lib/storage";
import { Routine, RoutineCheckIn } from "@/types";

type StoredRoutine = Routine & { userId?: string };
type StoredRoutineCheckIn = RoutineCheckIn & { userId?: string };

function scopeItems<T extends { userId?: string }>(items: T[], userId: string): T[] {
  return items.filter((item) => !item.userId || item.userId === userId);
}

export async function getRoutines(userId: string): Promise<Routine[]> {
  const items = await readCollection<StoredRoutine>(Collections.ROUTINES);
  return scopeItems(items, userId)
    .map(({ userId: _userId, ...item }) => item)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function getRoutineCheckIns(userId: string): Promise<RoutineCheckIn[]> {
  const items = await readCollection<StoredRoutineCheckIn>(Collections.ROUTINE_CHECKINS);
  return scopeItems(items, userId)
    .map(({ userId: _userId, ...item }) => item)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

export async function createRoutine(
  input: Omit<Routine, "id" | "createdAt" | "updatedAt" | "streak" | "lastCompletedAt">,
  userId: string
): Promise<Routine> {
  const items = await readCollection<StoredRoutine>(Collections.ROUTINES);
  const now = new Date().toISOString();

  const routine: StoredRoutine = {
    ...input,
    id: `routine-${Date.now()}`,
    userId,
    streak: 0,
    lastCompletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const otherUsers = items.filter((item) => item.userId && item.userId !== userId);
  const currentUsers = scopeItems(items, userId);

  await writeCollection(Collections.ROUTINES, [...otherUsers, ...currentUsers, routine]);

  const { userId: _userId, ...result } = routine;
  return result;
}

export async function updateRoutine(
  id: string,
  updater: (routine: Routine) => Routine,
  userId: string
): Promise<Routine | null> {
  const items = await readCollection<StoredRoutine>(Collections.ROUTINES);
  let updatedRoutine: Routine | null = null;

  const nextItems = items.map((item) => {
    if ((item.userId || userId) !== userId || item.id !== id) {
      return item;
    }

    const { userId: _userId, ...routine } = item;
    updatedRoutine = updater(routine);
    return { ...updatedRoutine, userId };
  });

  if (!updatedRoutine) {
    return null;
  }

  await writeCollection(Collections.ROUTINES, nextItems);
  return updatedRoutine;
}

export async function saveRoutineCheckIn(
  input: Omit<RoutineCheckIn, "id" | "createdAt" | "updatedAt">,
  userId: string
): Promise<RoutineCheckIn> {
  const items = await readCollection<StoredRoutineCheckIn>(Collections.ROUTINE_CHECKINS);
  const now = new Date().toISOString();
  const nextCheckIn: StoredRoutineCheckIn = {
    ...input,
    id: `routine-checkin-${Date.now()}`,
    userId,
    createdAt: now,
    updatedAt: now,
  };

  const otherUsers = items.filter((item) => item.userId && item.userId !== userId);
  const currentUsers = scopeItems(items, userId).slice(0, 199);

  await writeCollection(Collections.ROUTINE_CHECKINS, [
    nextCheckIn,
    ...currentUsers,
    ...otherUsers,
  ]);

  const { userId: _userId, ...result } = nextCheckIn;
  return result;
}
