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
        const data = await res.json();
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
      const data = await res.json();
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
        const data = await res.json();
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
