// ============================================================
// Centralized local AI runtime configuration.
// Persists to /data/ai-config.json with optional env overrides.
// ============================================================

import { readObject, writeObject, ConfigFiles } from "@/lib/storage";
import { AIConfig, AITaskType } from "@/types";
import { isLocalOnlyMode } from "@/lib/env/local-only";

const LOCAL_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const LOCAL_OLLAMA_MODEL = "qwen3.5:2b";

export const AI_TASK_ORDER: AITaskType[] = [
  "health-test",
  "parse-job",
  "evaluate-job",
  "extract-candidate-profile",
  "categorize-transaction",
  "summarize-money",
  "summarize-week",
  "summarize-decision",
  "summarize-decision-patterns",
  "suggest-routine-focus",
  "generate-followup",
  "generate-outreach",
  "chat",
  "tailor-cv",
  "linkedin-intro",
  "cover-letter",
  "cv-optimize",
  "interview-prep",
  "salary-lookup",
  "skill-gap",
  "extract-job-from-scrape",
  "extract-job-list-from-scrape",
];

export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: "ollama",
  mode: "local",
  enabled: true,
  baseUrl: process.env.OLLAMA_BASE_URL || LOCAL_OLLAMA_BASE_URL,
  apiKey: null,
  compatibilityMode: "ollama",
  model: LOCAL_OLLAMA_MODEL,
  fallbackModel: null,
  timeoutMs: 45_000,
  temperature: 0.15,
  maxTokens: 1_200,
  retryAttempts: 0,
  retryDelayMs: 1_500,
  maxCallsPerDay: 750,
  maxCallsPerTaskType: 250,
  taskSettings: {
    "health-test": {
      enabled: true,
      label: "Health test",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 12_000,
      retryAttempts: 0,
      temperature: 0,
      maxTokens: 120,
    },
    "parse-job": {
      enabled: true,
      label: "Parse job posting",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 35_000,
      retryAttempts: 0,
      temperature: 0.1,
      maxTokens: 600,
    },
    "evaluate-job": {
      enabled: true,
      label: "Evaluate job fit",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 45_000,
      retryAttempts: 0,
      temperature: 0.1,
      maxTokens: 600,
    },
    "categorize-transaction": {
      enabled: true,
      label: "Categorize transaction",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 20_000,
      retryAttempts: 0,
      temperature: 0.05,
      maxTokens: 320,
    },
    "extract-candidate-profile": {
      enabled: true,
      label: "Extract candidate profile",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 35_000,
      retryAttempts: 0,
      temperature: 0.1,
      maxTokens: 1_200,
    },
    "summarize-money": {
      enabled: true,
      label: "Summarize money state",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 25_000,
      retryAttempts: 0,
      temperature: 0.15,
      maxTokens: 900,
    },
    "summarize-week": {
      enabled: true,
      label: "Summarize week",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 25_000,
      retryAttempts: 0,
      temperature: 0.2,
      maxTokens: 850,
    },
    "summarize-decision": {
      enabled: true,
      label: "Summarize decision",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 25_000,
      retryAttempts: 0,
      temperature: 0.15,
      maxTokens: 700,
    },
    "summarize-decision-patterns": {
      enabled: true,
      label: "Summarize decision patterns",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 25_000,
      retryAttempts: 0,
      temperature: 0.15,
      maxTokens: 900,
    },
    "suggest-routine-focus": {
      enabled: true,
      label: "Suggest routine focus",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 20_000,
      retryAttempts: 0,
      temperature: 0.15,
      maxTokens: 600,
    },
    "generate-followup": {
      enabled: true,
      label: "Generate follow-up plan",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 20_000,
      retryAttempts: 0,
      temperature: 0.15,
      maxTokens: 500,
    },
    "generate-outreach": {
      enabled: true,
      label: "Generate outreach strategy",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 30_000,
      retryAttempts: 0,
      temperature: 0.2,
      maxTokens: 800,
    },
    "chat": {
      enabled: true,
      label: "AI assistant chat",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 30_000,
      retryAttempts: 0,
      temperature: 0.7,
      maxTokens: 500,
    },
    "tailor-cv": {
      enabled: true,
      label: "Auto-Tailor CV",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 45_000,
      retryAttempts: 0,
      temperature: 0.3,
      maxTokens: 800,
    },
    "linkedin-intro": {
      enabled: true,
      label: "LinkedIn intro generator",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 20_000,
      retryAttempts: 0,
      temperature: 0.7,
      maxTokens: 100,
    },
    "cover-letter": {
      enabled: true,
      label: "Cover letter generator",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 30_000,
      retryAttempts: 0,
      temperature: 0.4,
      maxTokens: 1_000,
    },
    "cv-optimize": {
      enabled: true,
      label: "CV optimizer (ATS)",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 40_000,
      retryAttempts: 0,
      temperature: 0.2,
      maxTokens: 2_000,
    },
    "interview-prep": {
      enabled: true,
      label: "Interview question generator",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 40_000,
      retryAttempts: 0,
      temperature: 0.4,
      maxTokens: 2_000,
    },
    "salary-lookup": {
      enabled: true,
      label: "Salary range lookup",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 15_000,
      retryAttempts: 0,
      temperature: 0.1,
      maxTokens: 300,
    },
    "skill-gap": {
      enabled: true,
      label: "Skill gap analyzer",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 30_000,
      retryAttempts: 0,
      temperature: 0.2,
      maxTokens: 1_200,
    },
    "extract-job-from-scrape": {
      enabled: true,
      label: "Extract job from scraped page",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 30_000,
      retryAttempts: 0,
      temperature: 0.1,
      maxTokens: 1_200,
    },
    "extract-job-list-from-scrape": {
      enabled: true,
      label: "Extract job list from scraped page",
      model: LOCAL_OLLAMA_MODEL,
      fallbackModel: null,
      timeoutMs: 30_000,
      retryAttempts: 0,
      temperature: 0.1,
      maxTokens: 2_000,
    },
  },
};

function normalizeBaseUrl(baseUrl?: string | null): string {
  return (baseUrl || DEFAULT_AI_CONFIG.baseUrl).trim().replace(/\/+$/, "");
}

const DEPRECATED_MODEL_MAP: Record<string, string> = {
  "gemini-1.5-flash": "gemini-2.0-flash",
  "gemini-1.5-flash-latest": "gemini-2.0-flash",
  "gemini-1.5-pro": "gemini-2.0-flash",
  "gemini-1.5-pro-latest": "gemini-2.0-flash",
};

function upgradeModel(model: string | null | undefined): string {
  if (!model) return DEFAULT_AI_CONFIG.model;
  return DEPRECATED_MODEL_MAP[model.trim()] ?? model.trim();
}

function mergeTaskSettings(
  overrides?: Partial<AIConfig["taskSettings"]>
): AIConfig["taskSettings"] {
  const merged = { ...DEFAULT_AI_CONFIG.taskSettings };

  for (const taskType of AI_TASK_ORDER) {
    const override: Partial<AIConfig["taskSettings"][AITaskType]> = overrides?.[taskType] ?? {};
    merged[taskType] = {
      ...DEFAULT_AI_CONFIG.taskSettings[taskType],
      ...override,
      model: upgradeModel(override.model ?? DEFAULT_AI_CONFIG.taskSettings[taskType].model),
      fallbackModel: override.fallbackModel !== undefined
        ? (override.fallbackModel ? upgradeModel(override.fallbackModel) : null)
        : DEFAULT_AI_CONFIG.taskSettings[taskType].fallbackModel,
    };
  }

  return merged;
}

function applyEnvOverrides(config: AIConfig): AIConfig {
  if (isLocalOnlyMode()) {
    const model = process.env.OLLAMA_MODEL || LOCAL_OLLAMA_MODEL;
    const baseUrl = normalizeBaseUrl(
      process.env.OLLAMA_BASE_URL || config.baseUrl || LOCAL_OLLAMA_BASE_URL
    );

    return {
      ...config,
      provider: "ollama",
      mode: "local",
      enabled: true,
      baseUrl,
      apiKey: null,
      compatibilityMode: "ollama",
      model,
      fallbackModel: null,
      taskSettings: Object.fromEntries(
        AI_TASK_ORDER.map((taskType) => {
          const task = config.taskSettings[taskType];
          const timeoutMs =
            typeof task.timeoutMs === "number" && task.timeoutMs > 0
              ? Math.min(task.timeoutMs, 120_000)
              : DEFAULT_AI_CONFIG.taskSettings[taskType].timeoutMs;
          return [
            taskType,
            {
              ...task,
              model,
              fallbackModel: null,
              timeoutMs,
            },
          ];
        })
      ) as AIConfig["taskSettings"],
    };
  }

  return {
    ...config,
    baseUrl: normalizeBaseUrl(process.env.OLLAMA_BASE_URL || config.baseUrl),
    apiKey: process.env.GEMINI_API_KEY || config.apiKey,
    model: process.env.OLLAMA_MODEL || process.env.GEMINI_MODEL || config.model,
    fallbackModel:
      process.env.OLLAMA_FALLBACK_MODEL || config.fallbackModel || null,
    compatibilityMode:
      (process.env.LOCAL_AI_COMPAT_MODE as AIConfig["compatibilityMode"]) ||
      config.compatibilityMode,
  };
}

function normalizeConfig(config?: Partial<AIConfig> | null): AIConfig {
  const merged: AIConfig = {
    ...DEFAULT_AI_CONFIG,
    ...config,
    baseUrl: normalizeBaseUrl(config?.baseUrl),
    apiKey: config?.apiKey ?? DEFAULT_AI_CONFIG.apiKey,
    compatibilityMode:
      config?.compatibilityMode || DEFAULT_AI_CONFIG.compatibilityMode,
    model: upgradeModel(config?.model) || DEFAULT_AI_CONFIG.model,
    fallbackModel: config?.fallbackModel
      ? upgradeModel(config.fallbackModel)
      : DEFAULT_AI_CONFIG.fallbackModel,
    taskSettings: mergeTaskSettings(config?.taskSettings),
  };

  return applyEnvOverrides(merged);
}

export async function loadAIConfig(): Promise<AIConfig> {
  const stored = await readObject<Partial<AIConfig>>(ConfigFiles.AI_CONFIG);
  return normalizeConfig(stored);
}

export async function saveAIConfig(
  updates: Partial<AIConfig>
): Promise<AIConfig> {
  const current = await loadAIConfig();
  const merged = normalizeConfig({
    ...current,
    ...updates,
    taskSettings: mergeTaskSettings({
      ...current.taskSettings,
      ...(updates.taskSettings || {}),
    }),
  });

  await writeObject(ConfigFiles.AI_CONFIG, merged);
  return merged;
}

export function getTaskConfig(
  config: AIConfig,
  taskType: AITaskType
): AIConfig["taskSettings"][AITaskType] {
  return config.taskSettings[taskType] || DEFAULT_AI_CONFIG.taskSettings[taskType];
}

export function getTaskRuntimeSettings(
  config: AIConfig,
  taskType: AITaskType
): {
  enabled: boolean;
  label: string;
  model: string;
  fallbackModel: string | null;
  timeoutMs: number;
  retryAttempts: number;
  temperature: number;
  maxTokens: number;
} {
  const taskConfig = getTaskConfig(config, taskType);

  return {
    enabled: taskConfig.enabled,
    label: taskConfig.label,
    model: taskConfig.model?.trim() || config.model,
    fallbackModel:
      taskConfig.fallbackModel === undefined
        ? config.fallbackModel
        : taskConfig.fallbackModel?.trim() || null,
    timeoutMs:
      typeof taskConfig.timeoutMs === "number" && taskConfig.timeoutMs > 0
        ? taskConfig.timeoutMs
        : config.timeoutMs,
    retryAttempts:
      typeof taskConfig.retryAttempts === "number" && taskConfig.retryAttempts >= 0
        ? taskConfig.retryAttempts
        : config.retryAttempts,
    temperature: taskConfig.temperature ?? config.temperature,
    maxTokens: taskConfig.maxTokens ?? config.maxTokens,
  };
}

export type { AIConfig };
