// ============================================================
// GET /api/worker/status
// Returns current state of all worker tasks.
// ============================================================

import { NextResponse } from "next/server";
import {
  getAllTaskConfigs,
  getAllTaskStates,
  checkTaskPolicy,
} from "@/lib/worker";
import { requireAdminUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
    const configs = await getAllTaskConfigs();
    const states = await getAllTaskStates();

    const tasks = configs.map((config) => {
      const state = states.find((s) => s.taskId === config.id);
      const policy = state ? checkTaskPolicy(config, state) : { allowed: true };

      return {
        ...config,
        state: state || {
          taskId: config.id,
          status: "idle",
          lastRun: null,
          lastSuccess: null,
          lastFailure: null,
          consecutiveFailures: 0,
          runsToday: 0,
          todayDate: new Date().toISOString().slice(0, 10),
        },
        policyAllowed: policy.allowed,
        policyReason: policy.reason,
      };
    });

    return NextResponse.json({ tasks });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get status" },
      { status: err instanceof Error && err.message === "Forbidden" ? 403 : 500 }
    );
  }
}
