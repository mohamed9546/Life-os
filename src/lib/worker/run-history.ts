import { readCollection, writeCollection, Collections } from "@/lib/storage";
import { WorkerRunRecord, TaskStatus } from "@/types";

export async function recordWorkerRun(input: {
  taskId: string;
  status: TaskStatus;
  actorId: string;
  details?: Record<string, unknown>;
  error?: string;
}) {
  const existing = await readCollection<WorkerRunRecord>(Collections.WORKER_RUNS);
  const now = new Date().toISOString();
  const record: WorkerRunRecord = {
    id: `${input.taskId}-${Date.now()}`,
    taskId: input.taskId,
    status: input.status,
    actorId: input.actorId,
    details: input.details,
    error: input.error,
    createdAt: now,
    updatedAt: now,
  };

  const next = [record, ...existing].slice(0, 200);
  await writeCollection(Collections.WORKER_RUNS, next);
  return record;
}

export async function listWorkerRuns(limit: number = 20): Promise<WorkerRunRecord[]> {
  const existing = await readCollection<WorkerRunRecord>(Collections.WORKER_RUNS);
  return existing
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function getLatestRunForTask(taskId: string): Promise<WorkerRunRecord | null> {
  const runs = await listWorkerRuns(200);
  return runs.find((run) => run.taskId === taskId) || null;
}
