"use client";

import { useState } from "react";
import { TrendingUp, Loader2, Search } from "lucide-react";
import toast from "react-hot-toast";

interface SalaryResult {
  role: string;
  location: string;
  p25: number;
  median: number;
  p75: number;
  currency: string;
  note?: string;
  savedAt: string;
}

function fmt(n: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function RangeBar({ p25, median, p75, currency }: { p25: number; median: number; p75: number; currency: string }) {
  return (
    <div className="space-y-3">
      <div className="relative h-4 rounded-full bg-surface-3 overflow-hidden">
        <div
          className="absolute top-0 bottom-0 rounded-full bg-accent/30"
          style={{ left: "0%", right: "25%" }}
        />
        <div
          className="absolute top-0 bottom-0 w-1 bg-accent rounded-full"
          style={{ left: `${((median - p25) / (p75 - p25)) * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-text-secondary">
        <div className="text-center">
          <p className="text-2xs text-text-tertiary">25th pct</p>
          <p className="font-mono font-medium">{fmt(p25, currency)}</p>
        </div>
        <div className="text-center">
          <p className="text-2xs text-text-tertiary">Median</p>
          <p className="font-mono font-semibold text-text-primary">{fmt(median, currency)}</p>
        </div>
        <div className="text-center">
          <p className="text-2xs text-text-tertiary">75th pct</p>
          <p className="font-mono font-medium">{fmt(p75, currency)}</p>
        </div>
      </div>
    </div>
  );
}

export function SalaryTracker({ history = [] }: { history?: SalaryResult[] }) {
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SalaryResult | null>(null);
  const [saved, setSaved] = useState<SalaryResult[]>(history);

  async function lookup() {
    if (!role.trim()) { toast.error("Enter a role title"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/career/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, location }),
      });
      const data = await res.json();
      if (!data.salary) {
        toast.error(data.error || "Salary lookup failed");
        return;
      }
      setResult(data.salary);
      setSaved(s => [data.salary, ...s.slice(0, 9)]);
    } catch {
      toast.error("Salary lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Role title</label>
            <input className="input" placeholder="e.g. Staff Engineer" value={role} onChange={e => setRole(e.target.value)} onKeyDown={e => e.key === "Enter" && lookup()} />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" placeholder="e.g. London, UK" value={location} onChange={e => setLocation(e.target.value)} onKeyDown={e => e.key === "Enter" && lookup()} />
          </div>
        </div>
        <button onClick={lookup} disabled={loading || !role.trim()} className="btn-primary btn-sm">
          {loading ? <><Loader2 size={14} className="animate-spin" /> Looking up…</> : <><Search size={14} /> Look up salary</>}
        </button>
      </div>

      {result && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">{result.role}</h3>
              {result.location && <p className="text-xs text-text-tertiary">{result.location}</p>}
            </div>
            <TrendingUp size={18} className="text-accent" />
          </div>
          <RangeBar p25={result.p25} median={result.median} p75={result.p75} currency={result.currency} />
          {result.note && <p className="text-2xs text-text-tertiary italic">{result.note}</p>}
        </div>
      )}

      {saved.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">History</h3>
          {saved.map((r, i) => (
            <div key={i} className="card-hover py-3 px-4" onClick={() => setResult(r)}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-text-primary">{r.role}</span>
                  {r.location && <span className="text-xs text-text-tertiary ml-2">{r.location}</span>}
                </div>
                <span className="text-xs font-mono text-text-secondary">{fmt(r.median, r.currency)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
