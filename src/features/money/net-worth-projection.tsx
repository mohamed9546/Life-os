"use client";

import { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Snapshot { netWorth: number; date: string; }

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `£${(n / 1_000).toFixed(0)}k`;
  return `£${n.toFixed(0)}`;
}

const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface-2)",
  border: "1px solid var(--surface-3)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--text-primary)",
};

export function NetWorthProjection() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [monthlySavings, setMonthlySavings] = useState(1000);
  const [annualReturn, setAnnualReturn] = useState(7);
  const [years, setYears] = useState(10);

  useEffect(() => {
    fetch("/api/net-worth").then(r => r.json()).then(d => setSnapshots(d.snapshots ?? [])).catch(() => {});
  }, []);

  const projection = useMemo(() => {
    const latest = snapshots[snapshots.length - 1];
    const startValue = latest?.netWorth ?? 0;
    const monthlyRate = annualReturn / 100 / 12;
    const months = years * 12;

    return Array.from({ length: months + 1 }, (_, m) => {
      const withReturns = monthlyRate > 0
        ? startValue * Math.pow(1 + monthlyRate, m) + monthlySavings * ((Math.pow(1 + monthlyRate, m) - 1) / monthlyRate)
        : startValue + monthlySavings * m;
      return {
        month: m % 12 === 0 ? `Yr ${m / 12}` : "",
        withReturns: Math.round(withReturns),
        noReturns: Math.round(startValue + monthlySavings * m),
      };
    }).filter(d => d.month);
  }, [snapshots, monthlySavings, annualReturn, years]);

  const finalValue = projection[projection.length - 1]?.withReturns ?? 0;
  const noReturnValue = projection[projection.length - 1]?.noReturns ?? 0;
  const returnsDelta = finalValue - noReturnValue;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center py-3">
          <p className="text-2xs text-text-tertiary mb-1">Projected in {years}yr</p>
          <p className="text-lg font-mono font-bold text-success">{fmt(finalValue)}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xs text-text-tertiary mb-1">Without Returns</p>
          <p className="text-lg font-mono font-bold text-text-primary">{fmt(noReturnValue)}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xs text-text-tertiary mb-1">Investment Gain</p>
          <p className="text-lg font-mono font-bold text-accent">{fmt(returnsDelta)}</p>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Adjust Assumptions</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-text-secondary">Monthly Savings</span>
              <span className="font-mono text-text-primary">{fmt(monthlySavings)}</span>
            </div>
            <input type="range" min={0} max={5000} step={50} value={monthlySavings}
              onChange={e => setMonthlySavings(Number(e.target.value))}
              className="w-full accent-accent" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-text-secondary">Annual Return</span>
              <span className="font-mono text-text-primary">{annualReturn}%</span>
            </div>
            <input type="range" min={0} max={20} step={0.5} value={annualReturn}
              onChange={e => setAnnualReturn(Number(e.target.value))}
              className="w-full accent-accent" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-text-secondary">Time Horizon</span>
              <span className="font-mono text-text-primary">{years} years</span>
            </div>
            <input type="range" min={1} max={30} step={1} value={years}
              onChange={e => setYears(Number(e.target.value))}
              className="w-full accent-accent" />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Compound Growth</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={projection}>
            <defs>
              <linearGradient id="projGrad1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="projGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} tickLine={false} tickFormatter={fmt} width={65} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [fmt(Number(v))]} />
            <Area type="monotone" dataKey="withReturns" stroke="#6366f1" fill="url(#projGrad1)" strokeWidth={2} name="With returns" />
            <Area type="monotone" dataKey="noReturns" stroke="#22c55e" fill="url(#projGrad2)" strokeWidth={1.5} strokeDasharray="5 3" name="No returns" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
