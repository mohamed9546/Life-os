import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigFiles, readObject, writeObject } from "@/lib/storage";
import { getAllAdapters } from "./sources";
import {
  classifySourceHealthResult,
  getLatestSourceHealthSnapshot,
  runSourceHealthCheck,
} from "./source-health";

vi.mock("@/lib/storage", () => ({
  ConfigFiles: {
    SOURCE_HEALTH: "source-health",
  },
  readObject: vi.fn(),
  writeObject: vi.fn(),
}));

vi.mock("./sources", () => ({
  getAllAdapters: vi.fn(),
}));

function makeHealthyAdapter(sourceId: string, displayName: string) {
  return {
    sourceId,
    displayName,
    isConfigured: vi.fn().mockResolvedValue(true),
    fetchJobs: vi.fn().mockResolvedValue({
      source: sourceId,
      jobs: [
        {
          source: sourceId,
          sourceJobId: `${sourceId}-1`,
          title: "Clinical Trial Assistant",
          company: "Acme",
          location: "United Kingdom",
          link: "https://example.com/job",
          fetchedAt: new Date().toISOString(),
        },
      ],
      totalAvailable: 1,
      fetchedAt: new Date().toISOString(),
      query: { keywords: ["clinical trial assistant"], maxResults: 1 },
    }),
  };
}

describe("source-health domain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("classifies healthy results as ok", () => {
    expect(
      classifySourceHealthResult({
        resultCount: 1,
        error: null,
        warning: null,
      })
    ).toBe("ok");
  });

  it("returns a healthy snapshot when all sources succeed", async () => {
    vi.mocked(getAllAdapters).mockReturnValue([
      makeHealthyAdapter("adzuna", "Adzuna"),
      makeHealthyAdapter("reed", "Reed"),
    ] as never);

    const snapshot = await runSourceHealthCheck();

    expect(snapshot.totalSources).toBe(2);
    expect(snapshot.ok).toBe(2);
    expect(snapshot.degraded).toBe(0);
    expect(snapshot.down).toBe(0);
    expect(writeObject).toHaveBeenCalledWith(ConfigFiles.SOURCE_HEALTH, snapshot);
  });

  it("keeps the snapshot running when one source throws", async () => {
    const healthy = makeHealthyAdapter("adzuna", "Adzuna");
    const broken = {
      sourceId: "reed",
      displayName: "Reed",
      isConfigured: vi.fn().mockResolvedValue(true),
      fetchJobs: vi.fn().mockRejectedValue(new Error("Request timed out after 1000ms")),
    };

    vi.mocked(getAllAdapters).mockReturnValue([healthy, broken] as never);

    const snapshot = await runSourceHealthCheck();

    expect(snapshot.totalSources).toBe(2);
    expect(snapshot.ok).toBe(1);
    expect(snapshot.down).toBe(1);
    expect(snapshot.results.find((result) => result.sourceId === "reed")?.error).toContain("timed out");
  });

  it("marks malformed source output as degraded", async () => {
    const malformed = {
      sourceId: "adzuna",
      displayName: "Adzuna",
      isConfigured: vi.fn().mockResolvedValue(true),
      fetchJobs: vi.fn().mockResolvedValue({
        source: "adzuna",
        jobs: [
          {
            source: "adzuna",
            title: "",
            company: "Acme",
            location: "United Kingdom",
            fetchedAt: new Date().toISOString(),
          },
        ],
        totalAvailable: 1,
        fetchedAt: new Date().toISOString(),
        query: { keywords: ["clinical trial assistant"], maxResults: 1 },
      }),
    };

    vi.mocked(getAllAdapters).mockReturnValue([malformed] as never);

    const snapshot = await runSourceHealthCheck();

    expect(snapshot.degraded).toBe(1);
    expect(snapshot.results[0].warning).toContain("malformed");
  });

  it("returns null when no previous snapshot exists", async () => {
    vi.mocked(readObject).mockResolvedValue(null);
    await expect(getLatestSourceHealthSnapshot()).resolves.toBeNull();
  });
});
