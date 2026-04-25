import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { getApplicationLogs } from "@/lib/applications/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();
    const logs = await getApplicationLogs(user.id, 200);
    return NextResponse.json({ success: true, logs });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to load application logs",
      },
      { status: 500 }
    );
  }
}
