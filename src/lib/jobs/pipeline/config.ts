export const PIPELINE_BUDGETS = {
  manual: {
    maxEnrich: 5,
    maxQueries: 6,
    maxSources: 6,
    includeContactEnrichment: false,
  },
  worker: {
    maxEnrich: 25,
    maxQueries: null,
    maxSources: null,
    includeContactEnrichment: true,
  },
  textImport: {
    maxEnrich: 15,
    maxQueries: null,
    maxSources: null,
    includeContactEnrichment: false,
  },
  jsonImport: {
    maxEnrich: 20,
    maxQueries: null,
    maxSources: null,
    includeContactEnrichment: false,
  },
} as const;

export type PipelineBudgetProfile = keyof typeof PIPELINE_BUDGETS;

export const PIPELINE_ENRICHMENT_BUDGETS = {
  manual: PIPELINE_BUDGETS.manual.maxEnrich,
  worker: PIPELINE_BUDGETS.worker.maxEnrich,
  textImport: PIPELINE_BUDGETS.textImport.maxEnrich,
  jsonImport: PIPELINE_BUDGETS.jsonImport.maxEnrich,
} as const;

export function resolvePipelineEnrichmentBudget(
  profile: PipelineBudgetProfile,
  explicit?: number
): number {
  if (typeof explicit === "number" && explicit > 0) {
    return explicit;
  }

  return PIPELINE_BUDGETS[profile].maxEnrich;
}

export function resolvePipelineQueryBudget(
  profile: PipelineBudgetProfile
): number | null {
  return PIPELINE_BUDGETS[profile].maxQueries;
}

export function resolvePipelineSourceBudget(
  profile: PipelineBudgetProfile
): number | null {
  return PIPELINE_BUDGETS[profile].maxSources;
}

export function resolvePipelineContactEnrichment(
  profile: PipelineBudgetProfile
): boolean {
  return PIPELINE_BUDGETS[profile].includeContactEnrichment;
}
