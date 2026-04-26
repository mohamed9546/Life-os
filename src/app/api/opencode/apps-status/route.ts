import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { buildOpenCodeAppsStatus } from "@/lib/opencode/apps-status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();
    const status = await buildOpenCodeAppsStatus(user.id);
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load application ops status" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
