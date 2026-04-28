import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  requireAdminUser: vi.fn().mockResolvedValue({ id: "admin", isAdmin: true }),
}));

vi.mock("@/lib/system/checkpoint", () => ({
  buildSystemCheckpointSnapshot: vi.fn(),
}));

import { GET } from "./route";
import { buildSystemCheckpointSnapshot } from "@/lib/system/checkpoint";

describe("/api/admin/system-checkpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the checkpoint snapshot on GET", async () => {
    vi.mocked(buildSystemCheckpointSnapshot).mockResolvedValue({
      generatedAt: new Date().toISOString(),
      overallStatus: "healthy",
      operatorChecklist: [],
      sourceHealth: { status: "healthy" },
      aiTelemetry: { status: "healthy" },
      encryptedBackup: { status: "healthy" },
      runtimeGuardrails: { status: "healthy" },
      applicationOutcomes: { status: "healthy" },
    } as any);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.snapshot.overallStatus).toBe("healthy");
    expect(buildSystemCheckpointSnapshot).toHaveBeenCalledWith("admin");
  });
});
