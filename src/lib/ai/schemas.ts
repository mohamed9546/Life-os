// ============================================================
// Zod schemas for all AI output structures.
// Every AI task validates its output against these schemas
// to ensure structured, predictable data.
// ============================================================

import { z } from "zod";

// --- Job Parsing ---

export const ParsedJobPostingSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  salaryText: z.string().nullable(),
  employmentType: z.enum(["permanent", "contract", "temp", "unknown"]),
  seniority: z.string(),
  remoteType: z.enum(["remote", "hybrid", "onsite", "unknown"]),
  roleFamily: z.string(),
  roleTrack: z.enum(["qa", "regulatory", "pv", "medinfo", "clinical", "other"]),
  mustHaves: z.array(z.string()),
  niceToHaves: z.array(z.string()),
  redFlags: z.array(z.string()),
  keywords: z.array(z.string()),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
});

// --- Job Fit ---

export const JobFitEvaluationSchema = z.object({
  fitScore: z.number().min(0).max(100),
  redFlagScore: z.number().min(0).max(100),
  priorityBand: z.enum(["high", "medium", "low", "reject"]),
  whyMatched: z.array(z.string()),
  whyNot: z.array(z.string()),
  strategicValue: z.string(),
  likelyInterviewability: z.string(),
  actionRecommendation: z.enum(["apply now", "apply if time", "skip"]),
  visaRisk: z.enum(["green", "amber", "red"]),
  confidence: z.number().min(0).max(1),
});

// --- Transaction ---

export const TransactionCategorizationSchema = z.object({
  category: z.string(),
  merchantCleaned: z.string(),
  confidence: z.number().min(0).max(1),
  notes: z.string(),
});

export const CandidateProfileSchema = z.object({
  fullName: z.string(),
  headline: z.string(),
  location: z.string(),
  openToRelocationUk: z.boolean(),
  summary: z.string(),
  targetTitles: z.array(z.string()),
  targetRoleTracks: z.array(
    z.enum(["qa", "regulatory", "pv", "medinfo", "clinical", "other"])
  ),
  locationConstraints: z.array(z.string()),
  transitionNarrative: z.string(),
  strengths: z.array(z.string()),
  experienceHighlights: z.array(z.string()),
  education: z.array(z.string()),
  sourceCvIds: z.array(z.string()).optional(),
  extraction: z
    .object({
      reviewState: z.enum(["draft", "approved"]),
      confidence: z.number().min(0).max(1),
      issues: z.array(z.string()),
      extractedAt: z.string(),
      sourceFiles: z.array(z.string()),
    })
    .optional(),
});

export const CandidateProfileImportSchema = z.object({
  rawText: z.string(),
  profile: CandidateProfileSchema,
  confidence: z.number().min(0).max(1),
  issues: z.array(z.string()),
  sourceFiles: z.array(z.string()),
  extractedAt: z.string(),
});

// --- Decision ---

export const DecisionSummarySchema = z.object({
  conciseSummary: z.string(),
  hiddenAssumptions: z.array(z.string()),
  risks: z.array(z.string()),
  nextReviewQuestions: z.array(z.string()),
});

export const DecisionPatternReviewSchema = z.object({
  repeatedAssumptions: z.array(z.string()),
  commonRiskThemes: z.array(z.string()),
  avoidanceLoops: z.array(z.string()),
  reviewChecklist: z.array(z.string()),
  narrativeSummary: z.string(),
  confidence: z.number().min(0).max(1),
});

export const MoneyReviewSchema = z.object({
  narrativeSummary: z.string(),
  recurringCommitments: z.array(z.string()),
  unusualSpikes: z.array(z.string()),
  monthlyAdjustments: z.array(z.string()),
  stabilityWarning: z.string(),
  confidence: z.number().min(0).max(1),
});

// --- Weekly Review ---

export const WeeklyReviewSchema = z.object({
  weeklySummary: z.string(),
  wins: z.array(z.string()),
  risks: z.array(z.string()),
  recommendedFocus: z.array(z.string()),
  whatToIgnore: z.array(z.string()),
  energyAdvice: z.string(),
  jobSearchAdvice: z.string(),
  moneyAdvice: z.string(),
  unfinishedLoops: z.array(z.string()),
  nextWeekOperatingFocus: z.array(z.string()),
});

export const RoutineFocusSchema = z.object({
  consistencyScore: z.number().min(0).max(100),
  skippedLoopWarnings: z.array(z.string()),
  nextBestAction: z.string(),
});

// --- Follow Up ---

export const FollowUpPlanSchema = z.object({
  nextAction: z.string(),
  followUpDateSuggestion: z.string(),
  rationale: z.string(),
  customNotes: z.string(),
});

// --- Health test ---

export const HealthTestSchema = z.object({
  message: z.string(),
});

/**
 * Safely validate AI output against a schema.
 * Returns the validated data or null with error details.
 */
export function validateAIOutput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { valid: true; data: T } | { valid: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return {
    valid: false,
    error: result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; "),
  };
}
