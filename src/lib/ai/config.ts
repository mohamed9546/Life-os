// ============================================================
// Centralized local AI runtime configuration.
// Persists to /data/ai-config.json with optional env overrides.
// ============================================================

import { readObject, writeObject, ConfigFiles } from "@/lib/storage";
import { AIConfig, AITaskType } from "@/types";

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
];

export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: "gemini",
  mode: "cloud",
  enabled: true,
  baseUrl: process.env.OLLAMA_BASE_URL || "",
  apiKey: process.env.GEMINI_API_KEY || null,
  compatibilityMode: "gemini", // Avoids Ollama health check crash
  model: "gemini-1.5-flash",
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
      model: "gemini-1.5-flash",
      fallbackModel: null,
      timeoutMs: 12_000,
      retryAttempts: 0,
      temperature: 0,
      maxTokens: 120,
    },
    "parse-job": {
      enabled: true,
      label: "Parse job posting",
      model: "gemini-1.5-flash",
      fallbackModel: null,
      timeoutMs: 35_000,
      retryAttempts: 0,
      temperature: 0.1,
      maxTokens: 600,
    },
    "evaluate-job": {
      enabled: true,
      label: "Evaluate job fit",
      model: "gemini-1.5-flash",
      fallbackModel: null,
      timeoutMs: 45_000,
      retryAttempts: 0,
      temperature: 0.1,
      maxTokens: 600,
    },
    "categorize-transaction": {
      enabled: true,
      label: "Categorize transaction",
      model: "gemini-1.5-flash",
      fallbackModel: null,
      timeoutMs: 20_000,
      retryAttempts: 0,
      temperature: 0.05,
      maxTokens: 320,
    },
    "extract-candidate-profile": {
      enabled: true,
      label: "Extract candidate profile",
      model: "gemini-1.5-flash",
      fallbackModel: null,
      timeoutMs: 35_000,
      retryAttempts: 0,
      temperature: 0.1,
      maxTokens: 1_200,
    },
    "summarize-money": {
      enabled: true,
      label: "Summarize money state",
      model: "gemini-1.5-flash",
      fallbackModel: null,
      timeoutMs: 25_000,
      retryAttempts: 0,
      temperature: 0.15,
      maxTokens: 900,
    },
    "summarize-week": {
      enabled: true,
      label: "Summarize week",
      model: "gemini-1.5-flash",
      fallbackModel: null,
      timeoutMs: 25_000,
      retryAttempts: 0,
      temperature: 0.2,
      maxTokens: 850,
    },
    "summarize-decision": {
      enabled: true,
      label: "Summarize decision",
      model: "gemini-1.5-flash",
      fallbackModel: null,
      timeoutMs: 25_000,
      retryAttempts: 0,
      temperature: 0.15,
      maxTokens: 700,
    },
    "summarize-decision-patterns": {
      enabled: true,
      label: "Summarize decision patterns",
      model: "gemini-1.5-flash",
      fallbackModel: null,
      timeoutMs: 25_000,
      retryAttempts: 0,
      temperature: 0.15,
      maxTokens: 900,
    },
    "suggest-routine-focus": {
      enabled: true,
      label: "Suggest routine focus",
      model: "gemini-1.5-flash",
      fallbackModel: null,
      timeoutMs: 20_000,
      retryAttempts: 0,
      temperature: 0.15,
      maxTokens: 600,
    },
    "generate-followup": {
      enabled: true,
      label: "Generate follow-up plan",
      model: "gemini-1.5-flash",
      fallbackModel: null,
      timeoutMs: 20_000,
      retryAttempts: 0,
      temperature: 0.15,
      maxTokens: 500,
    },
    "generate-outreach": {
      enabled: true,
      label: "Generate outreach strategy",
      model: "gemini-1.5-flash",
      fallbackModel: null,
      timeoutMs: 30_000,
      retryAttempts: 0,
      temperature: 0.2,
      maxTokens: 800,
    },
    "chat": {
      enabled: true,
      label: "AI assistant chat",
      model: "gemini-1.5-flash",
      fallbackModel: null,
      timeoutMs: 30_000,
      retryAttempts: 0,
      temperature: 0.7,
      maxTokens: 500,
    },
    "tailor-cv": {
      enabled: true,
      label: "Auto-Tailor CV",
      model: "gemini-1.5-flash",
      fallbackModel: null,
      timeoutMs: 45_000,
      retryAttempts: 0,
      temperature: 0.3,
      maxTokens: 800,
    },
    "linkedin-intro": {
      enabled: true,
      label: "LinkedIn intro generator",
      model: "gemini-1.5-flash",
      fallbackModel: null,
      timeoutMs: 20_000,
      retryAttempts: 0,
      temperature: 0.7,
      maxTokens: 100,
    },
  },
};

function normalizeBaseUrl(baseUrl?: string | null): string {
  return (baseUrl || DEFAULT_AI_CONFIG.baseUrl).trim().replace(/\/+$/, "");
}

function mergeTaskSettings(
  overrides?: Partial<AIConfig["taskSettings"]>
): AIConfig["taskSettings"] {
  const merged = { ...DEFAULT_AI_CONFIG.taskSettings };

  for (const taskType of AI_TASK_ORDER) {
    merged[taskType] = {
      ...DEFAULT_AI_CONFIG.taskSettings[taskType],
      ...(overrides?.[taskType] || {}),
    };
  }

  return merged;
}

function applyEnvOverrides(config: AIConfig): AIConfig {
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
    model: config?.model?.trim() || DEFAULT_AI_CONFIG.model,
    fallbackModel:
      config?.fallbackModel?.trim() || DEFAULT_AI_CONFIG.fallbackModel,
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
