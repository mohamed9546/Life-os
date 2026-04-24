export const PIPELINE_ENRICHMENT_BUDGETS = {
  // Manual button clicks drain up to 40 per run. With ~3-5s per Gemini call
  // this keeps the full pipeline under ~3 minutes while making visible progress
  // against the backlog. Users can always click again.
  manual: 40,
  worker: 25,
  textImport: 15,
  jsonImport: 20,
} as const;

export type PipelineBudgetProfile = keyof typeof PIPELINE_ENRICHMENT_BUDGETS;

export function resolvePipelineEnrichmentBudget(
  profile: PipelineBudgetProfile,
  explicit?: number
): number {
  if (typeof explicit === "number" && explicit > 0) {
    return explicit;
  }

  return PIPELINE_ENRICHMENT_BUDGETS[profile];
}
