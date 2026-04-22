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

    await writeObject(ConfigFiles.APP_CONFIG, merged);
    return NextResponse.json(merged);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update config" },
      { status: 500 }
    );
  }
}
