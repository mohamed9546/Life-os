import { NextResponse } from "next/server";
import { readCollection, Collections } from "@/lib/storage";
// Collections used below for ROUTINES, DECISIONS, TRANSACTIONS
import { callAI } from "@/lib/ai/client";
import { differenceInDays, parseISO } from "date-fns";

export const dynamic = "force-dynamic";

async function safeRead<T>(col: string): Promise<T[]> {
  try { return await readCollection<T>(col); } catch { return []; }
}

export async function POST() {
  const today = new Date().toISOString().slice(0, 10);

  const [goals, routines, decisions, transactions, contacts] = await Promise.all([
    safeRead<Record<string, unknown>>("goals"),
    safeRead<Record<string, unknown>>(Collections.ROUTINES),
    safeRead<Record<string, unknown>>(Collections.DECISIONS),
    safeRead<Record<string, unknown>>(Collections.TRANSACTIONS),
    safeRead<Record<string, unknown>>("contacts"),
  ]);

  const activeGoals = (goals as { status?: string; title?: string; progress?: number }[])
    .filter((g) => g.status === "active").slice(0, 5);

  const pendingRoutines = (routines as { title?: string; lastCheckedIn?: string }[])
    .filter((r) => !r.lastCheckedIn?.startsWith(today)).slice(0, 5);

  const overdueDecisions = (decisions as { status?: string; reviewDate?: string; title?: string }[])
    .filter((d) => d.status === "open" && d.reviewDate && differenceInDays(new Date(), parseISO(d.reviewDate)) > 0);

  const recentSpend = (transactions as { amount?: number; date?: string }[])
    .filter((t) => (t.amount ?? 0) < 0 && t.date && differenceInDays(new Date(), parseISO(t.date)) <= 7)
    .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);

  const staleContacts = (contacts as { lastContact?: string; name?: string }[])
    .filter((c) => !c.lastContact || differenceInDays(new Date(), parseISO(c.lastContact)) > 30).length;

  const contextSummary = [
    `Active goals: ${activeGoals.map((g) => `${g.title} (${g.progress ?? 0}%)`).join(", ") || "none"}`,
    `Routines not yet done today: ${pendingRoutines.map((r) => r.title).join(", ") || "all done!"}`,
    `Overdue decisions: ${overdueDecisions.map((d) => d.title).join(", ") || "none"}`,
    `Spending this week: £${recentSpend.toFixed(0)}`,
    `Contacts needing follow-up: ${staleContacts}`,
  ].join("\n");

  const prompt = `Generate a morning briefing for a professional. Return ONLY valid JSON.

Context:
${contextSummary}

Return JSON:
{
  "greeting": "Good morning greeting (mention day of week)",
  "priorities": ["top priority 1", "priority 2", "priority 3"],
  "financialSnapshot": "one sentence about finances based on context",
  "careerUpdate": "one sentence career/job advice",
  "habitReminder": "one sentence about routines/habits based on context",
  "motivationalNote": "brief inspirational or practical closing note"
}`;

  try {
    const result = await callAI({ taskType: "summarize-week", prompt });
    const data = typeof result.data === "string" ? JSON.parse(result.data) : result.data;
    const briefing = { ...data, generatedAt: new Date().toISOString() };
    return NextResponse.json({ briefing });
  } catch {
    // Fallback if AI fails
    const briefing = {
      greeting: `Good morning! Let's make today count.`,
      priorities: [
        activeGoals[0] ? `Progress on: ${activeGoals[0].title}` : "Review your active goals",
        pendingRoutines[0] ? `Complete routine: ${pendingRoutines[0].title}` : "Complete your daily routines",
        overdueDecisions[0] ? `Review overdue decision: ${overdueDecisions[0].title}` : "Stay on top of your decisions",
      ],
      financialSnapshot: `You've spent £${recentSpend.toFixed(0)} this week.`,
      careerUpdate: "Review your tracked jobs and follow up with contacts.",
      habitReminder: `${pendingRoutines.length} routine${pendingRoutines.length !== 1 ? "s" : ""} left to complete today.`,
      motivationalNote: "Small consistent actions compound into extraordinary results.",
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json({ briefing });
  }
}
