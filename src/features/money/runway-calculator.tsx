"use client";

import { useState, useEffect, useMemo } from "react";
import { TrendingDown, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Transaction { amount: number; date: string; }
interface Snapshot { netWorth: number; assets: Record<string, number>; }

function fmt(n: number) {
  return `£${Math.abs(n).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface-2)",
  border: "1px solid var(--surface-3)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--text-primary)",
};

export function RunwayCalculator() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [latestSnapshot, setLatestSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/money").then(r => r.json()).then(d => setTransactions(d.transactions ?? [])).catch(() => {}),
      fetch("/api/net-worth").then(r => r.json()).then(d => {
        const snapshots = d.snapshots ?? [];
        if (snapshots.length > 0) setLatestSnapshot(snapshots[snapshots.length - 1]);
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const analysis = useMemo(() => {
    if (!latestSnapshot) return null;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const last30 = transactions.filter(t => new Date(t.date) >= thirtyDaysAgo && t.amount < 0);
    const last90 = transactions.filter(t => new Date(t.date) >= ninetyDaysAgo && t.amount < 0);

    const monthlySpend30 = Math.abs(last30.reduce((s, t) => s + t.amount, 0));
    const monthlySpend90 = Math.abs(last90.reduce((s, t) => s + t.amount, 0)) / 3;
    const avgMonthlySpend = (monthlySpend30 + monthlySpend90) / 2 || 2000;

    const cashAssets =
      (latestSnapshot.assets["Cash"] || 0) +
      (latestSnapshot.assets["Investments"] || 0) * 0.9;

    const runwayMonths = cashAssets / avgMonthlySpend;
    const projectionMonths = Math.min(Math.ceil(runwayMonths) + 6, 36);
    const projection = Array.from({ length: projectionMonths }, (_, i) => ({
      month: i === 0 ? "Now" : `M${i}`,
      balance: Math.max(0, cashAssets - avgMonthlySpend * i),
    }));

    return {
      cashAssets, avgMonthlySpend, runwayMonths, projection,
      status: runwayMonths < 3 ? "critical" : runwayMonths < 6 ? "warning" : runwayMonths < 12 ? "good" : "excellent",
    };
  }, [transactions, latestSnapshot]);

  if (loading) return <div className="skeleton h-48 rounded-xl" />;

  if (!latestSnapshot) {
    return (
      <div className="card text-center py-10 text-text-secondary text-sm">
        Add a net worth snapshot to calculate your financial runway.
      </div>
    );
  }

  if (!analysis) return null;

  const STATUS_MAP = {
    critical: { color: "text-danger", icon: AlertTriangle, label: "Critical — less than 3 months" },
    warning: { color: "text-warning", icon: AlertTriangle, label: "Low — 3–6 months" },
    good: { color: "text-info", icon: Clock, label: "Comfortable — 6–12 months" },
    excellent: { color: "text-success", icon: CheckCircle, label: "Strong — 12+ months" },
  } as const;
  const statusConfig = STATUS_MAP[analysis.status as keyof typeof STATUS_MAP] ?? STATUS_MAP.good;

  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center py-3">
          <p className="text-2xs text-text-tertiary mb-1">Liquid Assets</p>
          <p className="text-lg font-mono font-bold text-success">{fmt(analysis.cashAssets)}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xs text-text-tertiary mb-1">Monthly Burn</p>
          <p className="text-lg font-mono font-bold text-danger">{fmt(analysis.avgMonthlySpend)}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xs text-text-tertiary mb-1">Runway</p>
          <p className={`text-lg font-mono font-bold ${statusConfig.color}`}>
            {analysis.runwayMonths.toFixed(1)}mo
          </p>
        </div>
      </div>

      <div className={`card flex items-center gap-3 py-3 border-l-4 ${
        analysis.status === "critical" ? "border-danger" :
        analysis.status === "warning" ? "border-warning" :
        analysis.status === "good" ? "border-info" : "border-success"
      }`}>
        <StatusIcon size={20} className={statusConfig.color} />
        <div>
          <p className={`text-sm font-semibold ${statusConfig.color}`}>{statusConfig.label}</p>
          <p className="text-xs text-text-secondary mt-0.5">
            At {fmt(analysis.avgMonthlySpend)}/month, your liquid assets last until{" "}
            <strong>
              {new Date(Date.now() + analysis.runwayMonths * 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
            </strong>
          </p>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Balance Projection</h3>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={analysis.projection}>
            <defs>
              <linearGradient id="runwayGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} tickLine={false} tickFormatter={fmt} width={60} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [fmt(Number(v))]} />
            <Area type="monotone" dataKey="balance" stroke="#6366f1" fill="url(#runwayGrad)" strokeWidth={2} name="Balance" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Scenario Planner</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0.7, 0.85, 1.15, 1.3].map((multiplier) => {
            const scenario = analysis.avgMonthlySpend * multiplier;
            const months = analysis.cashAssets / scenario;
            return (
              <div key={multiplier} className="bg-surface-2 rounded-lg p-3 text-center">
                <p className="text-2xs text-text-tertiary">
                  {multiplier < 1 ? `-${Math.round((1 - multiplier) * 100)}%` : `+${Math.round((multiplier - 1) * 100)}%`} spend
                </p>
                <p className="text-sm font-mono font-semibold text-text-primary mt-1">{months.toFixed(1)} mo</p>
                <p className="text-2xs text-text-tertiary">{fmt(scenario)}/mo</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
