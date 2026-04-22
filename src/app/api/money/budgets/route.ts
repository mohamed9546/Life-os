import { NextRequest, NextResponse } from "next/server";
import { readCollection, writeCollection } from "@/lib/storage";

export const dynamic = "force-dynamic";
const COLLECTION = "money-budgets";

interface Budget {
  id: string;
  category: string;
  limit: number;
  spent: number;
  period: "monthly" | "weekly";
  createdAt: string;
}

export async function GET() {
  try {
    const budgets = await readCollection<Budget>(COLLECTION);
    return NextResponse.json({ budgets });
  } catch {
    return NextResponse.json({ budgets: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<Budget>;
    const budgets = await readCollection<Budget>(COLLECTION);
    const budget: Budget = {
      id: `budget-${Date.now()}`,
      category: body.category || "General",
      limit: body.limit || 0,
      spent: body.spent || 0,
      period: body.period || "monthly",
      createdAt: new Date().toISOString(),
    };
    await writeCollection(COLLECTION, [...budgets, budget]);
    return NextResponse.json({ success: true, budget });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
