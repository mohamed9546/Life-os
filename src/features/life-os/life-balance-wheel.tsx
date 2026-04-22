"use client";

import { useState } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import toast from "react-hot-toast";

const DIMENSIONS = [
  { key: "career", label: "Career", color: "#6366f1" },
  { key: "health", label: "Health", color: "#22c55e" },
  { key: "relationships", label: "Relationships", color: "#f59e0b" },
  { key: "finances", label: "Finances", color: "#3b82f6" },
  { key: "learning", label: "Learning", color: "#8b5cf6" },
  { key: "mindfulness", label: "Mindfulness", color: "#ec4899" },
  { key: "creativity", label: "Creativity", color: "#14b8a6" },
  { key: "fun", label: "Fun & Rest", color: "#ef4444" },
];

const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface-2)",
  border: "1px solid var(--surface-3)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--text-primary)",
};

function scoreColor(score: number) {
  if (score >= 8) return "text-success";
  if (score >= 6) return "text-info";
  if (score >= 4) return "text-warning";
  return "text-danger";
}

export function LifeBalanceWheel() {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(DIMENSIONS.map((d) => [d.key, 5]))
  );
  const [saved, setSaved] = useState(false);

  const chartData = DIMENSIONS.map((d) => ({
    dimension: d.label,
    score: scores[d.key],
    fullMark: 10,
  }));

  const overallScore = Math.round(
    Object.values(scores).reduce((s, v) => s + v, 0) / DIMENSIONS.length
  );

  const lowestDimensions = DIMENSIONS
    .slice()
    .sort((a, b) => scores[a.key] - scores[b.key])
    .slice(0, 3);

  function save() {
    const data = { scores, date: new Date().toISOString().slice(0, 10) };
    localStorage.setItem("life-balance-wheel", JSON.stringify(data));
    setSaved(true);
    toast.success("Balance wheel saved");
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Life Balance</h3>
            <div className="text-center">
              <span className={`text-2xl font-bold ${scoreColor(overallScore)}`}>{overallScore}</span>
              <span className="text-xs text-text-tertiary">/10 overall</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={chartData}>
              <PolarGrid stroke="var(--surface-3)" />
              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Rate Each Dimension</h3>
          <p className="text-xs text-text-tertiary">1 = very dissatisfied · 10 = thriving</p>
          {DIMENSIONS.map((d) => (
            <div key={d.key} className="flex items-center gap-3">
              <span className="text-xs text-text-secondary w-24 flex-shrink-0">{d.label}</span>
              <input
                type="range" min={1} max={10} value={scores[d.key]}
                onChange={(e) => setScores((s) => ({ ...s, [d.key]: Number(e.target.value) }))}
                className="flex-1 accent-accent"
              />
              <span className={`text-sm font-mono font-bold w-6 text-right ${scoreColor(scores[d.key])}`}>
                {scores[d.key]}
              </span>
            </div>
          ))}
          <button onClick={save} className="btn-primary btn-sm w-full mt-2">
            {saved ? "Saved!" : "Save Assessment"}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Focus Areas</h3>
        <p className="text-xs text-text-tertiary mb-3">Your lowest-scoring dimensions — consider prioritising these</p>
        <div className="grid grid-cols-3 gap-3">
          {lowestDimensions.map((d, i) => (
            <div key={d.key} className="bg-surface-2 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xs text-text-tertiary">#{i + 1}</span>
                <span className="text-sm font-medium text-text-primary">{d.label}</span>
              </div>
              <p className={`text-2xl font-bold ${scoreColor(scores[d.key])}`}>{scores[d.key]}/10</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
