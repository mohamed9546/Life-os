import { NextRequest, NextResponse } from "next/server";
import { readCollection, writeCollection } from "@/lib/storage";

export const dynamic = "force-dynamic";

const COLLECTION = "health-log";

interface HealthEntry {
  id: string;
  date: string;
  energy: number;
  mood: number;
  sleep: number;
  sleepQuality: number;
  notes: string;
  createdAt: string;
}

export async function GET() {
  try {
    const entries = await readCollection<HealthEntry>(COLLECTION);
    return NextResponse.json({ entries: entries.sort((a, b) => b.date.localeCompare(a.date)) });
  } catch {
    return NextResponse.json({ entries: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<HealthEntry>;
    const date = body.date || new Date().toISOString().slice(0, 10);

    const entries = await readCollection<HealthEntry>(COLLECTION);
    const existing = entries.find((e) => e.date === date);

    const entry: HealthEntry = {
      id: existing?.id || `health-${Date.now()}`,
      date,
      energy: body.energy ?? 3,
      mood: body.mood ?? 3,
      sleep: body.sleep ?? 7,
      sleepQuality: body.sleepQuality ?? 3,
      notes: body.notes || "",
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    const updated = existing
      ? entries.map((e) => (e.date === date ? entry : e))
      : [...entries, entry];

    await writeCollection(COLLECTION, updated);
    return NextResponse.json({ success: true, entry });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save health entry" },
      { status: 500 }
    );
  }
}
