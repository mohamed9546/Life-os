// ============================================================
// POST /api/worker/run
// Manually trigger a specific worker task.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  executeTask,
  resetTaskState,
  getTaskConfig,
  getFetchTaskIdForSource,
} from "@/lib/worker";
import { requireAdminUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAdminUser();
    const body = (await request.json()) as {
      taskId?: string;
      sourceId?: string;
      force?: boolean;
      reset?: boolean;
    };
    const { taskId, sourceId, force, reset } = body;
    const resolvedTaskId =
      taskId || (sourceId ? getFetchTaskIdForSource(sourceId) : null);

    if (!resolvedTaskId) {
      return NextResponse.json(
        { error: "taskId or sourceId is required" },
        { status: 400 }
      );
    }

    const config = await getTaskConfig(resolvedTaskId);
    if (!config) {
      return NextResponse.json(
        { error: `Unknown task: ${resolvedTaskId}` },
        { status: 404 }
      );
    }

    // Reset task state if requested
    if (reset) {
      await resetTaskState(resolvedTaskId);
      return NextResponse.json({
        success: true,
        message: `Task ${resolvedTaskId} state reset`,
      });
    }

    // Execute the task
    const result = await executeTask(resolvedTaskId, force || false);

    return NextResponse.json({
      success: result.status === "success",
      result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Task execution failed",
      },
      { status: err instanceof Error && err.message === "Forbidden" ? 403 : 500 }
    );
  }
}
