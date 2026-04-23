"use client";

import { useState, useCallback } from "react";
import { assertJsonOk } from "@/lib/api/safe-json";

type PipelineRunStatus = "running" | "completed" | "failed";

export interface PipelineApiResult {
  success?: boolean;
  runId?: string;
  status?: PipelineRunStatus;
  result?: PipelineApiResult;
  summary?: {
    fetched: number;
    dedupedNew: number;
    attemptedEnrichment: number;
    enriched: number;
    failed: number;
    skipped: number;
    deferred: number;
    ranked: number;
    attemptedContacts: number;
    attemptedOutreach: number;
    contactsGenerated: number;
    outreachGenerated: number;
  };
  enrichment?: {
    timeoutFailures?: number;
    noDescription?: number;
    fallbackCount?: number;
    parseFailures?: number;
    evaluationFailures?: number;
  };
  error?: string;
}

interface PipelineStatus {
  running: boolean;
  activeRunId: string | null;
  lastResult: PipelineApiResult | null;
  error: string | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePipelineResult(data: PipelineApiResult): PipelineApiResult {
  return data.result || data;
}

export function usePipeline() {
  const [status, setStatus] = useState<PipelineStatus>({
    running: false,
    activeRunId: null,
    lastResult: null,
    error: null,
  });

  const pollPipelineRun = useCallback(async (runId: string) => {
    for (;;) {
      await sleep(5000);
      const res = await fetch(`/api/jobs/pipeline/status?runId=${encodeURIComponent(runId)}`);
      const data = await assertJsonOk<PipelineApiResult>(res, "Pipeline status failed");

      if (data.status === "completed") {
        return normalizePipelineResult(data);
      }

      if (data.status === "failed") {
        throw new Error(data.error || "Pipeline failed");
      }
    }
  }, []);

  const runPipeline = useCallback(
    async (options?: {
      sources?: string[];
      maxEnrich?: number;
      skipEnrich?: boolean;
      skipRank?: boolean;
    }) => {
      setStatus({ running: true, activeRunId: null, lastResult: null, error: null });
      try {
        const res = await fetch("/api/jobs/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options || {}),
        });
        const data = await assertJsonOk<PipelineApiResult>(res, "Pipeline failed");

        if (data.status === "completed") {
          const result = normalizePipelineResult(data);
          setStatus({ running: false, activeRunId: null, lastResult: result, error: null });
          return result;
        }

        if (data.status === "failed") {
          throw new Error(data.error || "Pipeline failed");
        }

        if (!data.runId) {
          throw new Error("Pipeline did not return a run id");
        }

        setStatus((current) => ({
          ...current,
          activeRunId: data.runId || null,
        }));

        const result = await pollPipelineRun(data.runId);
        setStatus({ running: false, activeRunId: null, lastResult: result, error: null });
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Pipeline failed";
        setStatus({ running: false, activeRunId: null, lastResult: null, error: msg });
        return null;
      }
    },
    [pollPipelineRun]
  );

  const fetchSource = useCallback(async (source: string) => {
    setStatus({ running: true, activeRunId: null, lastResult: null, error: null });
    try {
      const res = await fetch("/api/jobs/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await assertJsonOk<PipelineApiResult>(res, "Fetch failed");
      setStatus({ running: false, activeRunId: null, lastResult: data, error: null });
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fetch failed";
      setStatus({ running: false, activeRunId: null, lastResult: null, error: msg });
      return null;
    }
  }, []);

  const runTask = useCallback(
    async (taskId: string, force: boolean = true) => {
      setStatus({ running: true, activeRunId: null, lastResult: null, error: null });
      try {
        const res = await fetch("/api/worker/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, force }),
        });
        const data = await assertJsonOk<PipelineApiResult>(res, "Task failed");
        setStatus({ running: false, activeRunId: null, lastResult: data, error: null });
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Task failed";
        setStatus({ running: false, activeRunId: null, lastResult: null, error: msg });
        return null;
      }
    },
    []
  );

  return { ...status, runPipeline, fetchSource, runTask };
}
