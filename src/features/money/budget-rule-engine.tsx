"use client";

import { useState, useEffect, useMemo } from "react";
import { Zap, TrendingUp, AlertTriangle, CheckCircle, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

interface Transaction { amount: number; date: string; category?: string; merchantCleaned?: string; }
interface Budget { category: string; limit: number; spent: number; }
interface Rule { id: string; condition: string; suggestion: string; severity: "critical" | "warning" | "info"; triggered: boolean; }

const RULE_50_30_20 = [
  { label: "Needs (50%)", pct: 0.5, categories: ["groceries", "food", "utilities", "transport", "rent", "insurance"] },
  { label: "Wants (30%)", pct: 0.3, categories: ["entertainment", "dining", "shopping", "subscriptions"] },
  { label: "Savings (20%)", pct: 0.2, categories: [] },
];

function fmt(n: number) {
  return `£${Math.abs(n).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export function BudgetRuleEngine() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/money").then(r => r.json()).then(d => setTransactions(d.transactions ?? [])).catch(() => {}),
      fetch("/api/money/budgets").then(r => r.json()).then(d => setBudgets(d.budgets ?? [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const last30Days = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return transactions.filter(t => new Date(t.date) >= cutoff && t.amount < 0);
  }, [transactions]);

  const monthlyIncome = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return transactions.filter(t => new Date(t.date) >= cutoff && t.amount > 0).reduce((s, t) => s + t.amount, 0) || 3000;
  }, [transactions]);

  const spending = useMemo(() => {
    const byCategory: Record<string, number> = {};
    last30Days.forEach(t => {
      const cat = (t.category || "uncategorized").toLowerCase();
      byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount);
    });
    return byCategory;
  }, [last30Days]);

  const totalSpend = useMemo(() => Object.values(spending).reduce((s, v) => s + v, 0), [spending]);

  const rules = useMemo((): Rule[] => {
    const result: Rule[] = [];

    const needsSpend = RULE_50_30_20[0].categories.reduce((s, c) => s + (spending[c] || 0), 0);
    const wantsSpend = RULE_50_30_20[1].categories.reduce((s, c) => s + (spending[c] || 0), 0);

    if (needsSpend > monthlyIncome * 0.55) {
      result.push({
        id: "50-30-20-needs",
        condition: `Needs spending (${fmt(needsSpend)}) exceeds 55% of income`,
        suggestion: "Review fixed costs — utilities, subscriptions, and food are your biggest levers.",
        severity: "critical",
        triggered: true,
      });
    }

    if (wantsSpend > monthlyIncome * 0.35) {
      result.push({
        id: "50-30-20-wants",
        condition: `Discretionary spending (${fmt(wantsSpend)}) exceeds 35% of income`,
        suggestion: "Set a weekly cash allowance for dining and entertainment to reduce wants spending.",
        severity: "warning",
        triggered: true,
      });
    }

    const savingsRate = (monthlyIncome - totalSpend) / monthlyIncome;
    if (savingsRate < 0.1) {
      result.push({
        id: "savings-rate",
        condition: `Savings rate ${Math.max(0, savingsRate * 100).toFixed(0)}% — below recommended 20%`,
        suggestion: "Automate a transfer of 10% of income to savings on payday before you can spend it.",
        severity: savingsRate < 0 ? "critical" : "warning",
        triggered: true,
      });
    }

    budgets.forEach(b => {
      if (b.spent > b.limit) {
        result.push({
          id: `budget-${b.category}`,
          condition: `${b.category} budget exceeded: ${fmt(b.spent)} vs ${fmt(b.limit)} limit`,
          suggestion: `Pause ${b.category} spending for the rest of the month or increase your budget limit.`,
          severity: b.spent > b.limit * 1.3 ? "critical" : "warning",
          triggered: true,
        });
      }
    });

    const topMerchants: Record<string, number> = {};
    last30Days.forEach(t => {
      const m = t.merchantCleaned || "unknown";
      topMerchants[m] = (topMerchants[m] || 0) + Math.abs(t.amount);
    });
    const [topName, topAmount] = Object.entries(topMerchants).sort(([,a],[,b]) => b - a)[0] || [];
    if (topName && topAmount > monthlyIncome * 0.1) {
      result.push({
        id: "top-merchant",
        condition: `${topName} accounts for ${fmt(topAmount)} (${Math.round(topAmount/monthlyIncome*100)}% of income)`,
        suggestion: `${topName} is your single biggest expense. Review if this is intentional and necessary.`,
        severity: "info",
        triggered: true,
      });
    }

    if (result.length === 0) {
      result.push({
        id: "all-clear",
        condition: "All budget rules passing",
        suggestion: "Your spending is within healthy ranges. Consider increasing your savings rate.",
        severity: "info",
        triggered: false,
      });
    }

    return result;
  }, [spending, budgets, monthlyIncome, totalSpend, last30Days]);

  const sev = { critical: "border-danger text-danger", warning: "border-warning text-warning", info: "border-info text-info" };
  const sevIcon = { critical: AlertTriangle, warning: AlertTriangle, info: CheckCircle };

  if (loading) return <div className="skeleton h-48 rounded-xl" />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center py-3">
          <p className="text-2xs text-text-tertiary mb-1">Monthly Income</p>
          <p className="text-lg font-mono font-bold text-success">{fmt(monthlyIncome)}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xs text-text-tertiary mb-1">30-Day Spend</p>
          <p className="text-lg font-mono font-bold text-danger">{fmt(totalSpend)}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xs text-text-tertiary mb-1">Savings Rate</p>
          <p className={`text-lg font-mono font-bold ${monthlyIncome > totalSpend ? "text-success" : "text-danger"}`}>
            {Math.max(0, Math.round((monthlyIncome - totalSpend) / monthlyIncome * 100))}%
          </p>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Zap size={14} className="text-accent" /> 50/30/20 Rule Analysis
        </h3>
        {RULE_50_30_20.map(rule => {
          const spend = rule.categories.reduce((s, c) => s + (spending[c] || 0), 0);
          const target = monthlyIncome * rule.pct;
          const pct = Math.min(100, (spend / target) * 100);
          const over = spend > target;
          return (
            <div key={rule.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-secondary">{rule.label}</span>
                <span className={over ? "text-danger font-semibold" : "text-text-tertiary"}>
                  {fmt(spend)} / {fmt(target)}
                </span>
              </div>
              <div className="progress-bar">
                <div className={`progress-fill ${over ? "bg-danger" : "bg-accent"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <TrendingUp size={14} /> Smart Suggestions
        </h3>
        {rules.map(rule => {
          const Icon = sevIcon[rule.severity];
          return (
            <div key={rule.id} className={`card border-l-4 ${sev[rule.severity].split(" ")[0]} space-y-1`}>
              <div className="flex items-start gap-2">
                <Icon size={14} className={`mt-0.5 flex-shrink-0 ${sev[rule.severity].split(" ")[1]}`} />
                <div>
                  <p className="text-sm font-medium text-text-primary">{rule.condition}</p>
                  <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-1">
                    <ChevronRight size={10} className="flex-shrink-0" /> {rule.suggestion}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
