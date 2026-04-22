// ============================================================
// GET /api/worker/config — get all task configurations
// PUT /api/worker/config — update task configurations
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAllTaskConfigs, updateTaskConfig } from "@/lib/worker";
import { requireAdminUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
    const tasks = await getAllTaskConfigs();
    return NextResponse.json({ tasks });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Config read failed" },
      { status: err instanceof Error && err.message === "Forbidden" ? 403 : 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdminUser();
    const body = await request.json();
    const { taskId, updates } = body as {
      taskId?: string;
      updates?: Partial<{
        enabled: boolean;
        minIntervalMs: number;
        dailyLimit: number;
        burstWindowMs: number;
        burstLimit: number;
        cooldownMs: number;
        maxConsecutiveFailures: number;
      }>;
    };

    if (!taskId || !updates) {
      return NextResponse.json(
        { error: "taskId and updates are required" },
        { status: 400 }
      );
    }

    const updated = await updateTaskConfig(taskId, updates);
    if (!updated) {
      return NextResponse.json(
        { error: `Unknown task: ${taskId}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Task config saved",
      task: updated,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Config update failed" },
      { status: err instanceof Error && err.message === "Forbidden" ? 403 : 500 }
    );
  }
}
