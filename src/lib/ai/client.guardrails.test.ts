import { beforeEach, describe, expect, it, vi } from "vitest";

const configMocks = vi.hoisted(() => ({
  loadAIConfig: vi.fn(),
  getTaskRuntimeSettings: vi.fn(),
}));

vi.mock("./config", () => ({
  loadAIConfig: configMocks.loadAIConfig,
  getTaskRuntimeSettings: configMocks.getTaskRuntimeSettings,
  AI_TASK_ORDER: [],
}));

vi.mock("./rate-limiter", () => ({
  checkAIRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getAIUsageStats: vi.fn().mockResolvedValue({ estimatedSpendGbp: 0 }),
  recordAICall: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/storage", () => ({
  appendToCollection: vi.fn().mockResolvedValue(undefined),
  readCollection: vi.fn().mockResolvedValue([]),
  writeCollection: vi.fn().mockResolvedValue(undefined),
  writeCollectionLocalMirror: vi.fn().mockResolvedValue(undefined),
  Collections: {
    AI_LOG: "ai-log",
    AI_TELEMETRY: "ai-telemetry",
  },
}));

vi.mock("./telemetry", async () => {
  const actual = await vi.importActual<typeof import("./telemetry")>("./telemetry");
  return {
    ...actual,
    recordAiTelemetryEvent: vi.fn().mockResolvedValue(undefined),
    classifyTelemetryErrorType: vi
      .fn()
      .mockImplementation(({ failureKind, errorSummary }) => failureKind || errorSummary || null),
  };
});

import { callAI } from "./client";

const baseConfig = {
  provider: "gemini",
  mode: "cloud",
  enabled: true,
  baseUrl: "https://generativelanguage.googleapis.com",
  apiKey: "fake-key",
  compatibilityMode: "gemini",
  model: "gemini-2.5-flash-lite",
  fallbackModel: null,
  monthlyBudgetGbp: 5,
  secondaryRuntime: {
    enabled: true,
    provider: "openrouter",
    mode: "cloud",
    baseUrl: "https://openrouter.ai/api",
    compatibilityMode: "openai",
    model: "qwen/qwen3-next-80b-a3b-instruct:free",
    fallbackModel: "nvidia/nemotron-3-super-120b-a12b:free",
  },
  hasSecondaryApiKey: true,
  timeoutMs: 45_000,
  temperature: 0.15,
  maxTokens: 1200,
  retryAttempts: 0,
  retryDelayMs: 0,
  maxCallsPerDay: 25,
  maxCallsPerTaskType: 12,
  taskSettings: {},
  logPromptPreviews: false,
};

describe("ai client runtime guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = "fake-openrouter-key";
    configMocks.loadAIConfig.mockResolvedValue(baseConfig);
    configMocks.getTaskRuntimeSettings.mockReturnValue({
      enabled: true,
      label: "Generate outreach strategy",
      model: "qwen/qwen3-next-80b-a3b-instruct:free",
      fallbackModel: "nvidia/nemotron-3-super-120b-a12b:free",
      preferredRuntime: "secondary",
      dailyLimitOverride: null,
      allowSecondaryFallback: false,
      timeoutMs: 30_000,
      retryAttempts: 0,
      temperature: 0.2,
      maxTokens: 800,
    });
  });

  it("short-circuits remaining OpenRouter free models after a 429 and sanitizes console output", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: {
              message:
                "Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day",
              code: 429,
            },
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const result = await callAI({
      taskType: "generate-outreach",
      prompt: "Return JSON",
      rawInput: { role: "cta" },
    });

    expect(result.success).toBe(false);
    expect(result.failureKind).toBe("rate_limited");
    expect(result.error).toContain("rate limit exceeded");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[ai-client] generate-outreach failed on openrouter/qwen/qwen3-next-80b-a3b-instruct:free: rate limit exceeded")
    );
    expect(warnSpy.mock.calls.flat().join(" ")).not.toContain('{"error"');
  });

  it("does not block a non-free fallback candidate after a free-model rate limit", async () => {
    configMocks.getTaskRuntimeSettings.mockReturnValue({
      enabled: true,
      label: "Generate outreach strategy",
      model: "qwen/qwen3-next-80b-a3b-instruct:free",
      fallbackModel: "openai/gpt-4o-mini",
      preferredRuntime: "secondary",
      dailyLimitOverride: null,
      allowSecondaryFallback: false,
      timeoutMs: 30_000,
      retryAttempts: 0,
      temperature: 0.2,
      maxTokens: 800,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: {
                message:
                  "Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day",
                code: 429,
              },
            }),
            { status: 429, headers: { "Content-Type": "application/json" } }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content:
                      '{"recommendedAction":"Send later","targetContacts":[],"timing":"Next week","confidence":0.4}',
                  },
                },
              ],
              model: "openai/gpt-4o-mini",
              usage: { prompt_tokens: 10, completion_tokens: 20 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
    );

    const result = await callAI({
      taskType: "generate-outreach",
      prompt: "Return JSON",
      rawInput: { role: "cta" },
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      recommendedAction: "Send later",
      targetContacts: [],
      timing: "Next week",
      confidence: 0.4,
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});
