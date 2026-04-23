import { Collections, readCollection, writeCollection } from "@/lib/storage";
import type { PipelineOptions, PipelineResult } from "./index";

export type PipelineRunStatus = "running" | "completed" | "failed";

export interface PipelineRunRecord {
  id: string;
  userId: string;
  status: PipelineRunStatus;
  options: PipelineOptions;
  result?: PipelineResult;
  error?: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

type StoredPipelineRunRecord = PipelineRunRecord & { userId: string };

function scopeRuns(runs: StoredPipelineRunRecord[], userId: string) {
  return runs.filter((run) => run.userId === userId);
}

export async function getPipelineRun(
  userId: string,
  runId: string
): Promise<PipelineRunRecord | null> {
  const runs = await readCollection<StoredPipelineRunRecord>(Collections.PIPELINE_RUNS);
  return scopeRuns(runs, userId).find((run) => run.id === runId) || null;
}

export async function getLatestPipelineRun(
  userId: string
): Promise<PipelineRunRecord | null> {
  const runs = await readCollection<StoredPipelineRunRecord>(Collections.PIPELINE_RUNS);
  return (
    scopeRuns(runs, userId).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ||
    null
  );
}

export async function getActivePipelineRun(
  userId: string
): Promise<PipelineRunRecord | null> {
  const runs = await readCollection<StoredPipelineRunRecord>(Collections.PIPELINE_RUNS);
  return (
    scopeRuns(runs, userId)
      .filter((run) => run.status === "running")
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] || null
  );
}

export async function createPipelineRun(
  userId: string,
  options: PipelineOptions
): Promise<PipelineRunRecord> {
  const runs = await readCollection<StoredPipelineRunRecord>(Collections.PIPELINE_RUNS);
  const now = new Date().toISOString();
  const run: StoredPipelineRunRecord = {
    id: `pipeline-${Date.now()}`,
    userId,
    status: "running",
    options,
    startedAt: now,
    updatedAt: now,
  };

  await writeCollection(Collections.PIPELINE_RUNS, [run, ...runs].slice(0, 50));
  return run;
}

export async function updatePipelineRun(
  userId: string,
  runId: string,
  patch: Partial<Pick<PipelineRunRecord, "status" | "result" | "error" | "completedAt">>
): Promise<PipelineRunRecord | null> {
  const runs = await readCollection<StoredPipelineRunRecord>(Collections.PIPELINE_RUNS);
  const now = new Date().toISOString();
  let updated: StoredPipelineRunRecord | null = null;

  const next = runs.map((run) => {
    if (run.userId !== userId || run.id !== runId) {
      return run;
    }
    updated = {
      ...run,
      ...patch,
      updatedAt: now,
    };
    return updated;
  });

  if (!updated) {
    return null;
  }

  await writeCollection(Collections.PIPELINE_RUNS, next);
  return updated;
}
