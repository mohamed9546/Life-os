import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai/client";
import { readCollection, writeCollection } from "@/lib/storage";

interface SalaryResult {
  id: string; role: string; location: string;
  p25: number; median: number; p75: number;
  currency: string; note?: string; savedAt: string;
}

export async function GET() {
  const history = await readCollection<SalaryResult>("salary-data");
  return NextResponse.json({ history });
}

export async function POST(req: NextRequest) {
  const { role, location } = await req.json();

  const prompt = `Provide a realistic salary range for: "${role}"${location ? ` in ${location}` : ""}.
Return JSON only: { "p25": <number>, "median": <number>, "p75": <number>, "currency": "GBP", "note": "<source caveat>" }
All values as annual gross integers.`;

  const result = await callAI({ taskType: "salary-lookup", prompt, maxTokens: 300 });

  if (!result.success) return NextResponse.json({ salary: null }, { status: 500 });

  const data = result.data as { p25: number; median: number; p75: number; currency: string; note?: string };
  const salary: SalaryResult = {
    id: crypto.randomUUID(),
    role,
    location: location ?? "",
    ...data,
    savedAt: new Date().toISOString(),
  };
  const history = await readCollection<SalaryResult>("salary-data");
  history.unshift(salary);
  await writeCollection<SalaryResult>("salary-data", history.slice(0, 20));

  return NextResponse.json({ salary });
}
