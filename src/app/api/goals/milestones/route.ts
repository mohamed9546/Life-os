import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai/client";
import { differenceInWeeks, parseISO } from "date-fns";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { goalId, title, description, targetDate } = await request.json() as {
      goalId: string; title: string; description?: string; targetDate?: string;
    };

    const weeksLeft = targetDate ? Math.max(4, differenceInWeeks(parseISO(targetDate), new Date())) : 8;
    const milestoneCount = Math.min(weeksLeft, 8);

    const prompt = `Break this goal into ${milestoneCount} concrete weekly milestones. Return ONLY valid JSON.

Goal: ${title}
${description ? `Description: ${description}` : ""}
${targetDate ? `Target date: ${targetDate} (${weeksLeft} weeks away)` : ""}

Return JSON array:
[
  { "week": 1, "title": "Specific action for week 1" },
  { "week": 2, "title": "Specific action for week 2" }
]

Make milestones specific, measurable, and progressive. Start simple, build momentum.`;

    const result = await callAI({ taskType: "summarize-decision", prompt });

    if (result.error || !result.data) {
      return NextResponse.json({ error: result.error || "AI failed" }, { status: 500 });
    }

    const raw = typeof result.data === "string" ? JSON.parse(result.data) : result.data;
    const arr = Array.isArray(raw) ? raw : raw.milestones ?? [];
    const milestones = arr.map((m: { week: number; title: string }, i: number) => ({
      id: `ms-${goalId}-${i}-${Date.now()}`,
      week: m.week ?? i + 1,
      title: m.title || `Milestone ${i + 1}`,
      completed: false,
    }));

    return NextResponse.json({ milestones });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
