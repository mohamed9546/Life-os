// ============================================================
// Job enrichment pipeline step.
// Takes raw jobs and runs them through:
// 1. AI parse (extract structured data from description)
// 2. AI evaluate (score fit against user profile)
// 3. Optional: Company enrichment via Apollo
// 4. Optional: Decision maker discovery via Apollo
// ============================================================

import { v4 as uuidv4 } from "uuid";
import {
  AIFailureKind,
  AIResult,
  EnrichedJob,
  JobFitEvaluation,
  ParsedJobPosting,
  RawJobItem,
} from "@/types";
import { parseJobPosting } from "@/lib/ai/tasks/parse-job";
import { evaluateJobFit } from "@/lib/ai/tasks/evaluate-job";
import { generateDedupeKey } from "@/lib/jobs/sources/normalize";
import { checkAIRateLimit } from "@/lib/ai/rate-limiter";
import { buildContactStrategy } from "@/lib/enrichment";
import { evaluateRawJobRelevance } from "./relevance";

type EnrichmentStage = "parse" | "evaluate" | "contacts" | "job";

export interface EnrichmentResult {
  enriched: EnrichedJob[];
  failed: Array<{
    raw: RawJobItem;
    stage: EnrichmentStage;
    error: string;
    failureKind?: AIFailureKind;
  }>;
  skipped: Array<{ raw: RawJobItem; reason: string }>;
  stats: {
    total: number;
    attempted: number;
    enriched: number;
    failed: number;
    skipped: number;
    deferred: number;
    parseFailures: number;
    evaluationFailures: number;
    timeoutFailures: number;
    noDescription: number;
    avgFitScore: number;
    highPriority: number;
    rejected: number;
    attemptedContacts: number;
    contactsGenerated: number;
    attemptedOutreach: number;
    outreachGenerated: number;
    fallbackCount: number;
  };
}

export interface EnrichmentOptions {
  maxBatchSize?: number;
  parseOnly?: boolean;
  minDescriptionLength?: number;
}

interface EnrichmentDiagnostics {
  parseFailure?: { error: string; failureKind?: AIFailureKind };
  evaluationFailure?: { error: string; failureKind?: AIFailureKind };
  attemptedContacts: boolean;
  contactsGenerated: number;
  attemptedOutreach: boolean;
  outreachGenerated: boolean;
  fallbackCount: number;
}

const DEFAULT_OPTIONS: Required<EnrichmentOptions> = {
  maxBatchSize: 20,
  parseOnly: false,
  minDescriptionLength: 50,
};

export async function enrichJobs(
  rawJobs: RawJobItem[],
  options?: EnrichmentOptions
): Promise<EnrichmentResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const now = new Date().toISOString();

  const enriched: EnrichedJob[] = [];
  const failed: EnrichmentResult["failed"] = [];
  const skipped: EnrichmentResult["skipped"] = [];

  const batch = rawJobs.slice(0, opts.maxBatchSize);
  const deferred = Math.max(0, rawJobs.length - batch.length);

  if (deferred > 0) {
    console.log(
      `[enrich] Processing ${batch.length} of ${rawJobs.length} jobs (${deferred} deferred)`
    );
  }

  let parseFailures = 0;
  let evaluationFailures = 0;
  let timeoutFailures = 0;
  let noDescription = 0;
  let attemptedContacts = 0;
  let contactsGenerated = 0;
  let attemptedOutreach = 0;
  let outreachGenerated = 0;
  let fallbackCount = 0;

  for (let i = 0; i < batch.length; i++) {
    const raw = batch[i];
    const textToParse = buildParseText(raw);

    if (textToParse.length < opts.minDescriptionLength) {
      noDescription += 1;
      skipped.push({
        raw,
        reason: "No description or too little text for reliable parsing",
      });
      continue;
    }

    const relevance = evaluateRawJobRelevance(raw);
    if (relevance.hardReject) {
      skipped.push({
        raw,
        reason: `Pre-rank relevance gate: ${relevance.reasons.join(" ")}`
      });
      continue;
    }

    const rateCheck = await checkAIRateLimit("parse-job");
    if (!rateCheck.allowed) {
      skipped.push({ raw, reason: rateCheck.reason || "Rate limited" });
      console.log(
        `[enrich] Rate limited at job ${i + 1}/${batch.length}: ${rateCheck.reason}`
      );
      for (let j = i + 1; j < batch.length; j++) {
        skipped.push({
          raw: batch[j],
          reason: "Batch halted due to rate limit",
        });
      }
      break;
    }

    try {
      const result = await enrichSingleJob(raw, opts, now);
      enriched.push(result.job);

      if (result.diagnostics.parseFailure) {
        parseFailures += 1;
        if (result.diagnostics.parseFailure.failureKind === "timeout") {
          timeoutFailures += 1;
        }
      }

      if (result.diagnostics.evaluationFailure) {
        evaluationFailures += 1;
        if (result.diagnostics.evaluationFailure.failureKind === "timeout") {
          timeoutFailures += 1;
        }
      }

      attemptedContacts += result.diagnostics.attemptedContacts ? 1 : 0;
      contactsGenerated += result.diagnostics.contactsGenerated;
      attemptedOutreach += result.diagnostics.attemptedOutreach ? 1 : 0;
      outreachGenerated += result.diagnostics.outreachGenerated ? 1 : 0;
      fallbackCount += result.diagnostics.fallbackCount;

      console.log(
        `[enrich] ${i + 1}/${batch.length}: ${raw.title} @ ${raw.company} -> ` +
          `fit=${result.job.fit?.data?.fitScore ?? "N/A"}, ` +
          `band=${result.job.fit?.data?.priorityBand ?? "N/A"}, ` +
          `contacts=${result.job.decisionMakers?.length || 0}`
      );

      if (i < batch.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown enrichment error";
      console.error(`[enrich] Failed: ${raw.title} @ ${raw.company}: ${errorMsg}`);
      failed.push({
        raw,
        stage: "job",
        error: errorMsg,
        failureKind: "runtime_error",
      });
    }
  }

  const fitScores = enriched
    .map((job) => job.fit?.data?.fitScore)
    .filter((score): score is number => score !== undefined && score !== null);

  const avgFitScore =
    fitScores.length > 0
      ? Math.round(fitScores.reduce((left, right) => left + right, 0) / fitScores.length)
      : 0;

  const stats: EnrichmentResult["stats"] = {
    total: rawJobs.length,
    attempted: batch.length,
    enriched: enriched.length,
    failed: failed.length,
    skipped: skipped.length,
    deferred,
    parseFailures,
    evaluationFailures,
    timeoutFailures,
    noDescription,
    avgFitScore,
    highPriority: enriched.filter((job) => job.fit?.data?.priorityBand === "high").length,
    rejected: enriched.filter((job) => job.fit?.data?.priorityBand === "reject").length,
    attemptedContacts,
    contactsGenerated,
    attemptedOutreach,
    outreachGenerated,
    fallbackCount,
  };

  console.log(
    `[enrich] Complete: ${stats.enriched} enriched, ${stats.failed} failed, ` +
      `${stats.skipped} skipped, ${stats.deferred} deferred. ` +
      `Parse failures: ${stats.parseFailures}, eval failures: ${stats.evaluationFailures}, ` +
      `timeouts: ${stats.timeoutFailures}, contacts: ${stats.contactsGenerated}`
  );

  return { enriched, failed, skipped, stats };
}

async function enrichSingleJob(
  raw: RawJobItem,
  opts: Required<EnrichmentOptions>,
  now: string
): Promise<{
  job: EnrichedJob;
  diagnostics: EnrichmentDiagnostics;
}> {
  const id = uuidv4();
  const dedupeKey = generateDedupeKey(raw);
  const textToParse = buildParseText(raw);
  const diagnostics: EnrichmentDiagnostics = {
    attemptedContacts: false,
    contactsGenerated: 0,
    attemptedOutreach: false,
    outreachGenerated: false,
    fallbackCount: 0,
  };

  let parsed: AIResult<ParsedJobPosting> | null = null;
  const parseResult = await parseJobPosting(textToParse, {
    source: raw.source,
    company: raw.company,
    location: raw.location,
    ...(raw.salaryText ? { salary: raw.salaryText } : {}),
  });

  if ("error" in parseResult) {
    diagnostics.parseFailure = {
      error: parseResult.error,
      failureKind: parseResult.failureKind,
    };
    console.warn(`[enrich] Parse failed for ${raw.title}: ${parseResult.error}`);
  } else {
    parsed = parseResult;
    diagnostics.fallbackCount += parseResult.meta.fallbackAttempted ? 1 : 0;
  }

  let fit: AIResult<JobFitEvaluation> | null = null;
  if (parsed && !opts.parseOnly) {
    const evaluateResult = await evaluateJobFit(parsed.data);

    if ("error" in evaluateResult) {
      diagnostics.evaluationFailure = {
        error: evaluateResult.error,
        failureKind: evaluateResult.failureKind,
      };
      console.warn(`[enrich] Evaluate failed for ${raw.title}: ${evaluateResult.error}`);
    } else {
      fit = evaluateResult;
      diagnostics.fallbackCount += evaluateResult.meta.fallbackAttempted ? 1 : 0;
    }
  }

  let status: EnrichedJob["status"] = "inbox";
  if (fit?.data?.priorityBand === "reject") {
    status = "rejected";
  }

  let companyIntel = null;
  let decisionMakers: EnrichedJob["decisionMakers"] = [];
  let outreachStrategy = null;

  // Run contact strategy whenever parsing succeeded and the job isn't rejected.
  // If AI evaluation failed, use a zero-score stub — company intel will still
  // be fetched, but decision-maker search will respect the fit-score threshold
  // (effectively skipping it until the user manually refreshes contacts).
  if (parsed?.data && status !== "rejected") {
    diagnostics.attemptedContacts = true;
    diagnostics.attemptedOutreach = true;

    const fitForContacts = fit?.data ?? {
      fitScore: 0,
      redFlagScore: 0,
      priorityBand: "low" as const,
      whyMatched: [],
      whyNot: [],
      strategicValue: "",
      likelyInterviewability: "",
      actionRecommendation: "skip",
      visaRisk: "green",
      confidence: 0,
    };

    try {
      const contactStrategy = await buildContactStrategy(raw, parsed.data, fitForContacts);
      companyIntel = contactStrategy.companyIntel;
      decisionMakers = contactStrategy.decisionMakers;
      outreachStrategy = contactStrategy.outreachStrategy;
      diagnostics.contactsGenerated = decisionMakers.length;
      diagnostics.outreachGenerated = Boolean(outreachStrategy);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown contact strategy error";
      console.warn(`[enrich] Contact strategy failed for ${raw.title}: ${errorMsg}`);
      diagnostics.attemptedOutreach = false;
    }
  }

  return {
    job: {
      id,
      raw,
      parsed,
      fit,
      status,
      dedupeKey,
      companyIntel,
      decisionMakers,
      outreachStrategy,
      createdAt: now,
      updatedAt: now,
    },
    diagnostics,
  };
}

function buildParseText(raw: RawJobItem): string {
  const parts: string[] = [];

  parts.push(`Title: ${raw.title}`);
  parts.push(`Company: ${raw.company}`);
  if (raw.location) parts.push(`Location: ${raw.location}`);
  if (raw.salaryText) parts.push(`Salary: ${raw.salaryText}`);
  if (raw.employmentType) parts.push(`Type: ${raw.employmentType}`);
  if (raw.remoteType) parts.push(`Remote: ${raw.remoteType}`);

  if (raw.description) {
    parts.push("");
    parts.push(raw.description);
  }

  return parts.join("\n");
}

export async function enrichSingleRawJob(raw: RawJobItem): Promise<EnrichedJob> {
  const result = await enrichSingleJob(
    raw,
    DEFAULT_OPTIONS,
    new Date().toISOString()
  );

  return result.job;
}
