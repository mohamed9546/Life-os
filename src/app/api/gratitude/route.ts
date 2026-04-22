import { NextRequest, NextResponse } from "next/server";
import { readCollection, writeCollection } from "@/lib/storage";

export const dynamic = "force-dynamic";
const COLLECTION = "gratitude-log";

interface GratitudeEntry { id: string; date: string; items: string[]; mood: number; createdAt: string; }

export async function GET() {
  try {
    const entries = await readCollection<GratitudeEntry>(COLLECTION);
    return NextResponse.json({ entries: entries.sort((a, b) => b.date.localeCompare(a.date)) });
  } catch { return NextResponse.json({ entries: [] }); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<GratitudeEntry>;
    const date = body.date || new Date().toISOString().slice(0, 10);
    const entries = await readCollection<GratitudeEntry>(COLLECTION);
    const existing = entries.find((e) => e.date === date);
    const entry: GratitudeEntry = {
      id: existing?.id || `gratitude-${Date.now()}`,
      date,
      items: body.items || [],
      mood: body.mood ?? 3,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    const updated = existing ? entries.map((e) => e.date === date ? entry : e) : [...entries, entry];
    await writeCollection(COLLECTION, updated);
    return NextResponse.json({ success: true, entry });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
