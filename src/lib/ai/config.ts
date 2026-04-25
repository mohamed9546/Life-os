// ============================================================
// Centralized local AI runtime configuration.
// Persists to /data/ai-config.json with optional env overrides.
// ============================================================

import { readObject, writeObject, ConfigFiles } from "@/lib/storage";
import { AIConfig, AITaskType } from "@/types";
import { isLocalOnlyMode } from "@/lib/env/local-only";
import { existsSync, readFileSync } from "fs";
import path from "path";

const LOCAL_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const LOCAL_OLLAMA_MODEL = "qwen3.5:2b";
const DEFAULT_PRIMARY_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_SECONDARY_BASE_URL = "https://openrouter.ai/api";
const DEFAULT_SECONDARY_MODEL = "qwen/qwen3-next-80b-a3b-instruct:free";
const DEFAULT_SECONDARY_FALLBACK_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

function truthy(value?: string | null): boolean {
  return ["1", "true", "yes", "on"].includes((value || "").trim().toLowerCase());
}

function readSecretFromEnvFile(names: string[]): string | null {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return null;
  }

  const content = readFileSync(envPath, "utf8");
  for (const name of names) {
    const match = content.match(new RegExp(`^${name}=([^\r\n]+)$`, "mi"));
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function readGeminiApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.Gemini_API_KEY ||
    process.env.Gemini_API_KEY_paid ||
    readSecretFromEnvFile(["GEMINI_API_KEY", "Gemini_API_KEY", "Gemini_API_KEY_paid"]) ||
    null
  );
}

function readOpenRouterApiKey(): string | null {
  return (
    process.env.OPENROUTER_API_KEY ||
    readSecretFromEnvFile(["OPENROUTER_API_KEY"]) ||
    null
  );
}

function shouldAllowCloudAIInLocal(config: AIConfig): boolean {
  return (
    Boolean(config.allowCloudInLocalMode) ||
    truthy(process.env.LIFE_OS_ALLOW_CLOUD_AI_IN_LOCAL) ||
    truthy(process.env.NEXT_PUBLIC_LIFE_OS_ALLOW_CLOUD_AI_IN_LOCAL)
  );
}

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
  provider: "gemini",
  mode: "cloud",
  enabled: true,
  baseUrl: DEFAULT_GEMINI_BASE_URL,
  apiKey: null,
  compatibilityMode: "gemini",
  model: DEFAULT_PRIMARY_MODEL,
  fallbackModel: null,
  monthlyBudgetGbp: 5,
  estimatedSpendGbp: 0,
  allowCloudInLocalMode: true,
  logPromptPreviews: false,
  hasPrimaryApiKey: false,
  secondaryRuntime: {
    enabled: true,
    provider: "openrouter",
    mode: "cloud",
    baseUrl: DEFAULT_SECONDARY_BASE_URL,
    compatibilityMode: "openai",
    model: DEFAULT_SECONDARY_MODEL,
    fallbackModel: DEFAULT_SECONDARY_FALLBACK_MODEL,
  },
  hasSecondaryApiKey: false,
  timeoutMs: 45_000,
  temperature: 0.15,
  maxTokens: 1_200,
  retryAttempts: 1,
  retryDelayMs: 1_500,
  maxCallsPerDay: 25,
  maxCallsPerTaskType: 12,
  taskSettings: {
    "health-test": {
      enabled: true,
      label: "Health test",
      model: DEFAULT_PRIMARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "primary",
      allowSecondaryFallback: true,
      timeoutMs: 12_000,
      retryAttempts: 0,
      temperature: 0,
      maxTokens: 120,
    },
    "parse-job": {
      enabled: true,
      label: "Parse job posting",
      model: DEFAULT_PRIMARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "primary",
      allowSecondaryFallback: true,
      timeoutMs: 35_000,
      retryAttempts: 0,
      temperature: 0.1,
      maxTokens: 600,
    },
    "evaluate-job": {
      enabled: true,
      label: "Evaluate job fit",
      model: DEFAULT_PRIMARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "primary",
      allowSecondaryFallback: true,
      timeoutMs: 45_000,
      retryAttempts: 0,
      temperature: 0.1,
      maxTokens: 600,
    },
    "categorize-transaction": {
      enabled: true,
      label: "Categorize transaction",
      model: DEFAULT_PRIMARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "primary",
      allowSecondaryFallback: true,
      timeoutMs: 20_000,
      retryAttempts: 0,
      temperature: 0.05,
      maxTokens: 320,
    },
    "extract-candidate-profile": {
      enabled: true,
      label: "Extract candidate profile",
      model: DEFAULT_PRIMARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "primary",
      allowSecondaryFallback: true,
      timeoutMs: 35_000,
      retryAttempts: 0,
      temperature: 0.1,
      maxTokens: 1_200,
    },
    "summarize-money": {
      enabled: true,
      label: "Summarize money state",
      model: DEFAULT_SECONDARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "secondary",
      allowSecondaryFallback: false,
      timeoutMs: 25_000,
      retryAttempts: 0,
      temperature: 0.15,
      maxTokens: 900,
    },
    "summarize-week": {
      enabled: true,
      label: "Summarize week",
      model: DEFAULT_SECONDARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "secondary",
      allowSecondaryFallback: false,
      timeoutMs: 25_000,
      retryAttempts: 0,
      temperature: 0.2,
      maxTokens: 850,
    },
    "summarize-decision": {
      enabled: true,
      label: "Summarize decision",
      model: DEFAULT_SECONDARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "secondary",
      allowSecondaryFallback: false,
      timeoutMs: 25_000,
      retryAttempts: 0,
      temperature: 0.15,
      maxTokens: 700,
    },
    "summarize-decision-patterns": {
      enabled: true,
      label: "Summarize decision patterns",
      model: DEFAULT_SECONDARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "secondary",
      allowSecondaryFallback: false,
      timeoutMs: 25_000,
      retryAttempts: 0,
      temperature: 0.15,
      maxTokens: 900,
    },
    "suggest-routine-focus": {
      enabled: true,
      label: "Suggest routine focus",
      model: DEFAULT_PRIMARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "primary",
      allowSecondaryFallback: true,
      timeoutMs: 20_000,
      retryAttempts: 0,
      temperature: 0.15,
      maxTokens: 600,
    },
    "generate-followup": {
      enabled: true,
      label: "Generate follow-up plan",
      model: DEFAULT_PRIMARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "primary",
      allowSecondaryFallback: true,
      timeoutMs: 20_000,
      retryAttempts: 0,
      temperature: 0.15,
      maxTokens: 500,
    },
    "generate-outreach": {
      enabled: true,
      label: "Generate outreach strategy",
      model: DEFAULT_SECONDARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "secondary",
      allowSecondaryFallback: false,
      timeoutMs: 30_000,
      retryAttempts: 0,
      temperature: 0.2,
      maxTokens: 800,
    },
    "chat": {
      enabled: true,
      label: "AI assistant chat",
      model: DEFAULT_SECONDARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "secondary",
      allowSecondaryFallback: false,
      timeoutMs: 30_000,
      retryAttempts: 0,
      temperature: 0.7,
      maxTokens: 500,
    },
    "tailor-cv": {
      enabled: true,
      label: "Auto-Tailor CV",
      model: DEFAULT_PRIMARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "primary",
      allowSecondaryFallback: true,
      timeoutMs: 45_000,
      retryAttempts: 0,
      temperature: 0.3,
      maxTokens: 800,
    },
    "linkedin-intro": {
      enabled: true,
      label: "LinkedIn intro generator",
      model: DEFAULT_SECONDARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "secondary",
      allowSecondaryFallback: false,
      dailyLimitOverride: 2,
      timeoutMs: 20_000,
      retryAttempts: 0,
      temperature: 0.7,
      maxTokens: 100,
    },
    "cover-letter": {
      enabled: true,
      label: "Cover letter generator",
      model: DEFAULT_SECONDARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "secondary",
      allowSecondaryFallback: false,
      dailyLimitOverride: 1,
      timeoutMs: 30_000,
      retryAttempts: 0,
      temperature: 0.4,
      maxTokens: 1_000,
    },
    "cv-optimize": {
      enabled: true,
      label: "CV optimizer (ATS)",
      model: DEFAULT_SECONDARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "secondary",
      allowSecondaryFallback: false,
      dailyLimitOverride: 1,
      timeoutMs: 40_000,
      retryAttempts: 0,
      temperature: 0.2,
      maxTokens: 2_000,
    },
    "interview-prep": {
      enabled: true,
      label: "Interview question generator",
      model: DEFAULT_SECONDARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "secondary",
      allowSecondaryFallback: false,
      timeoutMs: 40_000,
      retryAttempts: 0,
      temperature: 0.4,
      maxTokens: 2_000,
    },
    "salary-lookup": {
      enabled: true,
      label: "Salary range lookup",
      model: DEFAULT_PRIMARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "primary",
      allowSecondaryFallback: true,
      timeoutMs: 15_000,
      retryAttempts: 0,
      temperature: 0.1,
      maxTokens: 300,
    },
    "skill-gap": {
      enabled: true,
      label: "Skill gap analyzer",
      model: DEFAULT_PRIMARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "primary",
      allowSecondaryFallback: true,
      timeoutMs: 30_000,
      retryAttempts: 0,
      temperature: 0.2,
      maxTokens: 1_200,
    },
    "extract-job-from-scrape": {
      enabled: true,
      label: "Extract job from scraped page",
      model: DEFAULT_PRIMARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "primary",
      allowSecondaryFallback: true,
      timeoutMs: 30_000,
      retryAttempts: 0,
      temperature: 0.1,
      maxTokens: 1_200,
    },
    "extract-job-list-from-scrape": {
      enabled: true,
      label: "Extract job list from scraped page",
      model: DEFAULT_PRIMARY_MODEL,
      fallbackModel: null,
      preferredRuntime: "primary",
      allowSecondaryFallback: true,
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

function sanitizeConfigForStorage(config: AIConfig): Partial<AIConfig> {
  return {
    ...config,
    apiKey: null,
    estimatedSpendGbp: undefined,
    hasPrimaryApiKey: undefined,
    hasSecondaryApiKey: undefined,
  };
}

const DEPRECATED_MODEL_MAP: Record<string, string> = {
  "gemini-1.5-flash": "gemini-2.5-flash-lite",
  "gemini-1.5-flash-latest": "gemini-2.5-flash-lite",
  "gemini-1.5-pro": "gemini-2.5-flash-lite",
  "gemini-1.5-pro-latest": "gemini-2.5-flash-lite",
  "gemini-2.0-flash": "gemini-2.5-flash-lite",
  "gemini-2.0-flash-001": "gemini-2.5-flash-lite",
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

function isLegacyLocalAiConfig(config: AIConfig): boolean {
  return (
    config.provider === "ollama" &&
    config.compatibilityMode === "ollama" &&
    config.model === LOCAL_OLLAMA_MODEL
  );
}

function migrateLegacyTaskSettings(
  taskSettings?: Partial<AIConfig["taskSettings"]>
): Partial<AIConfig["taskSettings"]> {
  const migrated: Partial<AIConfig["taskSettings"]> = {};

  for (const taskType of AI_TASK_ORDER) {
    const current = taskSettings?.[taskType];
    if (!current) {
      continue;
    }

    migrated[taskType] = {
      ...DEFAULT_AI_CONFIG.taskSettings[taskType],
      enabled: current.enabled ?? DEFAULT_AI_CONFIG.taskSettings[taskType].enabled,
      timeoutMs: current.timeoutMs ?? DEFAULT_AI_CONFIG.taskSettings[taskType].timeoutMs,
      retryAttempts:
        current.retryAttempts ?? DEFAULT_AI_CONFIG.taskSettings[taskType].retryAttempts,
      temperature: current.temperature ?? DEFAULT_AI_CONFIG.taskSettings[taskType].temperature,
      maxTokens: current.maxTokens ?? DEFAULT_AI_CONFIG.taskSettings[taskType].maxTokens,
      dailyLimitOverride:
        current.dailyLimitOverride ?? DEFAULT_AI_CONFIG.taskSettings[taskType].dailyLimitOverride,
      allowSecondaryFallback:
        current.allowSecondaryFallback ?? DEFAULT_AI_CONFIG.taskSettings[taskType].allowSecondaryFallback,
    };
  }

  return migrated;
}

// Process-level latch so we only log the gemini->ollama override warning
// once per Next.js dev/prod boot instead of on every config load.
let warnedGeminiOverride = false;

function applyEnvOverrides(config: AIConfig): AIConfig {
  if (isLocalOnlyMode() && !shouldAllowCloudAIInLocal(config)) {
    const model = (process.env.OLLAMA_MODEL || LOCAL_OLLAMA_MODEL).trim();
    const baseUrl = normalizeBaseUrl(
      process.env.OLLAMA_BASE_URL || config.baseUrl || LOCAL_OLLAMA_BASE_URL
    );

    // If a stored config from a previous (cloud) boot is still on disk
    // with provider/compat=gemini, surface the override in the dev log
    // exactly once so the regression is visible if it ever recurs.
    const storedNonOllama =
      config.provider !== "ollama" || config.compatibilityMode !== "ollama";
    if (storedNonOllama && !warnedGeminiOverride) {
      warnedGeminiOverride = true;
      console.warn(
        `[ai/config] LIFE_OS_LOCAL_ONLY=true: overriding stored provider=${config.provider}, ` +
          `compatibilityMode=${config.compatibilityMode} -> ollama. ` +
          `Resave the config from Settings to clear this warning.`
      );
    }

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
        hasPrimaryApiKey: false,
        hasSecondaryApiKey: Boolean(readOpenRouterApiKey()),
        taskSettings: Object.fromEntries(
          AI_TASK_ORDER.map((taskType) => {
            const task = config.taskSettings[taskType];
          const configuredTimeoutMs =
            typeof task.timeoutMs === "number" && task.timeoutMs > 0
              ? Math.min(task.timeoutMs, 120_000)
              : DEFAULT_AI_CONFIG.taskSettings[taskType].timeoutMs ?? config.timeoutMs;
          const timeoutMs =
            taskType === "extract-candidate-profile"
              ? Math.max(configuredTimeoutMs, 120_000)
              : configuredTimeoutMs;
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

  const geminiApiKey = readGeminiApiKey();
  const openRouterApiKey = readOpenRouterApiKey();
  const primaryProvider = config.provider;
  const primaryMode = primaryProvider === "ollama" ? "local" : "cloud";
  const primaryBaseUrl =
    primaryProvider === "ollama"
      ? normalizeBaseUrl(process.env.OLLAMA_BASE_URL || config.baseUrl || LOCAL_OLLAMA_BASE_URL)
      : primaryProvider === "openrouter"
        ? normalizeBaseUrl(process.env.OPENROUTER_BASE_URL || config.baseUrl || DEFAULT_SECONDARY_BASE_URL)
        : DEFAULT_GEMINI_BASE_URL;
  const primaryModel =
    primaryProvider === "ollama"
      ? process.env.OLLAMA_MODEL || config.model
      : primaryProvider === "openrouter"
        ? process.env.OPENROUTER_MODEL || config.model
        : process.env.GEMINI_MODEL || config.model;
  const primaryCompatibilityMode =
    primaryProvider === "gemini"
      ? "gemini"
      : primaryProvider === "openrouter"
        ? "openai"
        : ((process.env.LOCAL_AI_COMPAT_MODE as AIConfig["compatibilityMode"]) ||
          config.compatibilityMode ||
          "ollama");
  const primaryApiKey =
    primaryProvider === "gemini"
      ? geminiApiKey
      : primaryProvider === "openrouter"
        ? openRouterApiKey
        : null;
  const secondaryBaseUrl = normalizeBaseUrl(
    process.env.OPENROUTER_BASE_URL || config.secondaryRuntime.baseUrl || DEFAULT_SECONDARY_BASE_URL
  );
  const secondaryModel = process.env.OPENROUTER_MODEL || config.secondaryRuntime.model;

  return {
    ...config,
    mode: primaryMode,
    baseUrl: primaryBaseUrl,
    apiKey: primaryApiKey,
    compatibilityMode: primaryCompatibilityMode,
    model: upgradeModel(primaryModel),
    fallbackModel: config.fallbackModel ? upgradeModel(config.fallbackModel) : null,
    hasPrimaryApiKey: Boolean(primaryApiKey),
    hasSecondaryApiKey: Boolean(openRouterApiKey),
    secondaryRuntime: {
      ...config.secondaryRuntime,
      mode: "cloud",
      provider: "openrouter",
      compatibilityMode: "openai",
      baseUrl: secondaryBaseUrl,
      model: upgradeModel(secondaryModel),
      fallbackModel: config.secondaryRuntime.fallbackModel
        ? upgradeModel(config.secondaryRuntime.fallbackModel)
        : DEFAULT_SECONDARY_FALLBACK_MODEL,
      enabled: Boolean(config.secondaryRuntime.enabled),
    },
  };
}

function normalizeConfig(config?: Partial<AIConfig> | null): AIConfig {
  let merged: AIConfig = {
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
    monthlyBudgetGbp:
      typeof config?.monthlyBudgetGbp === "number"
        ? config.monthlyBudgetGbp
        : DEFAULT_AI_CONFIG.monthlyBudgetGbp,
    estimatedSpendGbp:
      typeof config?.estimatedSpendGbp === "number"
        ? config.estimatedSpendGbp
        : DEFAULT_AI_CONFIG.estimatedSpendGbp,
    allowCloudInLocalMode:
      config?.allowCloudInLocalMode ?? DEFAULT_AI_CONFIG.allowCloudInLocalMode,
    logPromptPreviews:
      config?.logPromptPreviews ?? DEFAULT_AI_CONFIG.logPromptPreviews,
    secondaryRuntime: {
      ...DEFAULT_AI_CONFIG.secondaryRuntime,
      ...(config?.secondaryRuntime || {}),
      baseUrl: normalizeBaseUrl(config?.secondaryRuntime?.baseUrl || DEFAULT_AI_CONFIG.secondaryRuntime.baseUrl),
      compatibilityMode:
        config?.secondaryRuntime?.compatibilityMode || DEFAULT_AI_CONFIG.secondaryRuntime.compatibilityMode,
      model:
        upgradeModel(config?.secondaryRuntime?.model) || DEFAULT_AI_CONFIG.secondaryRuntime.model,
      fallbackModel: config?.secondaryRuntime?.fallbackModel
        ? upgradeModel(config.secondaryRuntime.fallbackModel)
        : DEFAULT_AI_CONFIG.secondaryRuntime.fallbackModel,
    },
    taskSettings: mergeTaskSettings(config?.taskSettings),
  };

  if (shouldAllowCloudAIInLocal(merged) && isLegacyLocalAiConfig(merged)) {
    merged = {
      ...merged,
      provider: "gemini",
      mode: "cloud",
      baseUrl: DEFAULT_GEMINI_BASE_URL,
      compatibilityMode: "gemini",
      model: DEFAULT_PRIMARY_MODEL,
      fallbackModel: null,
      taskSettings: mergeTaskSettings(migrateLegacyTaskSettings(config?.taskSettings)),
      secondaryRuntime: {
        ...DEFAULT_AI_CONFIG.secondaryRuntime,
      },
    };
  }

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

  await writeObject(ConfigFiles.AI_CONFIG, sanitizeConfigForStorage(merged));
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
  preferredRuntime: "primary" | "secondary";
  dailyLimitOverride: number | null;
  allowSecondaryFallback: boolean;
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
    preferredRuntime: taskConfig.preferredRuntime || "primary",
    dailyLimitOverride:
      typeof taskConfig.dailyLimitOverride === "number" && taskConfig.dailyLimitOverride > 0
        ? taskConfig.dailyLimitOverride
        : null,
    allowSecondaryFallback: taskConfig.allowSecondaryFallback !== false,
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
