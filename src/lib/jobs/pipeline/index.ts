// ============================================================
// Full job pipeline orchestrator.
// Coordinates: fetch -> dedupe -> enrich -> rank -> store
// ============================================================

import { AutoApplyPipelineResult, EnrichedJob, RawJobItem } from "@/types";
import {
  DEFAULT_SEARCH_QUERIES,
  getActiveAdapters,
  getAdapter,
  JobSearchQuery,
  JobSourceResult,
} from "@/lib/jobs/sources";
import { deduplicateJobs, DedupeResult } from "./dedupe";
import { EnrichmentResult, enrichJobs } from "./enrich";
import { rankJobs, RankingResult } from "./rank";
import {
  getEnrichedJobs,
  getInboxJobs,
  getRawJobs,
  getRejectedJobs,
  overwriteRankedJobs,
  saveRawJobs,
  saveToInbox,
  saveToRejected,
} from "@/lib/jobs/storage";
import { dedupeJobsById } from "@/lib/jobs/selectors";
import { generateDedupeKey } from "@/lib/jobs/sources/normalize";
import {
  type PipelineBudgetProfile,
  resolvePipelineEnrichmentBudget,
} from "./config";

export interface FetchResult {
  source: string;
  jobsFetched: number;
  error?: string;
}

export interface PipelineResult {
  fetchResults: FetchResult[];
  dedupe: DedupeResult["stats"];
  enrichment: EnrichmentResult["stats"];
  ranking: RankingResult["stats"];
  summary: {
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
  timing: {
    fetchMs: number;
    dedupeMs: number;
    enrichMs: number;
    rankMs: number;
    totalMs: number;
  };
  recommendationPipeline?: AutoApplyPipelineResult;
}

export interface PipelineOptions {
  sources?: string[];
  queries?: JobSearchQuery[];
  userId?: string;
  maxEnrich?: number;
  skipEnrich?: boolean;
  skipRank?: boolean;
  budgetProfile?: PipelineBudgetProfile;
}

const EXCLUDED_TITLE_PATTERN = /\b(manager|lead|director)\b/i;

export async function runFullPipeline(
  options?: PipelineOptions
): Promise<PipelineResult> {
  const totalStart = Date.now();
  const opts = options || {};
  const budgetProfile = opts.budgetProfile || "manual";

  console.log("\n========================================");
  console.log("[pipeline] Starting full job pipeline");
  console.log("========================================\n");

  const fetchStart = Date.now();
  const { allJobs, fetchResults } = await fetchFromSources(opts);
  const fetchMs = Date.now() - fetchStart;

  if (allJobs.length === 0) {
    console.log("[pipeline] No jobs fetched - stopping pipeline");
    return emptyResult(fetchResults, fetchMs);
  }

  const dedupeStart = Date.now();
  const dedupeResult = await deduplicateJobs(allJobs);
  const dedupeMs = Date.now() - dedupeStart;

  await saveRawJobs(dedupeResult.newJobs, opts.userId);

  let enrichResult: EnrichmentResult = {
    enriched: [],
    failed: [],
    skipped: [],
    stats: emptyEnrichmentStats(),
  };
  let enrichMs = 0;

  if (!opts.skipEnrich) {
    const enrichBudget = resolvePipelineEnrichmentBudget(
      budgetProfile,
      opts.maxEnrich
    );

    // Union (this-run new jobs) ∪ (previously-fetched raw jobs that never
    // made it through enrichment). Without this, once dedupe drops a raw
    // job in a later fetch the original stays stranded in raw_jobs forever
    // and the user never sees it in the UI.
    const backlog = await getUnenrichedRawJobs(opts.userId);
    const pool = mergeByDedupeKey([...dedupeResult.newJobs, ...backlog]);

    if (pool.length > 0) {
      const enrichStart = Date.now();
      enrichResult = await enrichJobs(pool, { maxBatchSize: enrichBudget });
      enrichMs = Date.now() - enrichStart;

      const inboxJobs = enrichResult.enriched.filter(
        (job) => job.status === "inbox"
      );
      const rejectedJobs = enrichResult.enriched.filter(
        (job) => job.status === "rejected"
      );

      if (inboxJobs.length > 0) {
        await saveToInbox(inboxJobs, opts.userId);
      }
      if (rejectedJobs.length > 0) {
        await saveToRejected(rejectedJobs, opts.userId);
      }
    }
  } else if (opts.skipEnrich && dedupeResult.newJobs.length > 0) {
    enrichResult = {
      enriched: [],
      failed: [],
      skipped: dedupeResult.newJobs.map((raw) => ({
        raw,
        reason: "Enrichment skipped",
      })),
      stats: {
        ...emptyEnrichmentStats(),
        total: dedupeResult.newJobs.length,
        skipped: dedupeResult.newJobs.length,
      },
    };
  }

  let rankResult: RankingResult = {
    ranked: [],
    buckets: { high: [], medium: [], low: [], reject: [], unscored: [] },
    stats: emptyRankingStats(),
  };
  let rankMs = 0;

  if (!opts.skipRank) {
    const rankStart = Date.now();
    const existingInbox = await getInboxJobs(opts.userId);
    const existingEnriched = await getEnrichedJobs(opts.userId);
    const allToRank = dedupeJobsById([
      ...existingInbox,
      ...existingEnriched.filter((job) =>
        ["tracked", "applied", "inbox"].includes(job.status)
      ),
      ...enrichResult.enriched.filter((job) => job.status !== "rejected"),
    ]).filter((job) => job.status !== "rejected" && job.status !== "archived");

    if (allToRank.length > 0) {
      rankResult = rankJobs(allToRank);
      await overwriteRankedJobs(rankResult.ranked, opts.userId);
    }

    rankMs = Date.now() - rankStart;
  }

  const totalMs = Date.now() - totalStart;
  const summary: PipelineResult["summary"] = {
    fetched: fetchResults.reduce((sum, result) => sum + result.jobsFetched, 0),
    dedupedNew: dedupeResult.stats.newCount,
    attemptedEnrichment: enrichResult.stats.attempted,
    enriched: enrichResult.stats.enriched,
    failed: enrichResult.stats.failed,
    skipped: enrichResult.stats.skipped,
    deferred: enrichResult.stats.deferred,
    ranked: rankResult.stats.total,
    attemptedContacts: enrichResult.stats.attemptedContacts,
    attemptedOutreach: enrichResult.stats.attemptedOutreach,
    contactsGenerated: enrichResult.stats.contactsGenerated,
    outreachGenerated: enrichResult.stats.outreachGenerated,
  };

  console.log("\n========================================");
  console.log(
    `[pipeline] Complete in ${(totalMs / 1000).toFixed(1)}s: ` +
      `${summary.fetched} fetched -> ${summary.dedupedNew} new -> ` +
      `${summary.enriched} enriched -> ${summary.ranked} ranked`
  );
  console.log("========================================\n");

  return {
    fetchResults,
    dedupe: dedupeResult.stats,
    enrichment: enrichResult.stats,
    ranking: rankResult.stats,
    summary,
    timing: { fetchMs, dedupeMs, enrichMs, rankMs, totalMs },
  };
}

async function fetchFromSources(
  opts: PipelineOptions
): Promise<{ allJobs: RawJobItem[]; fetchResults: FetchResult[] }> {
  let adapters = await getActiveAdapters();

  console.log(`[pipeline] Found ${adapters.length} active adapters globally.`);

  if (opts.sources && opts.sources.length > 0) {
    adapters = adapters.filter((adapter) => opts.sources!.includes(adapter.sourceId));
  }

  if (adapters.length === 0) {
    console.log("[pipeline] No active adapters found after filtering");
    return { allJobs: [], fetchResults: [] };
  }

  console.log(
    `[pipeline] Proceeding with adapters:`,
    adapters.map((adapter) => adapter.sourceId).join(", ")
  );

  const queries =
    opts.queries && opts.queries.length > 0 ? opts.queries : DEFAULT_SEARCH_QUERIES;

  // Run adapters in parallel — each hits a different API/domain so there's no shared
  // rate limit. Queries stay sequential within each adapter to respect per-domain limits.
  const adapterResults = await Promise.all(
    adapters.map(async (adapter) => {
      let adapterJobCount = 0;
      let adapterError: string | undefined;
      const adapterJobs: RawJobItem[] = [];

      for (const query of queries) {
        try {
          const result: JobSourceResult = await adapter.fetchJobs(query);

          if (result.error) {
            adapterError = result.error;
            console.error(
              `[pipeline] Error from ${adapter.sourceId} for query "${query.keywords.join(", ")}":`,
              result.error
            );
          }

          if (result.jobs.length > 0) {
            const filteredJobs = filterFetchedJobs(result.jobs);
            adapterJobs.push(...filteredJobs);
            adapterJobCount += filteredJobs.length;
          }

          await new Promise((resolve) => setTimeout(resolve, 250));
        } catch (err) {
          adapterError = err instanceof Error ? err.message : "Unknown fetch error";
          console.error(`[pipeline] Exception from ${adapter.sourceId}:`, adapterError);
        }
      }

      return {
        jobs: adapterJobs,
        fetchResult: { source: adapter.sourceId, jobsFetched: adapterJobCount, error: adapterError } as FetchResult,
      };
    })
  );

  const allJobs = adapterResults.flatMap((r) => r.jobs);
  const fetchResults = adapterResults.map((r) => r.fetchResult);

  return { allJobs, fetchResults };
}

export async function fetchFromSource(
  sourceId: string,
  queries?: JobSearchQuery[]
): Promise<{ jobs: RawJobItem[]; result: FetchResult }> {
  const adapter = getAdapter(sourceId);
  if (!adapter) {
    return {
      jobs: [],
      result: {
        source: sourceId,
        jobsFetched: 0,
        error: `Adapter "${sourceId}" not found`,
      },
    };
  }

  const isConfigured = await adapter.isConfigured();
  if (!isConfigured) {
    return {
      jobs: [],
      result: {
        source: sourceId,
        jobsFetched: 0,
        error: `${adapter.displayName} is not configured`,
      },
    };
  }

  const searchQueries = queries || DEFAULT_SEARCH_QUERIES.slice(0, 3);
  const allJobs: RawJobItem[] = [];
  let error: string | undefined;

  for (const query of searchQueries) {
    try {
      const result = await adapter.fetchJobs(query);
      allJobs.push(...filterFetchedJobs(result.jobs));
      if (result.error) {
        error = result.error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (err) {
      error = err instanceof Error ? err.message : "Fetch error";
    }
  }

  return {
    jobs: allJobs,
    result: {
      source: sourceId,
      jobsFetched: allJobs.length,
      error,
    },
  };
}

function emptyResult(fetchResults: FetchResult[], fetchMs: number): PipelineResult {
  return {
    fetchResults,
    dedupe: {
      inputCount: 0,
      newCount: 0,
      duplicateCount: 0,
      inBatchDuplicates: 0,
      crossCollectionDuplicates: 0,
    },
    enrichment: emptyEnrichmentStats(),
    ranking: emptyRankingStats(),
    summary: {
      fetched: fetchResults.reduce((sum, result) => sum + result.jobsFetched, 0),
      dedupedNew: 0,
      attemptedEnrichment: 0,
      enriched: 0,
      failed: 0,
      skipped: 0,
      deferred: 0,
      ranked: 0,
      attemptedContacts: 0,
      attemptedOutreach: 0,
      contactsGenerated: 0,
      outreachGenerated: 0,
    },
    timing: {
      fetchMs,
      dedupeMs: 0,
      enrichMs: 0,
      rankMs: 0,
      totalMs: fetchMs,
    },
  };
}

export function filterFetchedJobs(jobs: RawJobItem[]): RawJobItem[] {
  return jobs.filter((job) => !shouldExcludeFetchedJob(job));
}

function shouldExcludeFetchedJob(job: RawJobItem): boolean {
  const title = (job.title || "").trim();
  return EXCLUDED_TITLE_PATTERN.test(title);
}

function emptyEnrichmentStats(): EnrichmentResult["stats"] {
  return {
    total: 0,
    attempted: 0,
    enriched: 0,
    failed: 0,
    skipped: 0,
    deferred: 0,
    parseFailures: 0,
    evaluationFailures: 0,
    timeoutFailures: 0,
    noDescription: 0,
    avgFitScore: 0,
    highPriority: 0,
    rejected: 0,
    attemptedContacts: 0,
    contactsGenerated: 0,
    attemptedOutreach: 0,
    outreachGenerated: 0,
    fallbackCount: 0,
  };
}

function emptyRankingStats(): RankingResult["stats"] {
  return {
    total: 0,
    scored: 0,
    unscored: 0,
    avgFitScore: 0,
    avgRedFlagScore: 0,
  };
}

/**
 * Raw jobs that have never made it through enrichment — i.e. their
 * dedupeKey is present in `raw_jobs` but absent from any `jobs` row
 * (inbox / enriched / rejected). Ordered with newest raws first so the
 * pipeline drains the most recent backlog first.
 */
async function getUnenrichedRawJobs(userId?: string): Promise<RawJobItem[]> {
  const [raws, inbox, enriched, rejected] = await Promise.all([
    getRawJobs(userId),
    getInboxJobs(userId),
    getEnrichedJobs(userId),
    getRejectedJobs(userId),
  ]);

  const processedKeys = new Set<string>();
  for (const job of [...inbox, ...enriched, ...rejected]) {
    if (job.dedupeKey) processedKeys.add(job.dedupeKey);
  }

  return raws.filter((raw) => {
    const key =
      (raw as RawJobItem & { dedupeKey?: string }).dedupeKey ||
      generateDedupeKey(raw);
    return !processedKeys.has(key);
  }).sort((left, right) => {
    const leftGmail = left.source.startsWith("gmail-") ? 1 : 0;
    const rightGmail = right.source.startsWith("gmail-") ? 1 : 0;
    if (leftGmail !== rightGmail) {
      return rightGmail - leftGmail;
    }

    const leftFetchedAt = new Date(left.fetchedAt || 0).getTime();
    const rightFetchedAt = new Date(right.fetchedAt || 0).getTime();
    return rightFetchedAt - leftFetchedAt;
  });
}

function mergeByDedupeKey(jobs: RawJobItem[]): RawJobItem[] {
  const seen = new Set<string>();
  const out: RawJobItem[] = [];
  for (const job of jobs) {
    const key =
      (job as RawJobItem & { dedupeKey?: string }).dedupeKey ||
      generateDedupeKey(job);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(job);
  }
  return out;
}

export { deduplicateJobs } from "./dedupe";
export { enrichJobs, enrichSingleRawJob } from "./enrich";
export { rankJobs, reRankJobs } from "./rank";
