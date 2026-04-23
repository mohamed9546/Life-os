// ============================================================
// Full job pipeline orchestrator.
// Coordinates: fetch -> dedupe -> enrich -> rank -> store
// ============================================================

import { EnrichedJob, RawJobItem } from "@/types";
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
  overwriteRankedJobs,
  saveRawJobs,
  saveToInbox,
  saveToRejected,
} from "@/lib/jobs/storage";
import { dedupeJobsById } from "@/lib/jobs/selectors";
import { resolvePipelineEnrichmentBudget } from "./config";

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
}

export interface PipelineOptions {
  sources?: string[];
  queries?: JobSearchQuery[];
  userId?: string;
  maxEnrich?: number;
  skipEnrich?: boolean;
  skipRank?: boolean;
}

export async function runFullPipeline(
  options?: PipelineOptions
): Promise<PipelineResult> {
  const totalStart = Date.now();
  const opts = options || {};

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

  if (!opts.skipEnrich && dedupeResult.newJobs.length > 0) {
    const enrichStart = Date.now();
    const enrichBudget = resolvePipelineEnrichmentBudget("manual", opts.maxEnrich);
    enrichResult = await enrichJobs(dedupeResult.newJobs, {
      maxBatchSize: enrichBudget,
    });
    enrichMs = Date.now() - enrichStart;

    const inboxJobs = enrichResult.enriched.filter((job) => job.status === "inbox");
    const rejectedJobs = enrichResult.enriched.filter(
      (job) => job.status === "rejected"
    );

    if (inboxJobs.length > 0) {
      await saveToInbox(inboxJobs, opts.userId);
    }
    if (rejectedJobs.length > 0) {
      await saveToRejected(rejectedJobs, opts.userId);
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
  
  console.log(`[pipeline] Proceeding with adapters:`, adapters.map(a => a.sourceId).join(', '));

  const queries = opts.queries && opts.queries.length > 0 ? opts.queries : DEFAULT_SEARCH_QUERIES;
  const allJobs: RawJobItem[] = [];
  const fetchResults: FetchResult[] = [];

  for (const adapter of adapters) {
    let adapterJobCount = 0;
    let adapterError: string | undefined;

    for (const query of queries) {
      try {
        const result: JobSourceResult = await adapter.fetchJobs(query);

        if (result.error) {
          adapterError = result.error;
          console.error(`[pipeline] Error from ${adapter.sourceId} for query "${query.keywords.join(', ')}":`, result.error);
        }

        if (result.jobs.length > 0) {
          allJobs.push(...result.jobs);
          adapterJobCount += result.jobs.length;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch (err) {
        adapterError = err instanceof Error ? err.message : "Unknown fetch error";
        console.error(`[pipeline] Exception from ${adapter.sourceId}:`, adapterError);
      }
    }

    fetchResults.push({
      source: adapter.sourceId,
      jobsFetched: adapterJobCount,
      error: adapterError,
    });
  }

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
      allJobs.push(...result.jobs);
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

export { deduplicateJobs } from "./dedupe";
export { enrichJobs, enrichSingleRawJob } from "./enrich";
export { rankJobs, reRankJobs } from "./rank";
