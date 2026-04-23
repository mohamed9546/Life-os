// ============================================================
// Job ranking engine.
// Takes enriched jobs and produces a sorted, bucketed list.
// Ranking is deterministic — based on AI scores + rules.
// ============================================================

import { EnrichedJob, PriorityBand } from "@/types";
import {
  getBestContact,
  getContactFreshness,
  getJobRankingState,
  hasOutreachDraft,
} from "@/lib/jobs/selectors";

export interface RankingResult {
  ranked: EnrichedJob[];
  buckets: {
    high: EnrichedJob[];
    medium: EnrichedJob[];
    low: EnrichedJob[];
    reject: EnrichedJob[];
    unscored: EnrichedJob[];
  };
  stats: {
    total: number;
    scored: number;
    unscored: number;
    avgFitScore: number;
    avgRedFlagScore: number;
  };
}

/**
 * Rank and bucket enriched jobs by fit score and priority band.
 */
export function rankJobs(jobs: EnrichedJob[]): RankingResult {
  const scored: Array<EnrichedJob & { _sortScore: number }> = [];
  const unscored: EnrichedJob[] = [];

  for (const job of jobs) {
    if (job.fit?.data) {
      const sortScore = computeSortScore(job);
      scored.push({ ...job, _sortScore: sortScore });
    } else {
      unscored.push(job);
    }
  }

  // Sort by composite score descending
  scored.sort((a, b) => b._sortScore - a._sortScore);

  // Strip internal sort score
  const ranked: EnrichedJob[] = scored.map(({ _sortScore, ...job }) => job);

  // Bucket by priority band
  const buckets: RankingResult["buckets"] = {
    high: [],
    medium: [],
    low: [],
    reject: [],
    unscored,
  };

  for (const job of ranked) {
    const band = job.fit?.data?.priorityBand || "unscored";
    if (band in buckets) {
      buckets[band as PriorityBand].push(job);
    }
  }

  // Stats
  const fitScores = scored.map((j) => j.fit?.data?.fitScore || 0);
  const redFlagScores = scored.map((j) => j.fit?.data?.redFlagScore || 0);

  const stats = {
    total: jobs.length,
    scored: scored.length,
    unscored: unscored.length,
    avgFitScore:
      fitScores.length > 0
        ? Math.round(fitScores.reduce((a, b) => a + b, 0) / fitScores.length)
        : 0,
    avgRedFlagScore:
      redFlagScores.length > 0
        ? Math.round(
            redFlagScores.reduce((a, b) => a + b, 0) / redFlagScores.length
          )
        : 0,
  };

  console.log(
    `[rank] ${stats.total} jobs ranked: ` +
    `${buckets.high.length} high, ${buckets.medium.length} medium, ` +
    `${buckets.low.length} low, ${buckets.reject.length} reject, ` +
    `${buckets.unscored.length} unscored`
  );

  return { ranked, buckets, stats };
}

/**
 * Compute a composite sort score for a job.
 * Higher is better. Combines fit score, red flag penalty,
 * priority band bonus, and recency.
 */
function computeSortScore(job: EnrichedJob): number {
  const fit = job.fit?.data;
  if (!fit) return 0;

  let score = 0;

  // Base: fit score (0-100) — main driver
  score += fit.fitScore * 2;

  // Red flag penalty (0-100 → -0 to -80)
  score -= fit.redFlagScore * 0.8;

  // Priority band bonus
  const bandBonus: Record<string, number> = {
    high: 50,
    medium: 20,
    low: 0,
    reject: -100,
  };
  score += bandBonus[fit.priorityBand] || 0;

  // Confidence bonus (0-1 → 0-15)
  score += fit.confidence * 15;

  // Recency bonus — newer jobs score slightly higher
  const postedAt = job.raw.postedAt;
  if (postedAt) {
    const daysSincePosted = Math.max(
      0,
      (Date.now() - new Date(postedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    // Up to 20 bonus points for jobs posted today, decaying over 14 days
    score += Math.max(0, 20 - daysSincePosted * (20 / 14));
  }

  // Source reliability bonus
  const sourceBonus: Record<string, number> = {
    greenhouse: 10,
    lever: 10,
    adzuna: 8,
    reed: 8,
    serpapi: 4,
    remotive: 3,
    himalayas: 3,
    themuse: 2,
    findwork: 2,
    jooble: 1,
    brightnetwork: 1,
    arbeitnow: 1,
    careerjet: 1,
    indeed: 0,
    linkedin: -2,
    "rapidapi-linkedin": -6,
    scraper: 1,
  };
  score += sourceBonus[job.raw.source] || 0;

  const bestContact = getBestContact(job);
  if (bestContact) {
    score += bestContact.email ? 8 : 4;
  }

  if (hasOutreachDraft(job)) {
    score += 6;
  }

  if (job.companyIntel) {
    score += 4;
  }

  if (getContactFreshness(job).isStale) {
    score -= 3;
  }

  if (getJobRankingState(job) === "Ranking degraded") {
    score -= 10;
  }

  // Location weighting based on prompt Section 6
  const location = (job.parsed?.data?.location || job.raw.location || "").toLowerCase();
  const remoteType = (job.parsed?.data?.remoteType || job.raw.remoteType || "unknown").toLowerCase();
  
  if (location.includes("glasgow") || location.includes("scotland")) {
    score += 25; // Priority 1
  } else if (remoteType === "remote" || remoteType === "hybrid") {
    score += 15; // Priority 2
  } else if (location.includes("london") && remoteType === "hybrid") {
    score += 10; // Priority 3
  } else if (location.length > 0 && remoteType === "onsite") {
    score -= 20; // Penalize onsite distant roles
  }

  // Visa Risk weighting based on prompt Section 7
  const visaRisk = fit.visaRisk;
  if (visaRisk === "amber") {
    score -= 30; // Deprioritize
  } else if (visaRisk === "red") {
    score -= 80; // Heavily deprioritize / almost reject
  }

  return Math.round(score * 100) / 100;
}

/**
 * Re-rank existing jobs (call after manual status changes).
 */
export function reRankJobs(jobs: EnrichedJob[]): EnrichedJob[] {
  const { ranked } = rankJobs(
    jobs.filter((j) => j.status !== "rejected" && j.status !== "archived")
  );
  return ranked;
}
