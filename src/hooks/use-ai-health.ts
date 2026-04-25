"use client";

import { useState, useEffect, useCallback } from "react";
import { AIConfig, AIHealthStatus } from "@/types";

interface AIHealthState {
  health: AIHealthStatus | null;
  diagnostics: {
    recentCalls: number;
    recentFailures: number;
    recentTimeouts: number;
    recentFallbacks: number;
    timeoutsByTaskType: Partial<Record<string, number>>;
  } | null;
  usage: {
    date: string;
    totalCalls: number;
    callsByTaskType: Record<string, number>;
    lastCallAt: string | null;
  } | null;
  config: Pick<
    AIConfig,
    | "provider"
    | "mode"
    | "enabled"
    | "baseUrl"
    | "compatibilityMode"
    | "model"
    | "fallbackModel"
    | "maxCallsPerDay"
    | "maxCallsPerTaskType"
    | "taskSettings"
  > | null;
  loading: boolean;
  error: string | null;
}

export function useAIHealth(autoRefreshMs: number = 30_000) {
  const [state, setState] = useState<AIHealthState>({
    health: null,
    diagnostics: null,
    usage: null,
    config: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const res = await fetch("/api/ai/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setState({
        health: data.health,
        diagnostics: data.diagnostics || null,
        usage: data.usage,
        config: data.config,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Health check failed",
      }));
    }
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      if (interval || autoRefreshMs <= 0) {
        return;
      }
      interval = setInterval(() => {
        if (document.visibilityState === "visible") {
          void refresh();
        }
      }, autoRefreshMs);
    }

    function stopPolling() {
      if (!interval) {
        return;
      }
      clearInterval(interval);
      interval = null;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refresh();
        startPolling();
      } else {
        stopPolling();
      }
    }

    void refresh();
    if (document.visibilityState === "visible") {
      startPolling();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopPolling();
    };
  }, [refresh, autoRefreshMs]);

  return { ...state, refresh };
}
