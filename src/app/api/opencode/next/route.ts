import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { getNextAction } from "@/lib/opencode/next-action";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const body = (await request.json().catch(() => ({}))) as { energy?: number };
    const result = await getNextAction(user.id, body.energy || 3);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to compute next action" },
      { status: 500 }
    );
  }
}
