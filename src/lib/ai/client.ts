// ============================================================
// Core AI client for the local AI runtime.
// Defaults to Ollama and supports OpenAI/Anthropic-compatible
// endpoint modes for local tooling compatibility.
// ============================================================

import {
  AIMetadata,
  AIFailureKind,
  AICompatibilityMode,
  AIConfig,
  AIHealthStatus,
  AITaskType,
} from "@/types";
import {
  loadAIConfig,
  getTaskRuntimeSettings,
  AI_TASK_ORDER,
} from "./config";
import { checkAIRateLimit, getAIUsageStats, recordAICall } from "./rate-limiter";
import { appendToCollection, Collections } from "@/lib/storage";
import {
  classifyTelemetryErrorType,
  recordAiTelemetryEvent,
  summarizeAiRuntimeErrorForLogs,
} from "./telemetry";

function isUsageLimitReason(reason?: string): boolean {
  return Boolean(
    reason &&
      (/Monthly AI budget reached/i.test(reason) ||
        /Daily AI call limit reached/i.test(reason) ||
        /Task type ".*" limit reached/i.test(reason))
  );
}

type AIRuntimeCandidate = {
  target: "primary" | "secondary";
  provider: AIConfig["provider"];
  mode: AIConfig["mode"];
  enabled: boolean;
  baseUrl: string;
  apiKey?: string | null;
  compatibilityMode: AIConfig["compatibilityMode"];
  model: string;
  fallbackModel: string | null;
};

const GEMINI_PRICING_GBP_PER_MILLION_TOKENS = {
  input: 0.4,
  output: 1.2,
};

export interface AICallOptions {
  taskType: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  rawInput?: unknown;
  skipRateLimit?: boolean;
  callingModule?: string;
  sensitivityLevel?: string;
  /** Skip JSON format enforcement and return raw text. Use for chat/free-text tasks. */
  rawTextOutput?: boolean;
}

export interface AICallResult<T = unknown> {
  success: boolean;
  data?: T;
  meta?: AIMetadata;
  error?: string;
  rawOutput?: string;
  failureKind?: AIFailureKind;
  attemptCount?: number;
  fallbackAttempted?: boolean;
  effectiveTimeoutMs?: number;
}

interface AILogEntry {
  timestamp: string;
  taskType: string;
  model: string;
  success: boolean;
  durationMs: number;
  inputBytes: number;
  outputBytes: number;
  fallbackUsed: boolean;
  fallbackAttempted: boolean;
  attemptCount: number;
  effectiveTimeoutMs: number;
  jsonExtractionFallback?: boolean;
  failureKind?: AIFailureKind;
  error?: string;
  inputPreview?: string;
}

async function logAICall(entry: AILogEntry): Promise<void> {
  try {
    await appendToCollection(Collections.AI_LOG, [entry]);
  } catch (err) {
    console.error("[ai-client] Failed to write AI log:", err);
  }
}

async function safeRecordAiTelemetryEvent(
  input: Parameters<typeof recordAiTelemetryEvent>[0]
): Promise<void> {
  try {
    await recordAiTelemetryEvent(input);
  } catch (err) {
    console.warn("[ai-client] Failed to write AI telemetry:", err);
  }
}

function estimateTokensFromText(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

function estimateCostGbp(input: {
  provider: AIConfig["provider"];
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  inputBytes: number;
  rawOutput: string;
}): number {
  if (input.provider !== "gemini") {
    return 0;
  }

  const promptTokens =
    typeof input.promptTokens === "number"
      ? input.promptTokens
      : estimateTokensFromText("x".repeat(input.inputBytes));
  const completionTokens =
    typeof input.completionTokens === "number"
      ? input.completionTokens
      : estimateTokensFromText(input.rawOutput);

  const cost =
    (promptTokens / 1_000_000) * GEMINI_PRICING_GBP_PER_MILLION_TOKENS.input +
    (completionTokens / 1_000_000) * GEMINI_PRICING_GBP_PER_MILLION_TOKENS.output;

  return Math.max(0, Number(cost.toFixed(6)));
}

function buildPrimaryRuntime(config: AIConfig): AIRuntimeCandidate {
  return {
    target: "primary",
    provider: config.provider,
    mode: config.mode,
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    compatibilityMode: config.compatibilityMode,
    model: config.model,
    fallbackModel: config.fallbackModel,
  };
}

function buildSecondaryRuntime(config: AIConfig): AIRuntimeCandidate {
  return {
    target: "secondary",
    provider: config.secondaryRuntime.provider,
    mode: config.secondaryRuntime.mode,
    enabled: config.secondaryRuntime.enabled && Boolean(config.hasSecondaryApiKey),
    baseUrl: config.secondaryRuntime.baseUrl,
    apiKey: process.env.OPENROUTER_API_KEY || null,
    compatibilityMode: config.secondaryRuntime.compatibilityMode,
    model: config.secondaryRuntime.model,
    fallbackModel: config.secondaryRuntime.fallbackModel,
  };
}

function buildRuntimeCandidates(
  config: AIConfig,
  taskConfig: ReturnType<typeof getTaskRuntimeSettings>,
  monthlyBudgetReached: boolean
): AIRuntimeCandidate[] {
  const primary = buildPrimaryRuntime(config);
  const secondary = buildSecondaryRuntime(config);

  if (taskConfig.preferredRuntime === "secondary") {
    return secondary.enabled ? [secondary] : [];
  }

  if (monthlyBudgetReached && taskConfig.allowSecondaryFallback && secondary.enabled) {
    return [secondary];
  }

  const candidates = [primary];
  if (taskConfig.allowSecondaryFallback && secondary.enabled) {
    candidates.push(secondary);
  }
  return candidates.filter((candidate) => candidate.enabled);
}

function resolveModelsForRuntime(
  config: AIConfig,
  taskConfig: ReturnType<typeof getTaskRuntimeSettings>,
  runtime: AIRuntimeCandidate
) {
  if (runtime.target === "secondary") {
    if (taskConfig.preferredRuntime === "secondary") {
      return {
        model: taskConfig.model,
        fallbackModel: taskConfig.fallbackModel ?? config.secondaryRuntime.fallbackModel,
      };
    }

    return {
      model: config.secondaryRuntime.model,
      fallbackModel: config.secondaryRuntime.fallbackModel,
    };
  }

  return {
    model: taskConfig.model,
    fallbackModel: taskConfig.fallbackModel,
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    if (
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      const timeoutError = new Error(
        `Request timed out after ${timeoutMs}ms`
      ) as Error & { code?: string };
      timeoutError.name = "AIRequestTimeoutError";
      timeoutError.code = "AI_TIMEOUT";
      throw timeoutError;
    }

    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getSerializedInput(rawInput: unknown): string {
  if (typeof rawInput === "string") {
    return rawInput;
  }

  try {
    return JSON.stringify(rawInput ?? "");
  } catch {
    return String(rawInput ?? "");
  }
}

function getByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function extractJSON(raw: string): {
  parsed: unknown;
  jsonExtractionFallback: boolean;
} {
  const trimmed = raw.trim();

  try {
    return {
      parsed: JSON.parse(trimmed),
      jsonExtractionFallback: false,
    };
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenced) {
      return {
        parsed: JSON.parse(fenced[1]),
        jsonExtractionFallback: true,
      };
    }

    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return {
        parsed: JSON.parse(objectMatch[0]),
        jsonExtractionFallback: true,
      };
    }
  }

  const invalidJsonError = new Error(
    "Could not extract valid JSON from AI response"
  ) as Error & { code?: string };
  invalidJsonError.name = "AIInvalidJsonError";
  invalidJsonError.code = "AI_INVALID_JSON";
  throw invalidJsonError;
}

function classifyAIError(err: unknown): AIFailureKind {
  if (
    (err instanceof Error && err.name === "AIRequestTimeoutError") ||
    (err instanceof Error && "code" in err && err.code === "AI_TIMEOUT")
  ) {
    return "timeout";
  }

  if (
    (err instanceof Error && err.name === "AIInvalidJsonError") ||
    (err instanceof Error && "code" in err && err.code === "AI_INVALID_JSON")
  ) {
    return "invalid_json";
  }

  const message = err instanceof Error ? err.message : String(err ?? "");
  if (/429|rate.?limit|too many requests|free-models-per-day|quota/i.test(message)) {
    return "rate_limited";
  }

  return "runtime_error";
}

function isOpenRouterFreeModel(model: string): boolean {
  return /:free$/i.test(model.trim());
}

function shouldSkipRemainingOpenRouterFreeModels(input: {
  runtime: AIRuntimeCandidate;
  model: string;
  failureKind: AIFailureKind;
  errorMessage: string;
}): boolean {
  return (
    input.runtime.provider === "openrouter" &&
    isOpenRouterFreeModel(input.model) &&
    (input.failureKind === "rate_limited" ||
      /429|rate.?limit|too many requests|free-models-per-day|quota/i.test(input.errorMessage))
  );
}

async function callRuntime(
  runtime: AIRuntimeCandidate,
  model: string,
  options: AICallOptions,
  temperature: number,
  maxTokens: number,
  timeoutMs: number
): Promise<{
  parsed: unknown;
  rawOutput: string;
  durationMs: number;
  model: string;
  jsonExtractionFallback: boolean;
  promptTokens?: number;
  completionTokens?: number;
}> {
  const rawText = Boolean(options.rawTextOutput);
  const startedAt = Date.now();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (runtime.apiKey) {
    headers.Authorization = `Bearer ${runtime.apiKey}`;
  }

  let response: Response;

  if (runtime.provider === "gemini") {
    if (!runtime.apiKey) {
      throw new Error("GEMINI_API_KEY is required for Gemini provider");
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${runtime.apiKey}`;
    response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: options.systemPrompt ? { parts: [{ text: options.systemPrompt }] } : undefined,
          contents: [{ role: "user", parts: [{ text: options.prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: rawText ? "text/plain" : "application/json",
          }
        }),
      },
      timeoutMs
    );
  } else {
    switch (runtime.compatibilityMode) {
    case "ollama": {
      const prompt = options.systemPrompt
        ? `${options.systemPrompt}\n\n${options.prompt}`
        : options.prompt;

      response = await fetchWithTimeout(
        `${runtime.baseUrl}/api/generate`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            prompt,
            stream: false,
            ...(rawText ? {} : { format: "json" }),
            options: {
              temperature,
              num_predict: maxTokens,
            },
          }),
        },
        timeoutMs
      );
      break;
    }
    case "openai": {
      response = await fetchWithTimeout(
        `${runtime.baseUrl}/v1/chat/completions`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            temperature,
            max_tokens: maxTokens,
            ...(rawText ? {} : { response_format: { type: "json_object" } }),
            messages: [
              ...(options.systemPrompt
                ? [{ role: "system", content: options.systemPrompt }]
                : []),
              { role: "user", content: options.prompt },
            ],
          }),
        },
        timeoutMs
      );
      break;
    }
    case "anthropic": {
      const anthropicHeaders = {
        ...headers,
        "anthropic-version": "2023-06-01",
        ...(runtime.apiKey ? { "x-api-key": runtime.apiKey } : {}),
      };

      response = await fetchWithTimeout(
        `${runtime.baseUrl}/v1/messages`,
        {
          method: "POST",
          headers: anthropicHeaders,
          body: JSON.stringify({
            model,
            temperature,
            max_tokens: maxTokens,
            system: options.systemPrompt,
            messages: [{ role: "user", content: options.prompt }],
          }),
        },
        timeoutMs
      );
      break;
    }
    default:
        throw new Error(`Unsupported AI compatibility mode: ${runtime.compatibilityMode}`);
    }
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`AI runtime returned ${response.status}: ${errorText}`);
  }

  const durationMs = Date.now() - startedAt;
  const payload = await response.json().catch(async () => await response.text());

  if (typeof payload === "string") {
    if (rawText) {
      return { parsed: payload, rawOutput: payload, durationMs, model, jsonExtractionFallback: false };
    }
    const extracted = extractJSON(payload);
    return {
      parsed: extracted.parsed,
      rawOutput: payload,
      durationMs,
      model,
      jsonExtractionFallback: extracted.jsonExtractionFallback,
    };
  }

  if (runtime.provider === "gemini") {
    const usage = payload.usageMetadata || {};
    const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    const rawOutput = typeof content === "string" ? content : JSON.stringify(payload);
    if (rawText) {
      return {
        parsed: rawOutput,
        rawOutput,
        durationMs,
        model,
        jsonExtractionFallback: false,
        promptTokens: usage.promptTokenCount,
        completionTokens: usage.candidatesTokenCount,
      };
    }
    const extracted = extractJSON(rawOutput);
    return {
      parsed: extracted.parsed,
      rawOutput,
      durationMs,
      model,
      jsonExtractionFallback: extracted.jsonExtractionFallback,
      promptTokens: usage.promptTokenCount,
      completionTokens: usage.candidatesTokenCount,
    };
  }

  switch (runtime.compatibilityMode) {
    case "ollama": {
      const rawOutput =
        typeof payload.response === "string" && payload.response.length > 0
          ? payload.response
          : typeof payload.thinking === "string"
          ? payload.thinking
          : JSON.stringify(payload);
      if (rawText) {
        return { parsed: rawOutput, rawOutput, durationMs, model: payload.model || model, jsonExtractionFallback: false };
      }
      const extracted = extractJSON(rawOutput);
      return {
        parsed: extracted.parsed,
        rawOutput,
        durationMs,
        model: payload.model || model,
        jsonExtractionFallback: extracted.jsonExtractionFallback,
      };
    }
    case "openai": {
      const content = payload.choices?.[0]?.message?.content;
      const usage = payload.usage || {};
      const rawOutput =
        typeof content === "string" ? content : JSON.stringify(payload);
      if (rawText) {
        return {
          parsed: rawOutput,
          rawOutput,
          durationMs,
          model: payload.model || model,
          jsonExtractionFallback: false,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
        };
      }
      const extracted = extractJSON(rawOutput);
      return {
        parsed: extracted.parsed,
        rawOutput,
        durationMs,
        model: payload.model || model,
        jsonExtractionFallback: extracted.jsonExtractionFallback,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
      };
    }
    case "anthropic": {
      const contentBlocks = Array.isArray(payload.content) ? payload.content : [];
      const textBlock = contentBlocks.find(
        (block: { type?: string; text?: string }) =>
          block?.type === "text" && typeof block.text === "string"
      );
      const rawOutput =
        typeof textBlock?.text === "string"
          ? textBlock.text
          : JSON.stringify(payload);
      if (rawText) {
        return { parsed: rawOutput, rawOutput, durationMs, model: payload.model || model, jsonExtractionFallback: false };
      }
      const extracted = extractJSON(rawOutput);
      return {
        parsed: extracted.parsed,
        rawOutput,
        durationMs,
        model: payload.model || model,
        jsonExtractionFallback: extracted.jsonExtractionFallback,
      };
    }
    default:
      throw new Error(`Unsupported AI compatibility mode: ${runtime.compatibilityMode}`);
  }
}

export async function callAI<T = unknown>(
  options: AICallOptions
): Promise<AICallResult<T>> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const config = await loadAIConfig();
  const taskType = options.taskType as AITaskType;
  const taskConfig = getTaskRuntimeSettings(config, taskType);
  const taskName = taskConfig.label || options.taskType;
  const temperature = options.temperature ?? taskConfig.temperature;
  const maxTokens = options.maxTokens ?? taskConfig.maxTokens;
  const effectiveTimeoutMs = taskConfig.timeoutMs;
  const serializedInput = getSerializedInput(options.rawInput ?? options.prompt);
  const inputBytes = getByteLength(serializedInput);
  let forcedSecondaryRoute = false;

  const recordEarlyFailure = async (input: {
    error: string;
    failureKind: AIFailureKind;
    runtimeRoute?: string;
    provider?: string | null;
    model?: string | null;
    localOrCloud?: "local" | "cloud" | "unknown";
    fallbackUsed?: boolean;
    fallbackReason?: string | null;
  }) => {
    await safeRecordAiTelemetryEvent({
      taskName,
      taskType: options.taskType,
      callingModule: options.callingModule ?? null,
      provider: input.provider ?? config.provider,
      model: input.model ?? taskConfig.model ?? config.model,
      runtimeRoute: input.runtimeRoute ?? "unavailable",
      localOrCloud: input.localOrCloud ?? (config.mode === "local" ? "local" : config.mode === "cloud" ? "cloud" : "unknown"),
      sensitivityLevel: options.sensitivityLevel ?? null,
      startedAt,
      completedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAtMs,
      success: false,
      errorType: classifyTelemetryErrorType({ failureKind: input.failureKind, errorSummary: input.error }),
      errorSummary: input.error,
      fallbackUsed: Boolean(input.fallbackUsed),
      fallbackReason: input.fallbackReason ?? null,
      inputTokenEstimate: estimateTokensFromText(serializedInput),
      outputTokenEstimate: null,
      totalTokenEstimate: estimateTokensFromText(serializedInput),
      estimatedCost: null,
    });
  };

  if (!config.enabled) {
    await recordEarlyFailure({
      error: "Local AI runtime is disabled",
      failureKind: "runtime_error",
      runtimeRoute: "unavailable",
      provider: config.provider,
      model: config.model,
      localOrCloud: config.mode === "local" ? "local" : "cloud",
    });
    return {
      success: false,
      error: "Local AI runtime is disabled",
      failureKind: "runtime_error",
      effectiveTimeoutMs,
    };
  }

  if (!taskConfig.enabled) {
    await recordEarlyFailure({
      error: `AI task "${options.taskType}" is disabled in settings`,
      failureKind: "runtime_error",
      runtimeRoute: "unavailable",
      provider: config.provider,
      model: taskConfig.model ?? config.model,
      localOrCloud: config.mode === "local" ? "local" : "cloud",
    });
    return {
      success: false,
      error: `AI task "${options.taskType}" is disabled in settings`,
      failureKind: "runtime_error",
      effectiveTimeoutMs,
    };
  }

  const usage = options.skipRateLimit ? null : await getAIUsageStats();
  const monthlyBudgetReached =
    !options.skipRateLimit &&
    (usage?.estimatedSpendGbp || 0) >= config.monthlyBudgetGbp;
  let runtimeCandidates = buildRuntimeCandidates(config, taskConfig, monthlyBudgetReached);

  if (runtimeCandidates.length === 0) {
    const error =
      taskConfig.preferredRuntime === "secondary"
        ? "Secondary AI runtime is not available. Set OPENROUTER_API_KEY in env."
        : "No AI runtime is available for this task.";
    await recordEarlyFailure({
      error,
      failureKind: monthlyBudgetReached ? "rate_limited" : "runtime_error",
      runtimeRoute: "unavailable",
      provider: taskConfig.preferredRuntime === "secondary" ? config.secondaryRuntime.provider : config.provider,
      model: taskConfig.model ?? config.model,
      localOrCloud:
        taskConfig.preferredRuntime === "secondary"
          ? config.secondaryRuntime.mode === "local"
            ? "local"
            : "cloud"
          : config.mode === "local"
            ? "local"
            : "cloud",
      fallbackUsed: false,
      fallbackReason: monthlyBudgetReached ? "No secondary runtime available after monthly budget threshold." : null,
    });
    return {
      success: false,
      error,
      failureKind: monthlyBudgetReached ? "rate_limited" : "runtime_error",
      effectiveTimeoutMs,
    };
  }

  if (!options.skipRateLimit) {
    const rateCheck = await checkAIRateLimit(
      options.taskType,
      taskConfig.dailyLimitOverride,
      taskConfig.preferredRuntime === "primary"
    );
    if (!rateCheck.allowed) {
      const secondaryCandidates = runtimeCandidates.filter(
        (candidate) => candidate.target === "secondary"
      );
      if (secondaryCandidates.length > 0 && isUsageLimitReason(rateCheck.reason)) {
        runtimeCandidates = secondaryCandidates;
        forcedSecondaryRoute = true;
      } else {
        const rateLimitError = rateCheck.reason || "AI rate limit rejected request";
        await recordEarlyFailure({
          error: rateLimitError,
          failureKind: "rate_limited",
          runtimeRoute: "unavailable",
          provider: config.provider,
          model: taskConfig.model ?? config.model,
          localOrCloud: config.mode === "local" ? "local" : "cloud",
        });
        return {
          success: false,
          error: rateLimitError,
          failureKind: "rate_limited",
          attemptCount: 0,
          fallbackAttempted: false,
          effectiveTimeoutMs,
        };
      }
    }
  }

  let lastError = "Unknown AI error";
  let lastFailureKind: AIFailureKind = "runtime_error";
  let lastRawOutput = "";
  let totalAttemptCount = 0;
  let fallbackAttempted = false;
  let skipRemainingOpenRouterFreeModels = false;

  for (let runtimeIndex = 0; runtimeIndex < runtimeCandidates.length; runtimeIndex++) {
    const runtime = runtimeCandidates[runtimeIndex];
    const runtimeModels = resolveModelsForRuntime(config, taskConfig, runtime);
    const primaryAttempts = runtime.target === "primary"
      ? Math.max(1, taskConfig.retryAttempts + 1)
      : 1;
    const candidateModels = [runtimeModels.model];

    if (
      runtimeModels.fallbackModel &&
      runtimeModels.fallbackModel !== runtimeModels.model
    ) {
      candidateModels.push(runtimeModels.fallbackModel);
    }

    for (let modelIndex = 0; modelIndex < candidateModels.length; modelIndex++) {
      const model = candidateModels[modelIndex];
      if (
        skipRemainingOpenRouterFreeModels &&
        runtime.provider === "openrouter" &&
        isOpenRouterFreeModel(model)
      ) {
        continue;
      }
      const attemptsForModel = modelIndex === 0 ? primaryAttempts : 1;

      for (let attempt = 0; attempt < attemptsForModel; attempt++) {
        totalAttemptCount += 1;
        if (runtimeIndex > 0 || modelIndex > 0) {
          fallbackAttempted = true;
        }

        try {
          if (attempt > 0 || modelIndex > 0 || runtimeIndex > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, config.retryDelayMs)
            );
          }

          const result = await callRuntime(
            runtime,
            model,
            options,
            temperature,
            maxTokens,
            effectiveTimeoutMs
          );

          const estimatedCostGbp = estimateCostGbp({
            provider: runtime.provider,
            model: result.model,
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            inputBytes,
            rawOutput: result.rawOutput,
          });

          if (!options.skipRateLimit) {
            await recordAICall(options.taskType, estimatedCostGbp);
          }

          const meta: AIMetadata = {
            model: result.model,
            promptType: options.taskType,
            timestamp: new Date().toISOString(),
            confidence: 0,
            durationMs: result.durationMs,
            inputBytes,
            outputBytes: getByteLength(result.rawOutput),
            fallbackUsed:
              runtimeIndex > 0 || model !== runtimeModels.model,
            fallbackAttempted,
            attemptCount: totalAttemptCount,
            effectiveTimeoutMs,
            jsonExtractionFallback: result.jsonExtractionFallback,
          };

          await logAICall({
            timestamp: meta.timestamp,
            taskType: options.taskType,
            model: result.model,
            success: true,
            durationMs: result.durationMs,
            inputBytes,
            outputBytes: meta.outputBytes,
            fallbackUsed: meta.fallbackUsed,
            fallbackAttempted,
            attemptCount: totalAttemptCount,
            effectiveTimeoutMs,
            jsonExtractionFallback: result.jsonExtractionFallback,
            ...(config.logPromptPreviews
              ? { inputPreview: serializedInput.slice(0, 200) }
              : {}),
          });

          const runtimeRoute =
            runtime.target === "secondary"
              ? taskConfig.preferredRuntime === "secondary"
                ? "secondary-preferred"
                : forcedSecondaryRoute || monthlyBudgetReached
                  ? "secondary-budget-route"
                  : "secondary-fallback-runtime"
              : modelIndex > 0
                ? "primary-fallback-model"
                : "primary";
          const inputTokenEstimate =
            typeof result.promptTokens === "number"
              ? result.promptTokens
              : estimateTokensFromText(serializedInput);
          const outputTokenEstimate =
            typeof result.completionTokens === "number"
              ? result.completionTokens
              : estimateTokensFromText(result.rawOutput);

          await safeRecordAiTelemetryEvent({
            taskName,
            taskType: options.taskType,
            callingModule: options.callingModule ?? null,
            provider: runtime.provider,
            model: result.model,
            runtimeRoute,
            localOrCloud: runtime.mode === "local" ? "local" : runtime.mode === "cloud" ? "cloud" : "unknown",
            sensitivityLevel: options.sensitivityLevel ?? null,
            startedAt,
            completedAt: new Date().toISOString(),
            latencyMs: Date.now() - startedAtMs,
            success: true,
            errorType: null,
            errorSummary: null,
            fallbackUsed: meta.fallbackUsed,
            fallbackReason:
              meta.fallbackUsed
                ? runtime.target === "secondary"
                  ? forcedSecondaryRoute || monthlyBudgetReached
                    ? "Primary runtime budget or rate limit routed execution to secondary runtime."
                    : "Primary runtime failed and secondary runtime succeeded."
                  : modelIndex > 0
                    ? "Primary model failed and fallback model succeeded."
                    : null
                : null,
            inputTokenEstimate,
            outputTokenEstimate,
            totalTokenEstimate: inputTokenEstimate + outputTokenEstimate,
            estimatedCost: estimatedCostGbp,
          });

          return {
            success: true,
            data: result.parsed as T,
            meta,
            rawOutput: result.rawOutput,
          };
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Unknown AI error";
          lastFailureKind = classifyAIError(err);
          lastRawOutput = "";
          const safeErrorSummary = summarizeAiRuntimeErrorForLogs({
            failureKind: lastFailureKind,
            errorSummary: lastError,
          });
          console.warn(
            `[ai-client] ${options.taskType} failed on ${runtime.provider}/${model}: ${safeErrorSummary}`
          );
          if (
            shouldSkipRemainingOpenRouterFreeModels({
              runtime,
              model,
              failureKind: lastFailureKind,
              errorMessage: lastError,
            })
          ) {
            skipRemainingOpenRouterFreeModels = true;
            break;
          }
        }
      }
    }
  }

  const safeLastErrorSummary = summarizeAiRuntimeErrorForLogs({
    failureKind: lastFailureKind,
    errorSummary: lastError,
  });

  await logAICall({
    timestamp: new Date().toISOString(),
    taskType: options.taskType,
    model: runtimeCandidates[runtimeCandidates.length - 1]?.model || taskConfig.model,
    success: false,
    durationMs: 0,
    inputBytes,
    outputBytes: 0,
    fallbackUsed: runtimeCandidates.length > 1,
    fallbackAttempted,
    attemptCount: totalAttemptCount,
    effectiveTimeoutMs,
    failureKind: lastFailureKind,
    error: safeLastErrorSummary,
    ...(config.logPromptPreviews
      ? { inputPreview: serializedInput.slice(0, 200) }
      : {}),
  });

  const finalRuntime = runtimeCandidates[runtimeCandidates.length - 1] || null;
  const finalRuntimeRoute =
    !finalRuntime
      ? "unavailable"
      : finalRuntime.target === "secondary"
        ? taskConfig.preferredRuntime === "secondary"
          ? "secondary-preferred"
          : forcedSecondaryRoute || monthlyBudgetReached
            ? "secondary-budget-route"
            : "secondary-fallback-runtime"
        : "primary";
  await safeRecordAiTelemetryEvent({
    taskName,
    taskType: options.taskType,
    callingModule: options.callingModule ?? null,
    provider: finalRuntime?.provider ?? config.provider,
    model: finalRuntime?.model ?? taskConfig.model ?? config.model,
    runtimeRoute: finalRuntimeRoute,
    localOrCloud:
      finalRuntime?.mode === "local"
        ? "local"
        : finalRuntime?.mode === "cloud"
          ? "cloud"
          : config.mode === "local"
            ? "local"
            : config.mode === "cloud"
              ? "cloud"
              : "unknown",
    sensitivityLevel: options.sensitivityLevel ?? null,
    startedAt,
    completedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAtMs,
    success: false,
    errorType: classifyTelemetryErrorType({ failureKind: lastFailureKind, errorSummary: lastError }),
    errorSummary: lastError,
    fallbackUsed: runtimeCandidates.length > 1 || fallbackAttempted,
    fallbackReason: fallbackAttempted ? "All fallback candidates were attempted and failed." : null,
    inputTokenEstimate: estimateTokensFromText(serializedInput),
    outputTokenEstimate: lastRawOutput ? estimateTokensFromText(lastRawOutput) : null,
    totalTokenEstimate: lastRawOutput
      ? estimateTokensFromText(serializedInput) + estimateTokensFromText(lastRawOutput)
      : estimateTokensFromText(serializedInput),
    estimatedCost: null,
  });

  return {
    success: false,
    error: `AI request failed: ${safeLastErrorSummary}`,
    rawOutput: lastRawOutput,
    failureKind: lastFailureKind,
    attemptCount: totalAttemptCount,
    fallbackAttempted,
    effectiveTimeoutMs,
  };
}

function buildHealthEndpoints(mode: AICompatibilityMode): string[] {
  switch (mode) {
    case "ollama":
      return ["/api/tags", "/api/version"];
    case "openai":
      return ["/v1/models", "/health", "/"];
    case "anthropic":
      return ["/health", "/v1/models", "/"];
    default:
      return ["/health", "/"];
  }
}

function extractAvailableModels(payload: unknown, mode: AICompatibilityMode): string[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (mode === "ollama" && Array.isArray((payload as { models?: unknown[] }).models)) {
    return ((payload as { models: Array<{ name?: string }> }).models || [])
      .map((model) => model.name)
      .filter((name): name is string => Boolean(name));
  }

  if (Array.isArray((payload as { data?: unknown[] }).data)) {
    return ((payload as { data: Array<{ id?: string }> }).data || [])
      .map((model) => model.id)
      .filter((id): id is string => Boolean(id));
  }

  return [];
}

function getConfiguredModelNames(config: AIConfig): string[] {
  const models = new Set<string>();

  if (config.model) {
    models.add(config.model);
  }

  if (config.fallbackModel) {
    models.add(config.fallbackModel);
  }

  for (const taskType of AI_TASK_ORDER) {
    const taskConfig = getTaskRuntimeSettings(config, taskType);

    if (!taskConfig.enabled) {
      continue;
    }

    if (taskConfig.model) {
      models.add(taskConfig.model);
    }

    if (taskConfig.fallbackModel) {
      models.add(taskConfig.fallbackModel);
    }
  }

  return Array.from(models);
}

export async function checkAIHealth(): Promise<AIHealthStatus> {
  const config = await loadAIConfig();
  const checkedAt = new Date().toISOString();
  const configuredTasks = AI_TASK_ORDER.map((taskType) => {
    const taskConfig = getTaskRuntimeSettings(config, taskType);
    return {
      taskType,
      enabled: taskConfig.enabled,
      model: taskConfig.model,
      fallbackModel: taskConfig.fallbackModel,
      preferredRuntime: taskConfig.preferredRuntime,
    };
  });

  if (!config.enabled) {
    return {
      available: false,
      provider: config.provider,
      mode: config.mode,
      compatibilityMode: config.compatibilityMode,
      checkedAt,
      endpoint: config.baseUrl,
      primaryModel: config.model,
      fallbackModel: config.fallbackModel,
      responseTimeMs: null,
      availableModels: [],
      configuredTasks,
      error: "Local AI runtime is disabled",
    };
  }

  const headers = config.apiKey
    ? { Authorization: `Bearer ${config.apiKey}` }
    : undefined;

  if (config.provider === "gemini") {
    if (!config.apiKey) {
      return {
        available: false,
        provider: config.provider,
        mode: config.mode,
        compatibilityMode: config.compatibilityMode,
        checkedAt,
        endpoint: "gemini",
        primaryModel: config.model,
        fallbackModel: config.fallbackModel,
        responseTimeMs: null,
        availableModels: [],
        configuredTasks,
        error: "GEMINI_API_KEY is not set",
      };
    }

    const startedAt = Date.now();
    try {
      const response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`,
        { method: "GET" },
        Math.min(config.timeoutMs, 10_000)
      );

      if (!response.ok) {
        throw new Error(`Gemini health check failed: ${response.status}`);
      }

      const payload = await response.json().catch(() => ({}));
      const models = payload.models || [];
      const availableModels = models.map((m: any) => m.name.replace("models/", ""));

      return {
        available: true,
        provider: config.provider,
        mode: config.mode,
        compatibilityMode: config.compatibilityMode,
        checkedAt,
        endpoint: "gemini",
        primaryModel: config.model,
        fallbackModel: config.fallbackModel,
        responseTimeMs: Date.now() - startedAt,
        availableModels,
        configuredTasks,
      };
    } catch (err) {
      return {
        available: false,
        provider: config.provider,
        mode: config.mode,
        compatibilityMode: config.compatibilityMode,
        checkedAt,
        endpoint: "gemini",
        primaryModel: config.model,
        fallbackModel: config.fallbackModel,
        responseTimeMs: Date.now() - startedAt,
        availableModels: [],
        configuredTasks,
        error: err instanceof Error ? err.message : "Gemini health check failed",
      };
    }
  }

  const candidates = buildHealthEndpoints(config.compatibilityMode);
  let responseTimeMs: number | null = null;
  let availableModels: string[] = [];
  let lastError = "No AI runtime response";

  for (const path of candidates) {
    const startedAt = Date.now();

    try {
      const response = await fetchWithTimeout(
        `${config.baseUrl}${path}`,
        { method: "GET", headers },
        Math.min(config.timeoutMs, 10_000)
      );

      if (!response.ok) {
        lastError = `Health endpoint ${path} returned ${response.status}`;
        continue;
      }

      const payload = await response.json().catch(() => ({}));
      responseTimeMs = Date.now() - startedAt;
      availableModels = extractAvailableModels(payload, config.compatibilityMode);
      const configuredModels = getConfiguredModelNames(config);

      if (config.compatibilityMode === "ollama") {
        if (availableModels.length === 0) {
          return {
            available: false,
            provider: config.provider,
            mode: config.mode,
            compatibilityMode: config.compatibilityMode,
            checkedAt,
            endpoint: config.baseUrl,
            primaryModel: config.model,
            fallbackModel: config.fallbackModel,
            responseTimeMs,
            availableModels,
            configuredTasks,
            error: "Ollama is reachable but no local models are installed",
          };
        }

        const missingModels = configuredModels.filter(
          (model) => !availableModels.includes(model)
        );

        if (missingModels.length > 0) {
          return {
            available: false,
            provider: config.provider,
            mode: config.mode,
            compatibilityMode: config.compatibilityMode,
            checkedAt,
            endpoint: config.baseUrl,
            primaryModel: config.model,
            fallbackModel: config.fallbackModel,
            responseTimeMs,
            availableModels,
            configuredTasks,
            error: `Configured Ollama models are missing: ${missingModels.join(", ")}`,
          };
        }
      }

      return {
        available: true,
        provider: config.provider,
        mode: config.mode,
        compatibilityMode: config.compatibilityMode,
        checkedAt,
        endpoint: config.baseUrl,
        primaryModel: config.model,
        fallbackModel: config.fallbackModel,
        responseTimeMs,
        availableModels,
        configuredTasks,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Health check failed";
    }
  }

  return {
    available: false,
    provider: config.provider,
    mode: config.mode,
    compatibilityMode: config.compatibilityMode,
    checkedAt,
    endpoint: config.baseUrl,
    primaryModel: config.model,
    fallbackModel: config.fallbackModel,
    responseTimeMs,
    availableModels,
    configuredTasks,
    error: lastError,
  };
}

export async function testAIPrompt(): Promise<AICallResult<{ message: string }>> {
  return callAI<{ message: string }>({
    taskType: "health-test",
    prompt: 'Respond with exactly this JSON: {"message":"AI is operational"}.',
    systemPrompt: "You are a health check worker. Reply with valid JSON only.",
    skipRateLimit: true,
  });
}
