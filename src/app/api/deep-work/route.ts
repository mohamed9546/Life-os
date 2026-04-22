import { NextRequest, NextResponse } from "next/server";
import { readCollection, appendToCollection } from "@/lib/storage";

export const dynamic = "force-dynamic";
const COLLECTION = "deep-work-sessions";

export async function GET() {
  try {
    const sessions = await readCollection<Record<string, unknown>>(COLLECTION);
    return NextResponse.json({ sessions: sessions.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? ""))) });
  } catch { return NextResponse.json({ sessions: [] }); }
}

export async function POST(request: NextRequest) {
  try {
    const { session } = await request.json() as { session: Record<string, unknown> };
    await appendToCollection(COLLECTION, [session]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
