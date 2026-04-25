// ============================================================
// Worker task registry.
// Defines all available worker tasks, their policies,
// and the functions that execute them.
// ============================================================

import { WorkerTaskConfig } from "@/types";

/**
 * All registered worker tasks with their default policies.
 */
export const DEFAULT_TASK_CONFIGS: WorkerTaskConfig[] = [
  // --- Job fetching tasks ---
  {
    id: "fetch-remotive-jobs",
    name: "Fetch Remotive Jobs",
    enabled: false,
    minIntervalMs: 2 * 60 * 60 * 1000, // 2 hours
    dailyLimit: 6,
    burstWindowMs: 10 * 60 * 1000,
    burstLimit: 2,
    cooldownMs: 60 * 1000,
    maxConsecutiveFailures: 5,
  },
  {
    id: "fetch-himalayas-jobs",
    name: "Fetch Himalayas Jobs",
    enabled: false,
    minIntervalMs: 2 * 60 * 60 * 1000,
    dailyLimit: 6,
    burstWindowMs: 10 * 60 * 1000,
    burstLimit: 2,
    cooldownMs: 60 * 1000,
    maxConsecutiveFailures: 5,
  },
  {
    id: "fetch-adzuna-jobs",
    name: "Fetch Adzuna Jobs",
    enabled: true,
    minIntervalMs: 60 * 60 * 1000, // 1 hour
    dailyLimit: 8,
    burstWindowMs: 10 * 60 * 1000,
    burstLimit: 2,
    cooldownMs: 60 * 1000,
    maxConsecutiveFailures: 3,
  },
  {
    id: "fetch-reed-jobs",
    name: "Fetch Reed Jobs",
    enabled: true,
    minIntervalMs: 60 * 60 * 1000,
    dailyLimit: 8,
    burstWindowMs: 10 * 60 * 1000,
    burstLimit: 2,
    cooldownMs: 60 * 1000,
    maxConsecutiveFailures: 3,
  },
  {
    id: "fetch-serpapi-jobs",
    name: "Fetch SerpAPI Google Jobs",
    enabled: false,
    minIntervalMs: 2 * 60 * 60 * 1000,
    dailyLimit: 4,
    burstWindowMs: 20 * 60 * 1000,
    burstLimit: 1,
    cooldownMs: 2 * 60 * 1000,
    maxConsecutiveFailures: 3,
  },
  {
    id: "fetch-greenhouse-jobs",
    name: "Fetch Greenhouse Jobs",
    enabled: true,
    minIntervalMs: 3 * 60 * 60 * 1000, // 3 hours
    dailyLimit: 4,
    burstWindowMs: 10 * 60 * 1000,
    burstLimit: 1,
    cooldownMs: 120 * 1000,
    maxConsecutiveFailures: 3,
  },
  {
    id: "fetch-lever-jobs",
    name: "Fetch Lever Jobs",
    enabled: true,
    minIntervalMs: 3 * 60 * 60 * 1000,
    dailyLimit: 4,
    burstWindowMs: 10 * 60 * 1000,
    burstLimit: 1,
    cooldownMs: 120 * 1000,
    maxConsecutiveFailures: 3,
  },
  {
    id: "fetch-jooble-jobs",
    name: "Fetch Jooble Jobs",
    enabled: false,
    minIntervalMs: 2 * 60 * 60 * 1000,
    dailyLimit: 4,
    burstWindowMs: 10 * 60 * 1000,
    burstLimit: 1,
    cooldownMs: 60 * 1000,
    maxConsecutiveFailures: 3,
  },
  {
    id: "fetch-arbeitnow-jobs",
    name: "Fetch Arbeitnow Jobs",
    enabled: false,
    minIntervalMs: 2 * 60 * 60 * 1000,
    dailyLimit: 6,
    burstWindowMs: 10 * 60 * 1000,
    burstLimit: 2,
    cooldownMs: 60 * 1000,
    maxConsecutiveFailures: 4,
  },
  {
    id: "fetch-themuse-jobs",
    name: "Fetch The Muse Jobs",
    enabled: false,
    minIntervalMs: 3 * 60 * 60 * 1000,
    dailyLimit: 4,
    burstWindowMs: 10 * 60 * 1000,
    burstLimit: 1,
    cooldownMs: 90 * 1000,
    maxConsecutiveFailures: 3,
  },
  {
    id: "fetch-careerjet-jobs",
    name: "Fetch CareerJet Jobs",
    enabled: false,
    minIntervalMs: 3 * 60 * 60 * 1000,
    dailyLimit: 4,
    burstWindowMs: 10 * 60 * 1000,
    burstLimit: 1,
    cooldownMs: 90 * 1000,
    maxConsecutiveFailures: 3,
  },
  {
    id: "fetch-findwork-jobs",
    name: "Fetch FindWork Jobs",
    enabled: false,
    minIntervalMs: 2 * 60 * 60 * 1000,
    dailyLimit: 4,
    burstWindowMs: 10 * 60 * 1000,
    burstLimit: 1,
    cooldownMs: 60 * 1000,
    maxConsecutiveFailures: 3,
  },
  {
    id: "fetch-linkedin-jobs",
    name: "Fetch LinkedIn Public Jobs",
    enabled: false,
    minIntervalMs: 4 * 60 * 60 * 1000,
    dailyLimit: 3,
    burstWindowMs: 15 * 60 * 1000,
    burstLimit: 1,
    cooldownMs: 180 * 1000,
    maxConsecutiveFailures: 2,
  },
  {
    id: "fetch-rapidapi-linkedin-jobs",
    name: "Fetch LinkedIn RapidAPI Jobs",
    enabled: false,
    minIntervalMs: 12 * 60 * 60 * 1000,
    dailyLimit: 1,
    burstWindowMs: 60 * 60 * 1000,
    burstLimit: 1,
    cooldownMs: 10 * 60 * 1000,
    maxConsecutiveFailures: 2,
  },
  {
    id: "fetch-indeed-jobs",
    name: "Fetch Indeed Jobs",
    enabled: false,
    minIntervalMs: 6 * 60 * 60 * 1000,
    dailyLimit: 2,
    burstWindowMs: 60 * 60 * 1000,
    burstLimit: 1,
    cooldownMs: 10 * 60 * 1000,
    maxConsecutiveFailures: 2,
  },
  // --- AI enrichment tasks ---
  {
    id: "ai-enrich-new-jobs",
    name: "AI Enrich New Jobs",
    enabled: true,
    minIntervalMs: 15 * 60 * 1000, // 15 min
    dailyLimit: 20,
    burstWindowMs: 5 * 60 * 1000,
    burstLimit: 3,
    cooldownMs: 30 * 1000,
    maxConsecutiveFailures: 3,
  },
  {
    id: "ai-rank-jobs",
    name: "AI Rank Jobs",
    enabled: true,
    minIntervalMs: 30 * 60 * 1000,
    dailyLimit: 20,
    burstWindowMs: 5 * 60 * 1000,
    burstLimit: 3,
    cooldownMs: 15 * 1000,
    maxConsecutiveFailures: 5,
  },
  {
    id: "ai-categorize-ledger",
    name: "AI Categorize Transactions",
    enabled: false,
    minIntervalMs: 60 * 60 * 1000,
    dailyLimit: 5,
    burstWindowMs: 10 * 60 * 1000,
    burstLimit: 1,
    cooldownMs: 60 * 1000,
    maxConsecutiveFailures: 3,
  },
  {
    id: "ai-weekly-review",
    name: "AI Weekly Review",
    enabled: false,
    minIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
    dailyLimit: 1,
    burstWindowMs: 60 * 60 * 1000,
    burstLimit: 1,
    cooldownMs: 60 * 1000,
    maxConsecutiveFailures: 2,
  },

  // --- Full pipeline ---
  {
    id: "full-pipeline",
    name: "Full Job Pipeline",
    enabled: true,
    minIntervalMs: 2 * 60 * 60 * 1000,
    dailyLimit: 4,
    burstWindowMs: 30 * 60 * 1000,
    burstLimit: 1,
    cooldownMs: 300 * 1000,
    maxConsecutiveFailures: 2,
    adminOnly: true,
  },
  {
    id: "auto-apply-pipeline",
    name: "Job Discovery Pipeline",
    enabled: true,
    minIntervalMs: 5 * 60 * 60 * 1000,
    dailyLimit: 5,
    burstWindowMs: 60 * 60 * 1000,
    burstLimit: 1,
    cooldownMs: 10 * 60 * 1000,
    maxConsecutiveFailures: 2,
    adminOnly: true,
  },
];

/**
 * Map task IDs to the source adapter IDs they fetch from.
 */
export const FETCH_TASK_SOURCE_MAP: Record<string, string> = {
  "fetch-remotive-jobs": "remotive",
  "fetch-himalayas-jobs": "himalayas",
  "fetch-adzuna-jobs": "adzuna",
  "fetch-reed-jobs": "reed",
  "fetch-serpapi-jobs": "serpapi",
  "fetch-greenhouse-jobs": "greenhouse",
  "fetch-lever-jobs": "lever",
  "fetch-jooble-jobs": "jooble",
  "fetch-arbeitnow-jobs": "arbeitnow",
  "fetch-themuse-jobs": "themuse",
  "fetch-careerjet-jobs": "careerjet",
  "fetch-findwork-jobs": "findwork",
  "fetch-linkedin-jobs": "linkedin",
  "fetch-rapidapi-linkedin-jobs": "rapidapi-linkedin",
  "fetch-indeed-jobs": "indeed",
};

export function getFetchTaskIdForSource(sourceId: string): string | null {
  return (
    Object.entries(FETCH_TASK_SOURCE_MAP).find(
      ([, mappedSourceId]) => mappedSourceId === sourceId
    )?.[0] || null
  );
}
