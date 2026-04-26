import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { scoreAtsText } from "@/lib/opencode/ats-score";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAppUser();
    const body = (await request.json()) as { jobText?: string; cvText?: string };
    if (!body.jobText?.trim() || !body.cvText?.trim()) {
      return NextResponse.json({ error: "jobText and cvText are required" }, { status: 400 });
    }
    return NextResponse.json({ success: true, result: scoreAtsText(body.jobText, body.cvText) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ATS scoring failed" },
      { status: 500 }
    );
  }
}
