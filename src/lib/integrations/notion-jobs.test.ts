import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({
  readObject: vi.fn().mockResolvedValue({}),
  writeObject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/jobs/storage", () => ({
  getEnrichedJobs: vi.fn().mockResolvedValue([]),
  getInboxJobs: vi.fn().mockResolvedValue([]),
  getRankedJobs: vi.fn().mockResolvedValue([]),
  getRejectedJobs: vi.fn().mockResolvedValue([]),
}));

import { syncJobsToNotion, syncJobsToNotionBestEffort } from "./notion-jobs";

const sampleJob = {
  id: "job-1",
  raw: {
    title: "Clinical Trial Assistant",
    company: "Acme",
    source: "adzuna",
    location: "Glasgow",
    link: "https://example.com/job",
    fetchedAt: new Date().toISOString(),
  },
  fit: { data: { fitScore: 80, priorityBand: "high" } },
  parsed: { data: { location: "Glasgow", roleTrack: "clinical", summary: "summary" } },
  status: "tracked",
  updatedAt: new Date().toISOString(),
} as any;

describe("notion job sync guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips cleanly when notion config is missing", async () => {
    vi.stubEnv("NOTION_API_KEY", "");
    vi.stubEnv("NOTION_TOKEN", "");
    vi.stubEnv("NOTION_DATABASE_ID", "");

    await expect(syncJobsToNotion("user-1", [sampleJob])).resolves.toEqual({
      configured: false,
      synced: 0,
      created: 0,
      updated: 0,
      skipped: 1,
      errors: [],
    });
  });

  it.each([403, 404])(
    "treats notion database lookup %s as misconfigured and logs a concise warning",
    async (status) => {
      vi.stubEnv("NOTION_API_KEY", "fake-token");
      vi.stubEnv("NOTION_DATABASE_ID", "fake-db");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("{}", { status, headers: { "Content-Type": "application/json" } }))
      );

      await expect(syncJobsToNotionBestEffort("user-1", [sampleJob])).resolves.toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        "[notion] job sync skipped: database not found or integration not shared"
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
    }
  );
});
