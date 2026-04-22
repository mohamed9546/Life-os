import { NextResponse } from "next/server";
import { readCollection, Collections } from "@/lib/storage";
// Collections.ROUTINES, DECISIONS, TRANSACTIONS used below
import { differenceInDays, parseISO } from "date-fns";

export const dynamic = "force-dynamic";

async function safeRead<T>(collection: string): Promise<T[]> {
  try { return await readCollection<T>(collection); }
  catch { return []; }
}

export async function GET() {
  const [goals, routines, decisions, budgets, contacts, healthLog] = await Promise.all([
    safeRead<Record<string, unknown>>("goals"),
    safeRead<Record<string, unknown>>(Collections.ROUTINES),
    safeRead<Record<string, unknown>>(Collections.DECISIONS),
    safeRead<Record<string, unknown>>("budgets"),
    safeRead<Record<string, unknown>>("contacts"),
    safeRead<Record<string, unknown>>("health-log"),
  ]);

  const modules = [];

  // Goals score
  const active = (goals as { status?: string; progress?: number }[]).filter((g) => g.status === "active");
  const avgProgress = active.length ? active.reduce((s, g) => s + (g.progress ?? 0), 0) / active.length : 0;
  const goalsScore = active.length === 0 ? 40 : Math.min(100, Math.round(avgProgress));
  modules.push({ module: "goals", label: "Goals", score: goalsScore, detail: `${active.length} active goals, ${avgProgress.toFixed(0)}% avg progress`, trend: goalsScore >= 60 ? "up" : "flat" as const });

  // Routines score
  const today = new Date().toISOString().slice(0, 10);
  const recentRoutines = (routines as { lastCheckedIn?: string; frequency?: string }[]);
  const checkedToday = recentRoutines.filter((r) => r.lastCheckedIn?.startsWith(today)).length;
  const routineScore = recentRoutines.length === 0 ? 30 : Math.min(100, Math.round((checkedToday / recentRoutines.length) * 100));
  modules.push({ module: "routines", label: "Routines", score: routineScore, detail: `${checkedToday}/${recentRoutines.length} done today`, trend: routineScore >= 70 ? "up" : routineScore >= 30 ? "flat" : "down" as const });

  // Decisions score
  const openDecisions = (decisions as { status?: string; reviewDate?: string }[]).filter((d) => d.status === "open");
  const overdue = openDecisions.filter((d) => d.reviewDate && differenceInDays(new Date(), parseISO(d.reviewDate)) > 0).length;
  const decisionScore = openDecisions.length === 0 ? 80 : Math.min(100, Math.round(100 - (overdue / openDecisions.length) * 50));
  modules.push({ module: "decisions", label: "Decisions", score: decisionScore, detail: `${openDecisions.length} open, ${overdue} overdue`, trend: overdue > 0 ? "down" : "flat" as const });

  // Finances score
  const budgetItems = (budgets as { spent?: number; monthlyLimit?: number }[]);
  const criticalBudgets = budgetItems.filter((b) => b.monthlyLimit && (b.spent ?? 0) / b.monthlyLimit > 0.9).length;
  const financeScore = budgetItems.length === 0 ? 50 : Math.min(100, Math.round(100 - (criticalBudgets / budgetItems.length) * 60));
  modules.push({ module: "money", label: "Finances", score: financeScore, detail: `${criticalBudgets} budget${criticalBudgets !== 1 ? "s" : ""} at critical level`, trend: criticalBudgets > 0 ? "down" : "up" as const });

  // Contacts score
  const staleContacts = (contacts as { lastContact?: string }[]).filter((c) => {
    if (!c.lastContact) return true;
    return differenceInDays(new Date(), parseISO(c.lastContact)) > 60;
  }).length;
  const contactScore = contacts.length === 0 ? 40 : Math.min(100, Math.round(100 - (staleContacts / contacts.length) * 60));
  modules.push({ module: "contacts", label: "Network", score: contactScore, detail: `${staleContacts} contacts need follow-up`, trend: staleContacts > contacts.length * 0.4 ? "down" : "flat" as const });

  // Health score
  const recentHealth = (healthLog as { date: string; energy?: number; mood?: number }[])
    .filter((h) => differenceInDays(new Date(), parseISO(h.date)) <= 7);
  const avgWellness = recentHealth.length ? recentHealth.reduce((s, h) => s + ((h.energy ?? 3) + (h.mood ?? 3)) / 2, 0) / recentHealth.length : 0;
  const healthScore = recentHealth.length === 0 ? 30 : Math.min(100, Math.round((avgWellness / 5) * 100));
  modules.push({ module: "health", label: "Wellbeing", score: healthScore, detail: `${recentHealth.length} entries this week, avg ${avgWellness.toFixed(1)}/5`, trend: healthScore >= 60 ? "up" : "flat" as const });

  const overall = Math.round(modules.reduce((s, m) => s + m.score, 0) / modules.length);

  return NextResponse.json({
    overall,
    modules: modules.map((m) => ({ ...m, trend: m.trend })),
    generatedAt: new Date().toISOString(),
  });
}
