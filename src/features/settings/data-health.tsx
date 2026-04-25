"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Database } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ModuleHealth {
  module: string;
  label: string;
  status: "healthy" | "stale" | "empty";
  count: number;
  lastUpdated: string | null;
  description: string;
}

export function DataHealthDashboard() {
  const [health, setHealth] = useState<ModuleHealth[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/settings/data-health");
      const d = await r.json();
      setHealth(d.modules ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const healthy = health.filter((m) => m.status === "healthy").length;
  const stale = health.filter((m) => m.status === "stale").length;
  const empty = health.filter((m) => m.status === "empty").length;

  const StatusIcon = ({ status }: { status: ModuleHealth["status"] }) => {
    if (status === "healthy") return <CheckCircle size={15} className="text-success" />;
    if (status === "stale") return <AlertTriangle size={15} className="text-warning" />;
    return <XCircle size={15} className="text-danger" />;
  };

  if (loading) return <div className="skeleton h-48 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm sm:gap-4">
          <span className="flex items-center gap-1.5 text-success"><CheckCircle size={14} /> {healthy} healthy</span>
          <span className="flex items-center gap-1.5 text-warning"><AlertTriangle size={14} /> {stale} stale</span>
          <span className="flex items-center gap-1.5 text-danger"><XCircle size={14} /> {empty} empty</span>
        </div>
        <button onClick={load} className="btn-ghost btn-sm flex w-full items-center justify-center gap-1.5 sm:w-auto">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {health.map((m) => (
          <div key={m.module} className={`card flex items-start gap-3 py-3 border-l-4 ${
            m.status === "healthy" ? "border-success" :
            m.status === "stale" ? "border-warning" : "border-danger"
          }`}>
            <StatusIcon status={m.status} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-medium text-text-primary">{m.label}</span>
                <span className="badge-neutral">{m.count} items</span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">{m.description}</p>
              {m.lastUpdated && (
                <p className="text-2xs text-text-tertiary mt-1">
                  Last updated {formatDistanceToNow(new Date(m.lastUpdated), { addSuffix: true })}
                </p>
              )}
              {!m.lastUpdated && m.count === 0 && (
                <p className="text-2xs text-text-tertiary mt-1">No data yet</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
        <Database size={16} className="text-accent" />
        <div>
          <p className="text-sm font-medium text-text-primary">Local-first storage</p>
          <p className="text-xs text-text-secondary">All data is stored locally in <code className="bg-surface-3 px-1 rounded">/data/*.json</code> — fully yours</p>
        </div>
      </div>
    </div>
  );
}
