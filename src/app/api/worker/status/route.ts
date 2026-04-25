// ============================================================
// GET /api/worker/status
// Returns current state of all worker tasks.
// ============================================================

import { NextResponse } from "next/server";
import {
  getAllTaskConfigs,
  getAllTaskStates,
  buildDisplayTaskState,
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
      const displayState = buildDisplayTaskState(config, state);
      const policy = checkTaskPolicy(config, displayState);

      return {
        ...config,
        state: displayState,
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
