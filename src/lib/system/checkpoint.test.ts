import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/jobs/source-health", () => ({
  getLatestSourceHealthSnapshot: vi.fn(),
}));

vi.mock("@/lib/ai/telemetry", () => ({
  getAiTelemetrySummary: vi.fn(),
}));

vi.mock("@/lib/applications/storage", () => ({
  getApplicationLogs: vi.fn(),
}));

vi.mock("@/lib/applications/outcomes", () => ({
  getLatestApplicationOutcomeSnapshot: vi.fn(),
}));

import { getLatestSourceHealthSnapshot } from "@/lib/jobs/source-health";
import { getAiTelemetrySummary } from "@/lib/ai/telemetry";
import { getApplicationLogs } from "@/lib/applications/storage";
import { getLatestApplicationOutcomeSnapshot } from "@/lib/applications/outcomes";
import { buildSystemCheckpointSnapshot } from "./checkpoint";
import { promises as fs } from "fs";

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readdir: vi.fn(),
      stat: vi.fn(),
      readFile: vi.fn(),
    },
  };
});

const now = new Date("2026-05-01T12:00:00.000Z");

function createAiSummary(overrides?: Partial<any>) {
  return {
    generatedAt: now.toISOString(),
    totalCalls: 0,
    successCount: 0,
    failureCount: 0,
    fallbackCount: 0,
    averageLatencyMs: 0,
    estimatedTotalCost: 0,
    windows: {
      today: { totalCalls: 0, successCount: 0, failureCount: 0, fallbackCount: 0, averageLatencyMs: 0, estimatedCost: 0 },
      week: { totalCalls: 0, successCount: 0, failureCount: 0, fallbackCount: 0, averageLatencyMs: 0, estimatedCost: 0 },
      month: { totalCalls: 0, successCount: 0, failureCount: 0, fallbackCount: 0, averageLatencyMs: 0, estimatedCost: 0 },
    },
    providerUsage: [],
    modelUsage: [],
    localVsCloud: { local: 0, cloud: 0, unknown: 0 },
    slowestTasks: [],
    recentFailures: [],
    sensitivityRouting: [],
    ...overrides,
  };
}

describe("system checkpoint snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLatestSourceHealthSnapshot).mockResolvedValue(null as any);
    vi.mocked(getAiTelemetrySummary).mockResolvedValue(createAiSummary() as any);
    vi.mocked(getApplicationLogs).mockResolvedValue([] as any);
    vi.mocked(getLatestApplicationOutcomeSnapshot).mockResolvedValue(null as any);
    vi.mocked(fs.readdir).mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" }));
    vi.mocked(fs.stat).mockResolvedValue({ mtime: now, size: 1000 } as any);
    vi.mocked(fs.readFile).mockResolvedValue("private/*\n!private/.gitkeep\n!private/**/*.age\n" as any);
  });

  it("treats missing snapshots as unknown and no backup as critical", async () => {
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({} as any)
      .mockResolvedValueOnce({} as any)
      .mockResolvedValueOnce({} as any);

    const snapshot = await buildSystemCheckpointSnapshot("user-1", { now });

    expect(snapshot.sourceHealth.status).toBe("unknown");
    expect(snapshot.aiTelemetry.status).toBe("unknown");
    expect(snapshot.applicationOutcomes.status).toBe("unknown");
    expect(snapshot.encryptedBackup.status).toBe("critical");
    expect(snapshot.overallStatus).toBe("critical");
  });

  it("classifies backup freshness and source failures correctly", async () => {
    vi.mocked(getLatestSourceHealthSnapshot).mockResolvedValue({
      checkedAt: now.toISOString(),
      durationMs: 100,
      totalSources: 4,
      ok: 2,
      degraded: 0,
      down: 2,
      unknown: 0,
      results: [
        { sourceId: "a", sourceName: "A", status: "down", checkedAt: now.toISOString(), latencyMs: null, resultCount: null, error: "down", warning: null },
        { sourceId: "b", sourceName: "B", status: "down", checkedAt: now.toISOString(), latencyMs: null, resultCount: null, error: "down", warning: null },
      ],
    } as any);
    vi.mocked(fs.readdir).mockResolvedValue([{ isFile: () => true, name: "backup-1.age" }] as any);
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({} as any)
      .mockResolvedValueOnce({} as any)
      .mockResolvedValueOnce({} as any)
      .mockResolvedValueOnce({ mtime: new Date("2026-04-30T12:00:00.000Z"), size: 1234 } as any);

    const snapshot = await buildSystemCheckpointSnapshot("user-1", { now });
    expect(snapshot.sourceHealth.status).toBe("critical");
    expect(snapshot.encryptedBackup.status).toBe("healthy");
    expect(snapshot.encryptedBackup.data.backupAgeDays).toBe(1);
    expect(snapshot.overallStatus).toBe("critical");
  });

  it("marks stale backup and outcomes missing with attempts as attention", async () => {
    vi.mocked(fs.readdir).mockResolvedValue([{ isFile: () => true, name: "backup-1.age" }] as any);
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({} as any)
      .mockResolvedValueOnce({} as any)
      .mockResolvedValueOnce({} as any)
      .mockResolvedValueOnce({ mtime: new Date("2026-04-20T12:00:00.000Z"), size: 1234 } as any);
    vi.mocked(getApplicationLogs).mockResolvedValue([{ id: "attempt-1" }] as any);

    const snapshot = await buildSystemCheckpointSnapshot("user-1", { now });

    expect(snapshot.encryptedBackup.status).toBe("attention");
    expect(snapshot.applicationOutcomes.status).toBe("attention");
    expect(snapshot.operatorChecklist).toEqual(
      expect.arrayContaining([
        "Refresh the encrypted backup.",
        "Build the application outcomes snapshot.",
      ])
    );
    expect(snapshot.overallStatus).toBe("attention");
  });

  it("marks ai telemetry attention only with meaningful sample size", async () => {
    vi.mocked(fs.stat)
      .mockResolvedValueOnce({} as any)
      .mockResolvedValueOnce({} as any)
      .mockResolvedValueOnce({} as any);
    vi.mocked(getAiTelemetrySummary).mockResolvedValue(
      createAiSummary({
        totalCalls: 8,
        failureCount: 3,
        fallbackCount: 3,
        averageLatencyMs: 120,
        windows: {
          today: { totalCalls: 8, successCount: 5, failureCount: 3, fallbackCount: 3, averageLatencyMs: 120, estimatedCost: 0 },
          week: { totalCalls: 8, successCount: 5, failureCount: 3, fallbackCount: 3, averageLatencyMs: 120, estimatedCost: 0 },
          month: { totalCalls: 8, successCount: 5, failureCount: 3, fallbackCount: 3, averageLatencyMs: 120, estimatedCost: 0 },
        },
        recentFailures: [{ taskType: "chat" }, { taskType: "parse-job" }, { taskType: "generate-outreach" }],
        localVsCloud: { local: 1, cloud: 7, unknown: 0 },
      }) as any
    );

    const snapshot = await buildSystemCheckpointSnapshot("user-1", { now });
    expect(snapshot.aiTelemetry.status).toBe("attention");
  });
});
