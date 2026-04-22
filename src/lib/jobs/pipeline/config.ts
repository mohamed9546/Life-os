export const PIPELINE_ENRICHMENT_BUDGETS = {
  manual: 25,
  worker: 10,
  textImport: 10,
  jsonImport: 12,
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
