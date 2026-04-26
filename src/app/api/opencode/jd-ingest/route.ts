import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { ingestJobDocument } from "@/lib/opencode/jd-ingest";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAppUser();
    const body = (await request.json()) as { sourceUrl?: string; rawText?: string };
    if (!body.sourceUrl?.trim() && !body.rawText?.trim()) {
      return NextResponse.json({ error: "sourceUrl or rawText is required" }, { status: 400 });
    }
    const result = await ingestJobDocument(body);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "JD ingest failed" },
      { status: 500 }
    );
  }
}
