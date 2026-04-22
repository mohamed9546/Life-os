import { NextRequest, NextResponse } from "next/server";
import { readCollection, writeCollection } from "@/lib/storage";

interface Budget {
  id: string;
  category: string;
  monthlyLimit: number;
  month: string;
  spent: number;
}

export async function GET() {
  const budgets = await readCollection<Budget>("budgets");
  return NextResponse.json({ budgets });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const budgets = await readCollection<Budget>("budgets");
  const month = new Date().toISOString().slice(0, 7);
  const budget: Budget = {
    id: crypto.randomUUID(),
    category: body.category,
    monthlyLimit: Number(body.monthlyLimit),
    month,
    spent: 0,
  };
  budgets.push(budget);
  await writeCollection<Budget>("budgets", budgets);
  return NextResponse.json({ budget });
}
