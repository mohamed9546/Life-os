import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { grabPaperNote } from "@/lib/opencode/paper-grab";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAppUser();
    const body = (await request.json()) as { identifier?: string };
    if (!body.identifier?.trim()) {
      return NextResponse.json({ error: "identifier is required" }, { status: 400 });
    }
    const note = await grabPaperNote(body.identifier.trim());
    return NextResponse.json({ success: true, note });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Paper capture failed" },
      { status: 500 }
    );
  }
}
