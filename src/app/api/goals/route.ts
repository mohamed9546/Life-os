import { NextRequest, NextResponse } from "next/server";
import { readCollection, writeCollection } from "@/lib/storage";

interface Milestone { title: string; done: boolean; }
interface Goal { id: string; title: string; category: string; targetDate?: string; milestones: Milestone[]; notes?: string; status: "active" | "done" | "paused"; createdAt: string; }

export async function GET() {
  const goals = await readCollection<Goal>("goals");
  return NextResponse.json({ goals });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const goals = await readCollection<Goal>("goals");
  const goal: Goal = {
    id: crypto.randomUUID(),
    title: body.title,
    category: body.category ?? "life",
    targetDate: body.targetDate,
    milestones: (body.milestones ?? []).map((t: string) => ({ title: t, done: false })),
    notes: body.notes,
    status: "active",
    createdAt: new Date().toISOString(),
  };
  goals.push(goal);
  await writeCollection<Goal>("goals", goals);
  return NextResponse.json({ goal });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const goals = await readCollection<Goal>("goals");
  const updated = goals.map(g => g.id === body.id ? { ...g, ...body } : g);
  await writeCollection<Goal>("goals", updated);
  return NextResponse.json({ goal: updated.find(g => g.id === body.id) });
}
