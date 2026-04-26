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

import { recordAiTelemetryEvent } from "./telemetry";
import { callAI } from "./client";

describe("ai client telemetry resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recordAiTelemetryEvent).mockRejectedValue(new Error("telemetry write failed"));
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

  it("records provider/model/task metadata for failures without prompt or response fields", async () => {
    vi.mocked(recordAiTelemetryEvent).mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: {
              message:
                "Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day",
              code: 429,
              metadata: { headers: { "X-RateLimit-Limit": "50" } },
            },
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const result = await callAI({
      taskType: "parse-job",
      prompt: "This prompt text must not be stored.",
      rawInput: { recruiterMessage: "must not leak" },
      callingModule: "career",
      sensitivityLevel: "public",
    });

    expect(result.success).toBe(false);
    const telemetryCall = vi.mocked(recordAiTelemetryEvent).mock.calls.at(-1)?.[0] as any;
    expect(telemetryCall.success).toBe(false);
    expect(telemetryCall.taskType).toBe("parse-job");
    expect(telemetryCall.provider).toBe("gemini");
    expect(telemetryCall.model).toBe("gemini-2.5-flash-lite");
    expect(telemetryCall.prompt).toBeUndefined();
    expect(telemetryCall.response).toBeUndefined();
  });
});
