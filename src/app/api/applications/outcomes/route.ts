import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import {
  buildApplicationOutcomeSnapshot,
  getLatestApplicationOutcomeSnapshot,
  saveApplicationOutcomeSnapshot,
} from "@/lib/applications/outcomes";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();
    const snapshot = await getLatestApplicationOutcomeSnapshot(user.id);
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to load application outcomes",
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const user = await requireAppUser();
    const snapshot = await buildApplicationOutcomeSnapshot(user.id);
    await saveApplicationOutcomeSnapshot(snapshot);
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to build application outcomes",
      },
      { status: 500 }
    );
  }
}
