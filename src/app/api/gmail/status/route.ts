import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { getGmailConnectionStatus } from "@/lib/applications/gmail";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAppUser();
    const status = await getGmailConnectionStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to load Gmail status",
      },
      { status: 500 }
    );
  }
}
