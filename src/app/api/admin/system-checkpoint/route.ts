import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/session";
import { buildSystemCheckpointSnapshot } from "@/lib/system/checkpoint";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAdminUser();
    const snapshot = await buildSystemCheckpointSnapshot(user.id);
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to load system checkpoint",
      },
      { status: err instanceof Error && err.message === "Forbidden" ? 403 : 500 }
    );
  }
}
