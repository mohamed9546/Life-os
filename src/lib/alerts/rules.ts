import { readCollection } from "@/lib/storage";
import { differenceInDays, parseISO } from "date-fns";

export interface Alert { type: string; title: string; body: string; severity: "info" | "warning" | "error"; module: string; }

export async function evaluateAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  const [budgets, decisions, goals, routines] = await Promise.all([
    readCollection<Record<string,unknown>>("budgets").catch(() => []),
    readCollection<Record<string,unknown>>("decisions").catch(() => []),
    readCollection<Record<string,unknown>>("goals").catch(() => []),
    readCollection<Record<string,unknown>>("routines").catch(() => []),
  ]);

  // Budget alerts
  (budgets as {category?:string; spent?:number; monthlyLimit?:number}[]).forEach(b => {
    const pct = ((b.spent??0) / (b.monthlyLimit??1)) * 100;
    if (pct >= 90) alerts.push({ type: "budget_critical", title: `${b.category} budget critical`, body: `Spent ${pct.toFixed(0)}% of £${b.monthlyLimit} limit.`, severity: "error", module: "money" });
    else if (pct >= 80) alerts.push({ type: "budget_warning", title: `${b.category} budget at ${pct.toFixed(0)}%`, body: `£${((b.monthlyLimit??0)-(b.spent??0)).toFixed(0)} remaining this month.`, severity: "warning", module: "money" });
  });

  // Overdue decisions
  (decisions as {status?:string; reviewDate?:string; title?:string}[])
    .filter(d => d.status === "open" && d.reviewDate)
    .forEach(d => {
      const days = differenceInDays(new Date(), parseISO(d.reviewDate!));
      if (days > 0) alerts.push({ type: "decision_overdue", title: `Decision overdue: ${d.title}`, body: `Review date was ${days} day${days>1?"s":""} ago.`, severity: "warning", module: "decisions" });
    });

  // Goal deadlines in 7 days
  (goals as {status?:string; targetDate?:string; title?:string}[])
    .filter(g => g.status === "active" && g.targetDate)
    .forEach(g => {
      const days = differenceInDays(parseISO(g.targetDate!), new Date());
      if (days >= 0 && days <= 7) alerts.push({ type: "goal_deadline", title: `Goal due soon: ${g.title}`, body: `${days} day${days!==1?"s":""} remaining.`, severity: days <= 2 ? "error" : "warning", module: "goals" });
    });

  return alerts;
}
