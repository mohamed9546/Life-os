import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  requireAppUser: vi.fn().mockResolvedValue({ id: "user-1", email: "user@example.com" }),
}));

vi.mock("@/lib/applications/outcomes", () => ({
  buildApplicationOutcomeSnapshot: vi.fn(),
  getLatestApplicationOutcomeSnapshot: vi.fn(),
  saveApplicationOutcomeSnapshot: vi.fn(),
}));

import { GET, POST } from "./route";
import {
  buildApplicationOutcomeSnapshot,
  getLatestApplicationOutcomeSnapshot,
  saveApplicationOutcomeSnapshot,
} from "@/lib/applications/outcomes";

describe("/api/applications/outcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the latest stored snapshot on GET", async () => {
    vi.mocked(getLatestApplicationOutcomeSnapshot).mockResolvedValue({
      userId: "user-1",
      generatedAt: new Date().toISOString(),
      etlVersion: 1,
      thresholds: { firstFollowUpDays: 8, secondFollowUpDays: 18, ghostedDays: 21 },
      records: [],
      summaries: {
        overall: {
          key: "overall",
          label: "Overall",
          totalRecords: 0,
          attemptRecords: 0,
          pipelineOnlyRecords: 0,
          usefulRoles: 0,
          appliedAttempts: 0,
          responded: 0,
          interviews: 0,
          rejections: 0,
          offers: 0,
          ghosted: 0,
          followUpDue: 0,
          responseRate: null,
          interviewRate: null,
          offerRate: null,
        },
        byTrack: [],
        bySource: [],
        byCvVersion: [],
        byCompany: [],
        byRecruiter: [],
        stageLeakage: [],
        followUpDue: [],
        ghosted: [],
      },
    } as any);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.snapshot.userId).toBe("user-1");
    expect(getLatestApplicationOutcomeSnapshot).toHaveBeenCalledWith("user-1");
  });

  it("builds and persists a fresh snapshot on POST", async () => {
    const snapshot = {
      userId: "user-1",
      generatedAt: new Date().toISOString(),
      etlVersion: 1,
      thresholds: { firstFollowUpDays: 8, secondFollowUpDays: 18, ghostedDays: 21 },
      records: [{ recordId: "attempt-1" }],
      summaries: {
        overall: {
          key: "overall",
          label: "Overall",
          totalRecords: 1,
          attemptRecords: 1,
          pipelineOnlyRecords: 0,
          usefulRoles: 1,
          appliedAttempts: 1,
          responded: 0,
          interviews: 0,
          rejections: 0,
          offers: 0,
          ghosted: 0,
          followUpDue: 0,
          responseRate: 0,
          interviewRate: 0,
          offerRate: 0,
        },
        byTrack: [],
        bySource: [],
        byCvVersion: [],
        byCompany: [],
        byRecruiter: [],
        stageLeakage: [],
        followUpDue: [],
        ghosted: [],
      },
    } as any;

    vi.mocked(buildApplicationOutcomeSnapshot).mockResolvedValue(snapshot);
    vi.mocked(saveApplicationOutcomeSnapshot).mockResolvedValue(snapshot);

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(buildApplicationOutcomeSnapshot).toHaveBeenCalledWith("user-1");
    expect(saveApplicationOutcomeSnapshot).toHaveBeenCalledWith(snapshot);
  });
});
