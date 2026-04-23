"use client";

import { useState, useEffect, useCallback } from "react";
import { EnrichedJob } from "@/types";
import { assertJsonOk, readJsonResponse } from "@/lib/api/safe-json";

interface JobStats {
  raw: number;
  enriched: number;
  inbox: number;
  ranked: number;
  rejected: number;
  tracked: number;
  applied: number;
}

interface SourceInfo {
  id: string;
  name: string;
  active: boolean;
}

interface UseJobsState {
  inbox: EnrichedJob[];
  ranked: EnrichedJob[];
  rejected: EnrichedJob[];
  tracked: EnrichedJob[];
  stats: JobStats | null;
  sources: SourceInfo[];
  loading: boolean;
  error: string | null;
}

interface DashboardResponse {
  inbox?: EnrichedJob[];
  ranked?: EnrichedJob[];
  rejected?: EnrichedJob[];
  tracked?: EnrichedJob[];
  stats?: JobStats;
  sources?: SourceInfo[];
  error?: string;
}

export function useJobs() {
  const [state, setState] = useState<UseJobsState>({
    inbox: [],
    ranked: [],
    rejected: [],
    tracked: [],
    stats: null,
    sources: [],
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const dashboard = await fetch("/api/jobs/dashboard").then((response) =>
        assertJsonOk<DashboardResponse>(response, "Failed to load jobs")
      );

      setState({
        inbox: dashboard?.inbox || [],
        ranked: dashboard?.ranked || [],
        rejected: dashboard?.rejected || [],
        tracked: dashboard?.tracked || [],
        stats: dashboard?.stats || null,
        sources: dashboard?.sources || [],
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load jobs",
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const performAction = useCallback(
    async (action: string, id: string) => {
      const response = await fetch("/api/jobs/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });

      if (!response.ok) {
        const payload = await readJsonResponse<{ error?: string }>(response).catch(() => null);
        throw new Error(payload?.error || `Job action failed: ${action}`);
      }

      await refresh();
    },
    [refresh]
  );

  const performActionWithPayload = useCallback(
    async (action: string, id: string, extra?: Record<string, unknown>) => {
      const response = await fetch("/api/jobs/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, ...extra }),
      });

      if (!response.ok) {
        const payload = await readJsonResponse<{ error?: string }>(response).catch(() => null);
        throw new Error(payload?.error || `Job action failed: ${action}`);
      }

      await refresh();
    },
    [refresh]
  );

  return {
    ...state,
    refresh,
    trackJob: (id: string) => performAction("track", id),
    rejectJob: (id: string) => performAction("reject", id),
    unrejectJob: (id: string) => performAction("unreject", id),
    markApplied: (id: string) => performAction("apply", id),
    changeStage: (id: string, status: string) =>
      performActionWithPayload("change-stage", id, { status }),
    setFollowUp: (id: string, followUpDate: string | null, followUpNote: string | null) =>
      performActionWithPayload("set-followup", id, { followUpDate, followUpNote }),
    updateNotes: (id: string, notes: string) =>
      performActionWithPayload("update-notes", id, { notes }),
    refreshJobIntel: (id: string) => performAction("refresh-intel", id),
    refreshJobContacts: (id: string) => performAction("refresh-contacts", id),
    refreshJobOutreach: (id: string) => performAction("refresh-outreach", id),
    rerunJobParse: (id: string) => performAction("rerun-parse", id),
    rerunJobFit: (id: string) => performAction("rerun-fit", id),
  };
}
