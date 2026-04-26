import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/session";
import {
  getLatestSourceHealthSnapshot,
  runSourceHealthCheck,
} from "@/lib/jobs/source-health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
    const snapshot = await getLatestSourceHealthSnapshot();
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load source health" },
      { status: err instanceof Error && err.message === "Forbidden" ? 403 : 500 }
    );
  }
}

export async function POST() {
  try {
    await requireAdminUser();
    const snapshot = await runSourceHealthCheck();
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Source health check failed" },
      { status: err instanceof Error && err.message === "Forbidden" ? 403 : 500 }
    );
  }
}
