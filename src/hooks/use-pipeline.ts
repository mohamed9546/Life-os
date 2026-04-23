"use client";

import { useState, useCallback } from "react";

export interface PipelineApiResult {
  success?: boolean;
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
  lastResult: PipelineApiResult | null;
  error: string | null;
}

interface ApiErrorPayload {
  error?: string;
  success?: boolean;
}

function summarizeErrorBody(status: number, text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ");

  if (/upstream|timeout|gateway/i.test(normalized)) {
    return "Pipeline timed out - the run is taking too long. Try 'Fetch Only' for a quicker pass.";
  }

  if (!normalized) {
    return `Server error (${status})`;
  }

  return `Server error (${status}): ${normalized.slice(0, 140)}`;
}

async function readJsonResponse<T extends ApiErrorPayload>(
  response: Response
): Promise<T> {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(summarizeErrorBody(response.status, text));
  }

  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new Error(summarizeErrorBody(response.status, text));
  }
}

export function usePipeline() {
  const [status, setStatus] = useState<PipelineStatus>({
    running: false,
    lastResult: null,
    error: null,
  });

  const runPipeline = useCallback(
    async (options?: {
      sources?: string[];
      maxEnrich?: number;
      skipEnrich?: boolean;
      skipRank?: boolean;
    }) => {
      setStatus({ running: true, lastResult: null, error: null });
      try {
        const res = await fetch("/api/jobs/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options || {}),
        });
        const data = await readJsonResponse<PipelineApiResult>(res);
        if (!res.ok || data.success === false) {
          throw new Error(data.error || `Pipeline failed (${res.status})`);
        }
        setStatus({ running: false, lastResult: data, error: null });
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Pipeline failed";
        setStatus({ running: false, lastResult: null, error: msg });
        return null;
      }
    },
    []
  );

  const fetchSource = useCallback(async (source: string) => {
    setStatus({ running: true, lastResult: null, error: null });
    try {
      const res = await fetch("/api/jobs/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await readJsonResponse<PipelineApiResult>(res);
      if (!res.ok || data.success === false) {
        throw new Error(data.error || `Fetch failed (${res.status})`);
      }
      setStatus({ running: false, lastResult: data, error: null });
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fetch failed";
      setStatus({ running: false, lastResult: null, error: msg });
      return null;
    }
  }, []);

  const runTask = useCallback(
    async (taskId: string, force: boolean = true) => {
      setStatus({ running: true, lastResult: null, error: null });
      try {
        const res = await fetch("/api/worker/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, force }),
        });
        const data = await readJsonResponse<PipelineApiResult>(res);
        if (!res.ok || data.success === false) {
          throw new Error(data.error || `Task failed (${res.status})`);
        }
        setStatus({ running: false, lastResult: data, error: null });
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Task failed";
        setStatus({ running: false, lastResult: null, error: msg });
        return null;
      }
    },
    []
  );

  return { ...status, runPipeline, fetchSource, runTask };
}
