import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/session", () => ({
  requireAdminUser: vi.fn().mockResolvedValue({ id: "admin", isAdmin: true }),
}));

vi.mock("@/lib/ai/telemetry", () => ({
  getAiTelemetrySummary: vi.fn(),
  getAiTelemetryEvents: vi.fn(),
}));

import { GET } from "./route";
import { getAiTelemetryEvents, getAiTelemetrySummary } from "@/lib/ai/telemetry";

describe("/api/admin/ai-telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns summary and recent events", async () => {
    vi.mocked(getAiTelemetrySummary).mockResolvedValue({
      generatedAt: new Date().toISOString(),
      totalCalls: 3,
      successCount: 2,
      failureCount: 1,
      fallbackCount: 1,
      averageLatencyMs: 120,
      estimatedTotalCost: 0.002,
      windows: {
        today: { totalCalls: 3, successCount: 2, failureCount: 1, fallbackCount: 1, averageLatencyMs: 120, estimatedCost: 0.002 },
        week: { totalCalls: 3, successCount: 2, failureCount: 1, fallbackCount: 1, averageLatencyMs: 120, estimatedCost: 0.002 },
        month: { totalCalls: 3, successCount: 2, failureCount: 1, fallbackCount: 1, averageLatencyMs: 120, estimatedCost: 0.002 },
      },
      providerUsage: [],
      modelUsage: [],
      localVsCloud: { local: 0, cloud: 3, unknown: 0 },
      slowestTasks: [],
      recentFailures: [],
      sensitivityRouting: [],
    });
    vi.mocked(getAiTelemetryEvents).mockResolvedValue([
      {
        id: "evt-1",
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
        latencyMs: 111,
        success: true,
        errorType: null,
        errorSummary: null,
        fallbackUsed: false,
        fallbackReason: null,
        inputTokenEstimate: 10,
        outputTokenEstimate: 11,
        totalTokenEstimate: 21,
        estimatedCost: 0.0001,
        metadataVersion: 1,
      },
    ] as any);

    const request = new NextRequest("http://localhost:3000/api/admin/ai-telemetry?limit=50");
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.summary.totalCalls).toBe(3);
    expect(payload.recentEvents).toHaveLength(1);
    expect(getAiTelemetryEvents).toHaveBeenCalledWith({ limit: 50 });
  });
});
