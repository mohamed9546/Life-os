"use client";

import { useMemo, useState } from "react";
import { RefreshCw, X, TrendingDown } from "lucide-react";
import toast from "react-hot-toast";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
}

interface DetectedSub {
  name: string;
  amount: number;
  frequency: "monthly" | "annual" | "weekly";
  lastCharged: string;
  transactions: Transaction[];
  annualCost: number;
}

function fmt(n: number) {
  return `£${Math.abs(n).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
}

function detectSubscriptions(transactions: Transaction[]): DetectedSub[] {
  const byMerchant: Record<string, Transaction[]> = {};

  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const key = t.description
      .toLowerCase()
      .replace(/\s+\d{4,}.*$/, "")
      .replace(/[^a-z0-9 ]/g, "")
      .trim()
      .slice(0, 30);
    if (!byMerchant[key]) byMerchant[key] = [];
    byMerchant[key].push(t);
  }

  const subs: DetectedSub[] = [];

  for (const [name, txs] of Object.entries(byMerchant)) {
    if (txs.length < 2) continue;

    const sorted = txs.sort((a, b) => b.date.localeCompare(a.date));
    const amounts = sorted.map((t) => Math.abs(t.amount));
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const maxDeviation = Math.max(...amounts.map((a) => Math.abs(a - avgAmount)));

    if (maxDeviation > avgAmount * 0.2) continue;

    const gaps: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = (new Date(sorted[i].date).getTime() - new Date(sorted[i + 1].date).getTime()) / (1000 * 60 * 60 * 24);
      gaps.push(gap);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

    let frequency: "monthly" | "annual" | "weekly" = "monthly";
    let annualCost = avgAmount * 12;

    if (avgGap < 10) { frequency = "weekly"; annualCost = avgAmount * 52; }
    else if (avgGap > 60 && avgGap < 380) { frequency = "annual"; annualCost = avgAmount; }

    subs.push({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      amount: avgAmount,
      frequency,
      lastCharged: sorted[0].date,
      transactions: sorted.slice(0, 5),
      annualCost,
    });
  }

  return subs.sort((a, b) => b.annualCost - a.annualCost);
}

export function SubscriptionTracker({ transactions }: { transactions: Transaction[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const subs = useMemo(() => detectSubscriptions(transactions), [transactions]);
  const visible = subs.filter((s) => !dismissed.has(s.name));
  const totalAnnual = visible.reduce((s, sub) => s + sub.annualCost, 0);
  const totalMonthly = totalAnnual / 12;

  if (subs.length === 0) {
    return (
      <div className="card text-center py-10 text-text-secondary text-sm">
        No recurring expenses detected yet. Add more transactions to see your subscriptions.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center py-3">
          <p className="text-2xs text-text-tertiary mb-1">Subscriptions Found</p>
          <p className="text-2xl font-bold text-text-primary">{visible.length}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xs text-text-tertiary mb-1">Monthly Total</p>
          <p className="text-lg font-mono font-bold text-danger">{fmt(totalMonthly)}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xs text-text-tertiary mb-1">Annual Total</p>
          <p className="text-lg font-mono font-bold text-danger">{fmt(totalAnnual)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {visible.map((sub) => (
          <div key={sub.name} className="card flex items-center gap-4">
            <div className="w-9 h-9 rounded-full bg-accent-subtle flex items-center justify-center flex-shrink-0">
              <TrendingDown size={16} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-text-primary truncate">{sub.name}</p>
                <span className="badge-neutral capitalize">{sub.frequency}</span>
              </div>
              <p className="text-xs text-text-tertiary mt-0.5">
                Last: {new Date(sub.lastCharged).toLocaleDateString("en-GB")} · {sub.transactions.length} occurrences detected
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-mono font-semibold text-danger">{fmt(sub.amount)}/{sub.frequency === "weekly" ? "wk" : sub.frequency === "annual" ? "yr" : "mo"}</p>
              <p className="text-2xs text-text-tertiary">{fmt(sub.annualCost)}/yr</p>
            </div>
            <button
              onClick={() => {
                setDismissed((d) => new Set([...d, sub.name]));
                toast.success(`${sub.name} dismissed`);
              }}
              className="text-text-tertiary hover:text-text-primary ml-1"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {dismissed.size > 0 && (
        <button
          onClick={() => setDismissed(new Set())}
          className="btn-ghost btn-sm flex items-center gap-2"
        >
          <RefreshCw size={12} /> Show {dismissed.size} dismissed
        </button>
      )}
    </div>
  );
}
