"use client";

import { useState, useEffect } from "react";
import { Zap, Moon, Smile, Heart, TrendingUp, Plus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, eachDayOfInterval } from "date-fns";
import toast from "react-hot-toast";
import { MoodEnergyCorrelation } from "./mood-energy-correlation";

interface HealthEntry {
  id: string;
  date: string;
  energy: number;
  mood: number;
  sleep: number;
  sleepQuality: number;
  notes: string;
}

const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface-2)",
  border: "1px solid var(--surface-3)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--text-primary)",
};

function WellnessScore({ energy, mood, sleep, sleepQuality }: { energy: number; mood: number; sleep: number; sleepQuality: number }) {
  const sleepScore = Math.min(100, (sleep / 8) * 50 + (sleepQuality / 5) * 50);
  const score = Math.round((energy / 5 * 33) + (mood / 5 * 33) + (sleepScore / 100 * 34));
  const color = score >= 75 ? "text-success" : score >= 50 ? "text-warning" : "text-danger";
  return (
    <div className="text-center">
      <p className={`text-4xl font-bold ${color}`}>{score}</p>
      <p className="text-xs text-text-tertiary mt-1">Wellness Score</p>
    </div>
  );
}

function RatingInput({ label, icon: Icon, value, onChange, max = 5, color }: {
  label: string; icon: React.ElementType; value: number; onChange: (v: number) => void; max?: number; color: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
        <Icon size={12} className={color} /> {label}
      </label>
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, i) => (
          <button key={i} onClick={() => onChange(i + 1)}
            className={`flex-1 h-8 rounded-md text-xs font-semibold transition-all ${
              i + 1 <= value ? `${color} bg-surface-3 border border-current` : "text-text-tertiary bg-surface-2 hover:bg-surface-3"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

export function HealthDashboard() {
  const [entries, setEntries] = useState<HealthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState({ energy: 3, mood: 3, sleep: 7, sleepQuality: 3, notes: "" });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"log" | "trends" | "streaks" | "correlation">("log");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries ?? []);
        const todayStr = new Date().toISOString().slice(0, 10);
        const existing = (d.entries ?? []).find((e: HealthEntry) => e.date === todayStr);
        if (existing) setToday(existing);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...today, date: new Date().toISOString().slice(0, 10) }),
      });
      const d = await res.json();
      setEntries((prev) => {
        const filtered = prev.filter((e) => e.date !== d.entry.date);
        return [...filtered, d.entry].sort((a, b) => b.date.localeCompare(a.date));
      });
      toast.success("Health logged");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  const chartDays = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
  const chartData = chartDays.map((day) => {
    const ds = format(day, "yyyy-MM-dd");
    const e = entries.find((en) => en.date === ds);
    return { date: format(day, "dd/MM"), energy: e?.energy ?? null, mood: e?.mood ?? null, sleep: e?.sleep ?? null };
  });

  const recent = entries.slice(0, 7);
  const avgEnergy = recent.length ? recent.reduce((s, e) => s + e.energy, 0) / recent.length : 0;
  const avgMood = recent.length ? recent.reduce((s, e) => s + e.mood, 0) / recent.length : 0;
  const avgSleep = recent.length ? recent.reduce((s, e) => s + e.sleep, 0) / recent.length : 0;

  if (loading) return <div className="skeleton h-64 rounded-xl" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Avg Energy", value: avgEnergy.toFixed(1), icon: Zap, color: "text-warning" },
          { label: "Avg Mood", value: avgMood.toFixed(1), icon: Smile, color: "text-success" },
          { label: "Avg Sleep", value: `${avgSleep.toFixed(1)}h`, icon: Moon, color: "text-info" },
          { label: "Entries", value: entries.length, icon: Heart, color: "text-accent" },
        ].map((m) => (
          <div key={m.label} className="card text-center py-3">
            <m.icon size={16} className={`${m.color} mx-auto mb-1`} />
            <p className="text-xl font-bold text-text-primary">{m.value}</p>
            <p className="text-2xs text-text-tertiary">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 border-b border-surface-3">
        {(["log", "trends", "streaks", "correlation"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors relative ${
              activeTab === tab ? "text-accent" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab}
            {activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />}
          </button>
        ))}
      </div>

      {activeTab === "log" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Plus size={14} /> Log Today
            </h3>
            <RatingInput label="Energy" icon={Zap} value={today.energy} onChange={(v) => setToday((t) => ({ ...t, energy: v }))} color="text-warning" />
            <RatingInput label="Mood" icon={Smile} value={today.mood} onChange={(v) => setToday((t) => ({ ...t, mood: v }))} color="text-success" />
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                <Moon size={12} className="text-info" /> Sleep Hours
              </label>
              <input type="number" min={0} max={12} step={0.5} className="input font-mono text-center"
                value={today.sleep} onChange={(e) => setToday((t) => ({ ...t, sleep: Number(e.target.value) }))} />
            </div>
            <RatingInput label="Sleep Quality" icon={Moon} value={today.sleepQuality} onChange={(v) => setToday((t) => ({ ...t, sleepQuality: v }))} color="text-info" />
            <textarea className="textarea min-h-[60px]" placeholder="Notes (optional)"
              value={today.notes} onChange={(e) => setToday((t) => ({ ...t, notes: e.target.value }))} />
            <button onClick={save} disabled={saving} className="btn-primary w-full btn-sm">
              {saving ? "Saving…" : "Log Today"}
            </button>
          </div>
          <div className="card flex flex-col items-center justify-center gap-4">
            <WellnessScore energy={today.energy} mood={today.mood} sleep={today.sleep} sleepQuality={today.sleepQuality} />
            <div className="w-full space-y-2">
              {[
                { label: "Energy", value: today.energy, max: 5, color: "bg-warning" },
                { label: "Mood", value: today.mood, max: 5, color: "bg-success" },
                { label: "Sleep quality", value: today.sleepQuality, max: 5, color: "bg-info" },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-3">
                  <span className="text-xs text-text-secondary w-20">{m.label}</span>
                  <div className="progress-bar flex-1">
                    <div className={`progress-fill ${m.color}`} style={{ width: `${(m.value / m.max) * 100}%` }} />
                  </div>
                  <span className="text-xs font-mono text-text-secondary w-6">{m.value}/{m.max}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "trends" && (
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">30-Day Trends</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} tickLine={false} interval={6} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="energy" stroke="#f59e0b" strokeWidth={2} dot={false} name="Energy" connectNulls />
              <Line type="monotone" dataKey="mood" stroke="#22c55e" strokeWidth={2} dot={false} name="Mood" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === "streaks" && (
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            <TrendingUp size={14} className="inline mr-2 text-accent" />
            Logging Streak
          </h3>
          <StreakDisplay entries={entries} />
        </div>
      )}
      {activeTab === "correlation" && <MoodEnergyCorrelation />}
    </div>
  );
}

function StreakDisplay({ entries }: { entries: HealthEntry[] }) {
  const days = eachDayOfInterval({ start: subDays(new Date(), 51), end: new Date() });
  const logged = new Set(entries.map((e) => e.date));

  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (logged.has(format(days[i], "yyyy-MM-dd"))) streak++;
    else break;
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-4xl font-bold text-accent">{streak}</p>
        <p className="text-xs text-text-tertiary mt-1">day streak</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {days.map((day) => {
          const ds = format(day, "yyyy-MM-dd");
          const has = logged.has(ds);
          return (
            <div key={ds} title={ds}
              className={`w-3 h-3 rounded-sm ${has ? "bg-accent" : "bg-surface-3"}`}
            />
          );
        })}
      </div>
      <p className="text-xs text-text-tertiary">
        {entries.length} total days logged · {streak > 0 ? `${streak}-day current streak` : "No current streak"}
      </p>
    </div>
  );
}
