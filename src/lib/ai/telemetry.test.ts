import { beforeEach, describe, expect, it, vi } from "vitest";

let store: unknown[] = [];

vi.mock("@/lib/storage", () => ({
  Collections: {
    AI_TELEMETRY: "ai-telemetry",
  },
  readCollection: vi.fn(async () => store),
  writeCollection: vi.fn(async (_collection: string, next: unknown[]) => {
    store = next;
  }),
  writeCollectionLocalMirror: vi.fn(async (_collection: string, next: unknown[]) => {
    store = next;
  }),
}));

import {
  clearAiTelemetryEvents,
  getAiTelemetryEvents,
  getAiTelemetrySummary,
  recordAiTelemetryEvent,
} from "./telemetry";

describe("ai telemetry domain", () => {
  beforeEach(async () => {
    store = [];
    await clearAiTelemetryEvents();
  });

  it("records success metadata without prompt or response content", async () => {
    await recordAiTelemetryEvent({
      taskName: "Parse job posting",
      taskType: "parse-job",
      callingModule: "career",
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
      runtimeRoute: "primary",
      localOrCloud: "cloud",
      sensitivityLevel: "public",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      latencyMs: 120,
      success: true,
      fallbackUsed: false,
      inputTokenEstimate: 12,
      outputTokenEstimate: 20,
      totalTokenEstimate: 32,
      estimatedCost: 0.0001,
      prompt: "should not persist",
      response: "should not persist",
    } as any);

    const events = await getAiTelemetryEvents();
    expect(events).toHaveLength(1);
    expect((events[0] as any).prompt).toBeUndefined();
    expect((events[0] as any).response).toBeUndefined();
    expect(events[0].taskType).toBe("parse-job");
  });

  it("records failure metadata safely", async () => {
    await recordAiTelemetryEvent({
      taskName: "Evaluate job fit",
      taskType: "evaluate-job",
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
      runtimeRoute: "primary",
      localOrCloud: "cloud",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      latencyMs: 4500,
      success: false,
      errorType: "timeout",
      errorSummary: "Request timed out after 4500ms",
      fallbackUsed: true,
      fallbackReason: "Primary runtime failed and all fallback candidates failed.",
    });

    const events = await getAiTelemetryEvents();
    expect(events[0].success).toBe(false);
    expect(events[0].errorType).toBe("timeout");
    expect(events[0].errorSummary).toContain("timed out");
  });

  it("caps telemetry retention at 1000 events", async () => {
    for (let index = 0; index < 1001; index++) {
      await recordAiTelemetryEvent({
        taskName: `Task ${index}`,
        taskType: "chat",
        provider: "gemini",
        model: "gemini-2.5-flash-lite",
        runtimeRoute: "primary",
        localOrCloud: "cloud",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        latencyMs: index,
        success: true,
        fallbackUsed: false,
      });
    }

    const events = await getAiTelemetryEvents();
    expect(events).toHaveLength(1000);
  });

  it("builds summary counts for provider/model/fallback/failure", async () => {
    const now = new Date().toISOString();
    await recordAiTelemetryEvent({
      taskName: "Chat",
      taskType: "chat",
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
      runtimeRoute: "primary",
      localOrCloud: "cloud",
      sensitivityLevel: "sensitive",
      startedAt: now,
      completedAt: now,
      latencyMs: 100,
      success: true,
      fallbackUsed: false,
      estimatedCost: 0.01,
    });
    await recordAiTelemetryEvent({
      taskName: "Weekly review",
      taskType: "summarize-week",
      provider: "openrouter",
      model: "qwen-next",
      runtimeRoute: "secondary-fallback-runtime",
      localOrCloud: "cloud",
      sensitivityLevel: "sensitive",
      startedAt: now,
      completedAt: now,
      latencyMs: 300,
      success: false,
      errorType: "runtime_error",
      errorSummary: "secondary failed",
      fallbackUsed: true,
      estimatedCost: 0,
    });

    const summary = await getAiTelemetrySummary();
    expect(summary.totalCalls).toBe(2);
    expect(summary.failureCount).toBe(1);
    expect(summary.fallbackCount).toBe(1);
    expect(summary.providerUsage.find((item) => item.provider === "gemini")?.count).toBe(1);
    expect(summary.modelUsage.find((item) => item.model === "qwen-next")?.count).toBe(1);
    expect(summary.recentFailures).toHaveLength(1);
  });
});
