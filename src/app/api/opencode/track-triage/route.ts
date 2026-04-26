import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { triageTrackText } from "@/lib/opencode/track-triage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAppUser();
    const body = (await request.json()) as { text?: string };
    if (!body.text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    return NextResponse.json({ success: true, result: triageTrackText(body.text) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Track triage failed" },
      { status: 500 }
    );
  }
}
