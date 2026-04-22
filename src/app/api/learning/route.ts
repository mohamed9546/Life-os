import { NextRequest, NextResponse } from "next/server";
import { readCollection, writeCollection } from "@/lib/storage";

interface LearningItem { id: string; title: string; type: string; url?: string; status: "queue" | "in-progress" | "done"; notes?: string; rating?: number; completedDate?: string; createdAt: string; }

export async function GET() {
  const items = await readCollection<LearningItem>("learning");
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const items = await readCollection<LearningItem>("learning");
  const item: LearningItem = {
    id: crypto.randomUUID(),
    title: body.title,
    type: body.type ?? "book",
    url: body.url,
    status: body.status ?? "queue",
    notes: body.notes,
    rating: body.rating,
    completedDate: body.completedDate,
    createdAt: new Date().toISOString(),
  };
  items.push(item);
  await writeCollection<LearningItem>("learning", items);
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const items = await readCollection<LearningItem>("learning");
  const updated = items.map(i => i.id === body.id ? { ...i, ...body } : i);
  await writeCollection<LearningItem>("learning", updated);
  return NextResponse.json({ item: updated.find(i => i.id === body.id) });
}
