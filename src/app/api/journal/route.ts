import { NextRequest, NextResponse } from "next/server";
import { readCollection, writeCollection } from "@/lib/storage";

interface JournalEntry { id: string; date: string; mood: number; energy: number; body: string; tags: string[]; createdAt: string; }

export async function GET() {
  const entries = await readCollection<JournalEntry>("journal");
  return NextResponse.json({ entries: entries.sort((a, b) => b.date.localeCompare(a.date)) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const entries = await readCollection<JournalEntry>("journal");
  const entry: JournalEntry = {
    id: crypto.randomUUID(),
    date: body.date ?? new Date().toISOString().slice(0, 10),
    mood: Number(body.mood ?? 3),
    energy: Number(body.energy ?? 3),
    body: body.body ?? "",
    tags: body.tags ?? [],
    createdAt: new Date().toISOString(),
  };
  const existing = entries.findIndex(e => e.date === entry.date);
  if (existing >= 0) entries[existing] = { ...entries[existing], ...entry };
  else entries.push(entry);
  await writeCollection<JournalEntry>("journal", entries);
  return NextResponse.json({ entry });
}
