import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  loadAIConfig: vi.fn().mockResolvedValue({
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
      enabled: false,
      provider: "openrouter",
      mode: "cloud",
      baseUrl: "https://openrouter.ai/api",
      compatibilityMode: "openai",
      model: "qwen-next",
      fallbackModel: null,
    },
    hasSecondaryApiKey: false,
    timeoutMs: 45_000,
    temperature: 0.15,
    maxTokens: 1200,
    retryAttempts: 0,
    retryDelayMs: 0,
    maxCallsPerDay: 25,
    maxCallsPerTaskType: 12,
    taskSettings: {},
    logPromptPreviews: false,
  }),
  getTaskRuntimeSettings: vi.fn().mockReturnValue({
    enabled: true,
    label: "Parse job posting",
    model: "gemini-2.5-flash-lite",
    fallbackModel: null,
    preferredRuntime: "primary",
    dailyLimitOverride: null,
    allowSecondaryFallback: false,
    timeoutMs: 30_000,
    retryAttempts: 0,
    temperature: 0.1,
    maxTokens: 600,
  }),
  AI_TASK_ORDER: [],
}));

vi.mock("./rate-limiter", () => ({
  checkAIRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getAIUsageStats: vi.fn().mockResolvedValue({ estimatedSpendGbp: 0 }),
  recordAICall: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/storage", () => ({
  appendToCollection: vi.fn().mockResolvedValue(undefined),
  Collections: {
    AI_LOG: "ai-log",
  },
}));

vi.mock("./telemetry", () => ({
  recordAiTelemetryEvent: vi.fn().mockRejectedValue(new Error("telemetry write failed")),
  classifyTelemetryErrorType: vi.fn().mockImplementation(({ failureKind, errorSummary }) => failureKind || errorSummary || null),
}));

import { callAI } from "./client";

describe("ai client telemetry resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"title":"Clinical Trial Assistant"}' }],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 12,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
  });

  it("does not break AI task execution when telemetry recording fails", async () => {
    const result = await callAI({
      taskType: "parse-job",
      prompt: "Return JSON",
      rawInput: { role: "cta" },
      callingModule: "career",
      sensitivityLevel: "public",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ title: "Clinical Trial Assistant" });
  });
});
