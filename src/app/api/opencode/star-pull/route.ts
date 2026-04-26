import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { findStarStories } from "@/lib/opencode/star-bank";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAppUser();
    const body = (await request.json()) as { question?: string };
    if (!body.question?.trim()) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }
    const stories = await findStarStories(body.question);
    return NextResponse.json({ success: true, stories });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "STAR retrieval failed" },
      { status: 500 }
    );
  }
}
