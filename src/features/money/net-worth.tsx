"use client";

import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Plus, Minus, TrendingUp, TrendingDown } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";

interface Snapshot {
  id: string;
  date: string;
  assets: Record<string, number>;
  liabilities: Record<string, number>;
  netWorth: number;
}

const ASSET_CATS = ["Cash", "Investments", "Property", "Pension", "Other"];
const LIAB_CATS  = ["Mortgage", "Loans", "Credit Cards", "Other"];

const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface-2)",
  border: "1px solid var(--surface-3)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--text-primary)",
};

function fmt(n: number) {
  return `£${Math.abs(n).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export function NetWorth() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [assets, setAssets]       = useState<Record<string, number>>({});
  const [liabs, setLiabs]         = useState<Record<string, number>>({});
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetch("/api/money/net-worth")
      .then(r => r.json())
      .then(d => setSnapshots(d.snapshots ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveSnapshot() {
    try {
      const res = await fetch("/api/money/net-worth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets, liabilities: liabs }),
      });
      const d = await res.json();
      setSnapshots(s => [...s, d.snapshot]);
      toast.success("Snapshot saved");
    } catch {
      toast.error("Failed to save");
    }
  }

  const latest = snapshots[snapshots.length - 1];
  const prev   = snapshots[snapshots.length - 2];
  const delta  = latest && prev ? latest.netWorth - prev.netWorth : null;

  const chartData = snapshots.map(s => ({
    date: format(new Date(s.date), "dd MMM"),
    netWorth: s.netWorth,
    assets: Object.values(s.assets).reduce((a, b) => a + b, 0),
    liabilities: Object.values(s.liabilities).reduce((a, b) => a + b, 0),
  }));

  if (loading) return <div className="skeleton h-64 rounded-xl" />;

  return (
    <div className="space-y-6">
      {/* Summary */}
      {latest && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Assets",      value: fmt(Object.values(latest.assets).reduce((a,b) => a+b, 0)),      color: "text-success" },
            { label: "Total Liabilities", value: fmt(Object.values(latest.liabilities).reduce((a,b) => a+b, 0)), color: "text-danger" },
            { label: "Net Worth",         value: fmt(latest.netWorth),  color: latest.netWorth >= 0 ? "text-success" : "text-danger" },
          ].map(m => (
            <div key={m.label} className="card text-center py-3">
              <p className="text-2xs text-text-tertiary mb-1">{m.label}</p>
              <p className={`text-lg font-mono font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {delta !== null && (
        <div className={`flex items-center gap-2 text-sm font-medium ${delta >= 0 ? "text-success" : "text-danger"}`}>
          {delta >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {delta >= 0 ? "+" : ""}{fmt(delta)} vs last snapshot
        </div>
      )}

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Net Worth Trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} tickLine={false} tickFormatter={fmt} width={60} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [fmt(Number(v))]} />
              <Area type="monotone" dataKey="netWorth" stroke="#6366f1" fill="url(#nwGrad)" strokeWidth={2} name="Net Worth" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Input form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-success flex items-center gap-2"><Plus size={14} /> Assets</h3>
          {ASSET_CATS.map(cat => (
            <div key={cat} className="flex items-center gap-2">
              <label className="w-24 text-xs text-text-secondary flex-shrink-0">{cat}</label>
              <input
                type="number"
                className="input text-right font-mono"
                placeholder="0"
                value={assets[cat] ?? ""}
                onChange={e => setAssets(a => ({ ...a, [cat]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </div>

        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-danger flex items-center gap-2"><Minus size={14} /> Liabilities</h3>
          {LIAB_CATS.map(cat => (
            <div key={cat} className="flex items-center gap-2">
              <label className="w-24 text-xs text-text-secondary flex-shrink-0">{cat}</label>
              <input
                type="number"
                className="input text-right font-mono"
                placeholder="0"
                value={liabs[cat] ?? ""}
                onChange={e => setLiabs(l => ({ ...l, [cat]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-sm text-text-secondary">
          Net = <span className="font-mono font-semibold text-text-primary">
            {fmt(Object.values(assets).reduce((a,b)=>a+b,0) - Object.values(liabs).reduce((a,b)=>a+b,0))}
          </span>
        </div>
        <button onClick={saveSnapshot} className="btn-primary btn-sm ml-auto">Save Snapshot</button>
      </div>
    </div>
  );
}
