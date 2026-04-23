// ============================================================
// GET /api/config - Read admin source/enrichment config
// PUT /api/config - Update admin source/enrichment config
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { writeObject, ConfigFiles } from "@/lib/storage";
import { requireAdminUser } from "@/lib/auth/session";
import { AppConfig } from "@/types";
import { getAppConfig } from "@/lib/config/app-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
    const config = await getAppConfig();
    return NextResponse.json(config);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read config" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdminUser();
    const body = await request.json();
    const current = await getAppConfig();

    const merged: AppConfig = {
      jobSources: {
        ...current.jobSources,
        ...(body.jobSources || {}),
      },
      enrichment: {
        ...current.enrichment,
        ...(body.enrichment || {}),
      },
      worker: body.worker || current.worker,
    };

    // Automatically sync worker tasks with the job sources state
    if (body.jobSources) {
      const { FETCH_TASK_SOURCE_MAP, DEFAULT_TASK_CONFIGS } = await import("@/lib/worker/task-registry");
      const newTasks = [...(merged.worker.tasks || [])];
      
      for (const [sourceId, sourceConfig] of Object.entries(merged.jobSources)) {
        const taskId = Object.entries(FETCH_TASK_SOURCE_MAP).find(
          ([_, mapSourceId]) => mapSourceId === sourceId
        )?.[0];

        if (taskId && sourceConfig && "enabled" in sourceConfig) {
          const isEnabled = Boolean((sourceConfig as any).enabled);
          const existing = newTasks.find(t => t.id === taskId);
          
          if (existing) {
            existing.enabled = isEnabled;
          } else {
            // Check if it differs from default, if so add an override
            const def = DEFAULT_TASK_CONFIGS.find(t => t.id === taskId);
            if (def && def.enabled !== isEnabled) {
              newTasks.push({ id: taskId, enabled: isEnabled } as any);
            }
          }
        }
      }
      merged.worker.tasks = newTasks;
    }

    await writeObject(ConfigFiles.APP_CONFIG, merged);
    return NextResponse.json(merged);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update config" },
      { status: 500 }
    );
  }
}
