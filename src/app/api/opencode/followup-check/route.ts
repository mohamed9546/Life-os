import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { generateFollowUpDrafts } from "@/lib/opencode/followup-check";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireAppUser();
    const result = await generateFollowUpDrafts(user.id);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Follow-up generation failed" },
      { status: 500 }
    );
  }
}
