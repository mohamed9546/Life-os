// ============================================================
// AI Task: Generate a weekly review summary.
// ============================================================

import { WeeklyReview, AIResult } from "@/types";
import { callAI } from "../client";
import { WeeklyReviewSchema, validateAIOutput } from "../schemas";

const SYSTEM_PROMPT = `You are a personal operating system weekly review AI.
Analyze the user's week across career, money, and life dimensions.
Be specific, actionable, and honest. Don't be generic.
Always respond with valid JSON only.`;

interface WeeklyReviewInput {
  jobsReviewed: number;
  jobsTracked: number;
  jobsApplied: number;
  topJobs: Array<{ title: string; company: string; fitScore: number }>;
  transactionCount: number;
  totalSpend: number;
  topCategories: Array<{ category: string; total: number }>;
  openDecisions: number;
  completedDecisions: number;
  routinesEnabled?: number;
  routineCheckInsLast7Days?: number;
  consistencyScore?: number;
  skippedLoopWarnings?: string[];
}

function dedupeNonEmpty(items: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))
  );
}

function buildDeterministicWeeklyReview(input: WeeklyReviewInput): WeeklyReview {
  const wins = dedupeNonEmpty([
    input.jobsReviewed > 0
      ? `Reviewed ${input.jobsReviewed} job${input.jobsReviewed === 1 ? "" : "s"} and kept the pipeline moving.`
      : "Captured the current state of the career pipeline even if new roles were limited.",
    input.jobsApplied > 0
      ? `Submitted ${input.jobsApplied} application${input.jobsApplied === 1 ? "" : "s"} instead of staying in planning mode.`
      : undefined,
    input.transactionCount > 0
      ? `Tracked ${input.transactionCount} money event${input.transactionCount === 1 ? "" : "s"} to maintain financial visibility.`
      : undefined,
    (input.routineCheckInsLast7Days || 0) > 0
      ? `Logged ${input.routineCheckInsLast7Days} routine check-in${input.routineCheckInsLast7Days === 1 ? "" : "s"} across the week.`
      : undefined,
  ]).slice(0, 4);

  const risks = dedupeNonEmpty([
    input.jobsApplied === 0
      ? "The job search is at risk of becoming review-heavy without enough application output."
      : undefined,
    input.openDecisions > input.completedDecisions
      ? "Open decisions are accumulating faster than they are being closed."
      : undefined,
    (input.consistencyScore || 0) < 50
      ? "Routine consistency is low enough to create friction and repeated restarts."
      : undefined,
    (input.skippedLoopWarnings?.length || 0) > 0
      ? input.skippedLoopWarnings?.[0]
      : undefined,
  ]).slice(0, 4);

  const recommendedFocus = dedupeNonEmpty([
    input.jobsApplied < 3
      ? "Increase application output for high-fit roles instead of widening the search too early."
      : "Keep the pipeline tight and focus on follow-up for the strongest applications.",
    input.topJobs.length > 0
      ? `Prioritize roles similar to ${input.topJobs[0].title} at ${input.topJobs[0].company}.`
      : "Refresh the top of the pipeline with strong-fit CTA, clinical operations, and regulated desk-based roles.",
    (input.consistencyScore || 0) < 65
      ? "Rebuild a minimum-day routine so the week does not depend on motivation."
      : "Protect the routines that are already working and keep them lightweight.",
    input.totalSpend > 0
      ? "Review the largest spending categories before the next week starts."
      : "Keep financial tracking current so risk signals stay visible.",
  ]).slice(0, 4);

  const topCategory = input.topCategories[0];
  const unfinishedLoops = dedupeNonEmpty([
    input.openDecisions > 0
      ? `${input.openDecisions} decision${input.openDecisions === 1 ? "" : "s"} still need closure.`
      : undefined,
    input.jobsTracked > input.jobsApplied
      ? "Tracked roles need either a follow-up action or a clear rejection decision."
      : undefined,
    input.skippedLoopWarnings?.[0],
  ]).slice(0, 4);

  const nextWeekOperatingFocus = dedupeNonEmpty([
    "Protect a small number of strategic priorities rather than expanding the system surface area.",
    "Use AI for structured recommendations, then keep execution deterministic and approval-based.",
    input.jobsReviewed > 0
      ? "Convert the strongest reviewed roles into concrete next actions."
      : "Rebuild career momentum with a fresh intake of target roles from priority sources.",
  ]).slice(0, 4);

  return {
    weeklySummary:
      input.jobsReviewed > 0 || input.transactionCount > 0 || (input.routineCheckInsLast7Days || 0) > 0
        ? `The week produced usable signal across career, money, and routine tracking, even without a heavier model pass. The main opportunity now is to convert that signal into fewer, sharper actions. Keep the system compact, prioritize high-fit job moves, and avoid letting open loops spread across too many areas.`
        : `The week looks light on fresh operating data, so the priority is rebuilding visibility before adding complexity. Start with a small set of career, money, and routine actions that restore momentum. Use the system to reduce rethinking rather than to create more overhead.`,
    wins:
      wins.length > 0
        ? wins
        : ["Kept the operating system available with deterministic fallback instead of losing the review entirely."],
    risks:
      risks.length > 0
        ? risks
        : ["Low fresh activity means next week's priorities need to be chosen deliberately rather than reactively."],
    recommendedFocus:
      recommendedFocus.length > 0
        ? recommendedFocus
        : ["Choose one concrete action in career, money, and routines before broadening scope."],
    whatToIgnore: [
      "Low-fit roles that add noise without improving interview odds.",
      "Any urge to rebuild the system instead of using the parts that already work.",
    ],
    energyAdvice:
      (input.consistencyScore || 0) >= 65
        ? "Your current routine base is strong enough to support focused work. Keep the cadence steady and avoid adding unnecessary complexity."
        : "Lower the operating bar for difficult days. A reliable minimum-day routine will protect momentum better than ambitious planning.",
    jobSearchAdvice:
      input.jobsApplied === 0
        ? "Shift from passive review to active pipeline movement. Focus on CTA, clinical operations support, and other documentation-heavy regulated roles with realistic interview potential."
        : "Follow up on active opportunities and keep prioritizing regulated, documentation-heavy roles with lower visa friction and clearer interviewability.",
    moneyAdvice: topCategory
      ? `Review ${topCategory.category}, which is currently the largest visible spend category at GBP ${topCategory.total.toFixed(2)}.`
      : "Keep transaction imports current so financial risk stays visible and categorization remains useful.",
    unfinishedLoops:
      unfinishedLoops.length > 0
        ? unfinishedLoops
        : ["No major unfinished loops were surfaced, so keep the operating focus narrow."],
    nextWeekOperatingFocus:
      nextWeekOperatingFocus.length > 0
        ? nextWeekOperatingFocus
        : ["Keep the system calm, compact, and execution-first next week."],
  };
}

function buildPrompt(input: WeeklyReviewInput): string {
  return `Generate a weekly review based on this data:

JOB SEARCH:
- Jobs reviewed: ${input.jobsReviewed}
- Jobs tracked: ${input.jobsTracked}
- Jobs applied to: ${input.jobsApplied}
- Top matches: ${input.topJobs.map((j) => `${j.title} at ${j.company} (fit: ${j.fitScore})`).join("; ") || "None"}

MONEY:
- Transactions: ${input.transactionCount}
- Total spend: GBP ${input.totalSpend.toFixed(2)}
- Top categories: ${input.topCategories.map((c) => `${c.category}: GBP ${c.total.toFixed(2)}`).join(", ") || "None"}

DECISIONS:
- Open: ${input.openDecisions}
- Completed: ${input.completedDecisions}

ROUTINES:
- Enabled: ${input.routinesEnabled || 0}
- Check-ins last 7 days: ${input.routineCheckInsLast7Days || 0}
- Consistency score: ${input.consistencyScore || 0}
- Skipped-loop warnings: ${input.skippedLoopWarnings?.join(", ") || "None"}

Return exactly:
{
  "weeklySummary": "3-4 sentence overview of the week",
  "wins": ["things that went well"],
  "risks": ["things to watch out for"],
  "recommendedFocus": ["what to focus on next week"],
  "whatToIgnore": ["what to deliberately deprioritize"],
  "energyAdvice": "advice on energy management",
  "jobSearchAdvice": "specific job search guidance",
  "moneyAdvice": "specific money guidance",
  "unfinishedLoops": ["open loops or neglected systems to close"],
  "nextWeekOperatingFocus": ["clear operating themes for next week"]
}

Respond with ONLY the JSON object.`;
}

export async function summarizeWeek(
  input: WeeklyReviewInput
): Promise<AIResult<WeeklyReview> | { error: string }> {
  const result = await callAI<WeeklyReview>({
    taskType: "summarize-week",
    prompt: buildPrompt(input),
    systemPrompt: SYSTEM_PROMPT,
    rawInput: input,
    temperature: 0.2,
  });

  if (!result.success || !result.data) {
    const fallback = buildDeterministicWeeklyReview(input);
    return {
      data: fallback,
      meta: {
        model: "deterministic-fallback",
        promptType: "summarize-week",
        timestamp: new Date().toISOString(),
        confidence: 0.38,
        durationMs: 0,
        inputBytes: new TextEncoder().encode(JSON.stringify(input)).length,
        outputBytes: new TextEncoder().encode(JSON.stringify(fallback)).length,
        fallbackUsed: true,
        fallbackAttempted: result.fallbackAttempted ?? false,
        attemptCount: result.attemptCount ?? 0,
        effectiveTimeoutMs: result.effectiveTimeoutMs ?? 0,
        jsonExtractionFallback: false,
        failureKind: result.failureKind,
      },
      rawInput: input,
      rawOutput: JSON.stringify(fallback),
    };
  }

  const validation = validateAIOutput(WeeklyReviewSchema, result.data);
  if (!validation.valid) {
    const fallback = buildDeterministicWeeklyReview(input);
    return {
      data: fallback,
      meta: {
        ...result.meta!,
        model: "deterministic-fallback",
        confidence: 0.4,
        outputBytes: new TextEncoder().encode(JSON.stringify(fallback)).length,
        fallbackUsed: true,
        failureKind: "schema_validation",
      },
      rawInput: input,
      rawOutput: JSON.stringify(fallback),
    };
  }

  return {
    data: validation.data,
    meta: { ...result.meta!, confidence: 0.75 },
    rawInput: input,
    rawOutput: result.rawOutput,
  };
}

export type { WeeklyReviewInput };
