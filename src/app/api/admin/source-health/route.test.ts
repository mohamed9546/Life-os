import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  requireAdminUser: vi.fn().mockResolvedValue({ id: "admin", isAdmin: true }),
}));

vi.mock("@/lib/jobs/source-health", () => ({
  getLatestSourceHealthSnapshot: vi.fn(),
  runSourceHealthCheck: vi.fn(),
}));

import { GET, POST } from "./route";
import {
  getLatestSourceHealthSnapshot,
  runSourceHealthCheck,
} from "@/lib/jobs/source-health";

describe("/api/admin/source-health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the latest snapshot on GET", async () => {
    vi.mocked(getLatestSourceHealthSnapshot).mockResolvedValue({
      checkedAt: new Date().toISOString(),
      durationMs: 50,
      totalSources: 2,
      ok: 1,
      degraded: 0,
      down: 1,
      unknown: 0,
      results: [],
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.snapshot.totalSources).toBe(2);
  });

  it("runs a fresh source health check on POST", async () => {
    vi.mocked(runSourceHealthCheck).mockResolvedValue({
      checkedAt: new Date().toISOString(),
      durationMs: 40,
      totalSources: 1,
      ok: 1,
      degraded: 0,
      down: 0,
      unknown: 0,
      results: [],
    });

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(runSourceHealthCheck).toHaveBeenCalledTimes(1);
  });
});
