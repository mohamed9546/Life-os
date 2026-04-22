import { NextRequest, NextResponse } from "next/server";
import { readCollection, writeCollection } from "@/lib/storage";

interface Budget { id: string; category: string; monthlyLimit: number; month: string; spent: number; }

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const budgets = await readCollection<Budget>("budgets");
  const updated = budgets.map(b => b.id === params.id ? { ...b, ...body } : b);
  await writeCollection<Budget>("budgets", updated);
  return NextResponse.json({ budget: updated.find(b => b.id === params.id) });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const budgets = await readCollection<Budget>("budgets");
  await writeCollection<Budget>("budgets", budgets.filter(b => b.id !== params.id));
  return NextResponse.json({ ok: true });
}
