"use client";

import { useState, useEffect, useMemo } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { subDays, format } from "date-fns";

interface HealthLog {
  date: string;
  energy: number;
  mood: number;
  sleep: number;
  sleepQuality: number;
}

const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface-2)",
  border: "1px solid var(--surface-3)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--text-primary)",
};

export function MoodEnergyCorrelation() {
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/health")
      .then(r => r.json())
      .then(d => setLogs(d.entries ?? d.logs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const last30 = useMemo(() => {
    const cutoff = subDays(new Date(), 30);
    return logs.filter(l => new Date(l.date) >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
  }, [logs]);

  const correlation = useMemo(() => {
    if (last30.length < 3) return null;
    const n = last30.length;
    const sx = last30.reduce((s, l) => s + l.energy, 0);
    const sy = last30.reduce((s, l) => s + l.mood, 0);
    const sxy = last30.reduce((s, l) => s + l.energy * l.mood, 0);
    const sx2 = last30.reduce((s, l) => s + l.energy ** 2, 0);
    const sy2 = last30.reduce((s, l) => s + l.mood ** 2, 0);
    const num = n * sxy - sx * sy;
    const den = Math.sqrt((n * sx2 - sx ** 2) * (n * sy2 - sy ** 2));
    return den === 0 ? 0 : num / den;
  }, [last30]);

  const sleepCorrelation = useMemo(() => {
    if (last30.length < 3) return null;
    const n = last30.length;
    const sx = last30.reduce((s, l) => s + l.sleep, 0);
    const sy = last30.reduce((s, l) => s + l.energy, 0);
    const sxy = last30.reduce((s, l) => s + l.sleep * l.energy, 0);
    const sx2 = last30.reduce((s, l) => s + l.sleep ** 2, 0);
    const sy2 = last30.reduce((s, l) => s + l.energy ** 2, 0);
    const num = n * sxy - sx * sy;
    const den = Math.sqrt((n * sx2 - sx ** 2) * (n * sy2 - sy ** 2));
    return den === 0 ? 0 : num / den;
  }, [last30]);

  const trend = last30.map(l => ({
    date: format(new Date(l.date), "dd/MM"),
    energy: l.energy,
    mood: l.mood,
    sleep: l.sleep,
  }));

  const scatterData = last30.map(l => ({ x: l.energy, y: l.mood, sleep: l.sleep }));

  if (loading) return <div className="skeleton h-64 rounded-xl" />;

  if (last30.length < 5) {
    return (
      <div className="card text-center py-10 text-text-secondary text-sm">
        Log at least 5 days of health data to see correlations between mood, energy, and sleep.
      </div>
    );
  }

  const corrLabel = (r: number) => r > 0.7 ? "Strong positive" : r > 0.4 ? "Moderate positive" : r > 0 ? "Weak positive" : r > -0.4 ? "Weak negative" : r > -0.7 ? "Moderate negative" : "Strong negative";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        {correlation !== null && (
          <div className="card text-center py-4">
            <p className="text-3xl font-bold text-accent">{correlation.toFixed(2)}</p>
            <p className="text-xs text-text-tertiary mt-1">Mood ↔ Energy correlation</p>
            <p className={`text-xs mt-1 font-medium ${correlation > 0 ? "text-success" : "text-warning"}`}>
              {corrLabel(correlation)}
            </p>
          </div>
        )}
        {sleepCorrelation !== null && (
          <div className="card text-center py-4">
            <p className="text-3xl font-bold text-accent">{sleepCorrelation.toFixed(2)}</p>
            <p className="text-xs text-text-tertiary mt-1">Sleep → Energy correlation</p>
            <p className={`text-xs mt-1 font-medium ${sleepCorrelation > 0 ? "text-success" : "text-warning"}`}>
              {corrLabel(sleepCorrelation)}
            </p>
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">30-Day Trend</h3>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-tertiary)" }} tickLine={false} />
            <YAxis domain={[0, 5]} tick={{ fontSize: 9, fill: "var(--text-tertiary)" }} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="energy" stroke="#6366f1" strokeWidth={2} dot={false} name="Energy" />
            <Line type="monotone" dataKey="mood" stroke="#22c55e" strokeWidth={2} dot={false} name="Mood" />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-4 text-2xs text-text-tertiary">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-accent inline-block" /> Energy</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-success inline-block" /> Mood</span>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">Mood vs Energy (scatter)</h3>
        <ResponsiveContainer width="100%" height={160}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" />
            <XAxis dataKey="x" name="Energy" domain={[0, 6]} tick={{ fontSize: 9, fill: "var(--text-tertiary)" }} label={{ value: "Energy", position: "insideBottom", offset: -2, fontSize: 10 }} />
            <YAxis dataKey="y" name="Mood" domain={[0, 6]} tick={{ fontSize: 9, fill: "var(--text-tertiary)" }} label={{ value: "Mood", angle: -90, position: "insideLeft", fontSize: 10 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={scatterData} fill="#6366f1" opacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
