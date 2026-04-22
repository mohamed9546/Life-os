"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";

interface ModuleScore {
  module: string;
  label: string;
  score: number;
  detail: string;
  trend: "up" | "down" | "flat";
}

interface ScoreResponse {
  overall: number;
  modules: ModuleScore[];
  generatedAt: string;
}

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

const TREND_COLORS = {
  up: "text-success",
  down: "text-danger",
  flat: "text-text-tertiary",
};

function scoreLabel(score: number) {
  if (score >= 80) return { label: "Thriving", color: "text-success" };
  if (score >= 60) return { label: "On Track", color: "text-info" };
  if (score >= 40) return { label: "Developing", color: "text-warning" };
  return { label: "Needs Attention", color: "text-danger" };
}

function ScoreGauge({ score }: { score: number }) {
  const { label, color } = scoreLabel(score);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--surface-3)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="54" fill="none"
            stroke={score >= 80 ? "#22c55e" : score >= 60 ? "#6366f1" : score >= 40 ? "#f59e0b" : "#ef4444"}
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${color}`}>{score}</span>
          <span className="text-2xs text-text-tertiary">/100</span>
        </div>
      </div>
      <p className={`text-sm font-semibold ${color}`}>{label}</p>
    </div>
  );
}

export function LifeOSScore() {
  const [data, setData] = useState<ScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/life-os/score");
      const d = await r.json();
      setData(d);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  if (loading) return <div className="skeleton h-64 rounded-xl" />;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Life OS Score</h3>
            <p className="text-xs text-text-tertiary mt-0.5">Composite across all active modules</p>
          </div>
          <button onClick={load} className="btn-ghost btn-sm">
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-8">
          <ScoreGauge score={data.overall} />
          <div className="flex-1 grid grid-cols-2 gap-3">
            {data.modules.map((m) => {
              const TrendIcon = TREND_ICONS[m.trend];
              return (
                <div key={m.module} className="bg-surface-2 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-text-secondary">{m.label}</span>
                    <TrendIcon size={12} className={TREND_COLORS[m.trend]} />
                  </div>
                  <p className={`text-xl font-bold mt-1 ${scoreLabel(m.score).color}`}>{m.score}</p>
                  <p className="text-2xs text-text-tertiary mt-0.5 truncate">{m.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
