"use client";

import { useState, useEffect } from "react";
import { Heart, Plus, Flame, Smile } from "lucide-react";
import { format, subDays, eachDayOfInterval } from "date-fns";
import toast from "react-hot-toast";

interface GratitudeEntry {
  id: string;
  date: string;
  items: string[];
  mood: number;
}

const PROMPTS = [
  "Something that made you smile today…",
  "A person you're grateful for…",
  "A challenge that taught you something…",
  "Something about your body/health you appreciate…",
  "A small joy you noticed today…",
  "Something you're looking forward to…",
  "A skill or ability you're glad you have…",
];

export function GratitudeJournal() {
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState(["", "", ""]);
  const [mood, setMood] = useState(4);
  const [saving, setSaving] = useState(false);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayEntry = entries.find((e) => e.date === todayStr);

  useEffect(() => {
    fetch("/api/gratitude")
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries ?? []);
        const te = (d.entries ?? []).find((e: GratitudeEntry) => e.date === todayStr);
        if (te) { setItems(te.items.concat(["", ""]).slice(0, 3)); setMood(te.mood); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [todayStr]);

  async function save() {
    const filled = items.filter((i) => i.trim());
    if (filled.length === 0) { toast.error("Add at least one gratitude"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/gratitude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: todayStr, items: filled, mood }),
      });
      const d = await res.json();
      setEntries((prev) => [...prev.filter((e) => e.date !== todayStr), d.entry]);
      toast.success("Gratitude logged ✨");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  // Streak calculation
  const days = eachDayOfInterval({ start: subDays(new Date(), 60), end: new Date() });
  const logged = new Set(entries.map((e) => e.date));
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (logged.has(format(days[i], "yyyy-MM-dd"))) streak++;
    else break;
  }

  const randomPrompts = PROMPTS.slice(0, 3);

  if (loading) return <div className="skeleton h-48 rounded-xl" />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center py-3">
          <Flame size={18} className="text-warning mx-auto mb-1" />
          <p className="text-2xl font-bold text-warning">{streak}</p>
          <p className="text-2xs text-text-tertiary">day streak</p>
        </div>
        <div className="card text-center py-3">
          <Heart size={18} className="text-danger mx-auto mb-1" />
          <p className="text-2xl font-bold text-text-primary">{entries.length}</p>
          <p className="text-2xs text-text-tertiary">total entries</p>
        </div>
        <div className="card text-center py-3">
          <Smile size={18} className="text-success mx-auto mb-1" />
          <p className="text-2xl font-bold text-text-primary">
            {entries.length ? (entries.reduce((s, e) => s + e.mood, 0) / entries.length).toFixed(1) : "—"}
          </p>
          <p className="text-2xs text-text-tertiary">avg mood</p>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Heart size={14} className="text-danger" />
            {todayEntry ? "Today's Gratitude ✓" : "What are you grateful for today?"}
          </h3>
          <span className="text-xs text-text-tertiary">{format(new Date(), "EEEE, d MMM")}</span>
        </div>

        <div className="space-y-2">
          {items.map((item, i) => (
            <input
              key={i}
              className="input"
              placeholder={randomPrompts[i] || "One more thing…"}
              value={item}
              onChange={(e) => setItems((prev) => prev.map((v, j) => j === i ? e.target.value : v))}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-text-secondary">Mood today:</span>
          <div className="flex gap-1">
            {["😞", "😐", "🙂", "😊", "🤩"].map((emoji, i) => (
              <button key={i} onClick={() => setMood(i + 1)}
                className={`text-xl transition-transform ${mood === i + 1 ? "scale-125" : "opacity-50 hover:opacity-100"}`}>
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <button onClick={save} disabled={saving} className="btn-primary w-full btn-sm">
          {saving ? "Saving…" : todayEntry ? "Update" : "Log Gratitude"}
        </button>
      </div>

      {/* Streak heatmap */}
      <div className="card">
        <h3 className="text-sm font-semibold text-text-primary mb-3">52-Week Streak</h3>
        <div className="flex flex-wrap gap-1">
          {eachDayOfInterval({ start: subDays(new Date(), 51), end: new Date() }).map((day) => {
            const ds = format(day, "yyyy-MM-dd");
            const entry = entries.find((e) => e.date === ds);
            return (
              <div key={ds} title={ds}
                className={`w-3 h-3 rounded-sm ${entry ? "bg-danger" : "bg-surface-3"}`}
              />
            );
          })}
        </div>
      </div>

      {/* Recent entries */}
      {entries.length > 0 && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Recent Entries</h3>
          {entries.slice(0, 5).map((entry) => (
            <div key={entry.id} className="border-b border-surface-3 last:border-0 pb-2 last:pb-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-tertiary">{format(new Date(entry.date), "EEE, d MMM")}</span>
                <span className="text-xs">{"😞😐🙂😊🤩".split("")[entry.mood - 1]}</span>
              </div>
              <ul className="space-y-0.5">
                {entry.items.map((item, i) => (
                  <li key={i} className="text-xs text-text-secondary flex items-start gap-1.5">
                    <span className="text-danger mt-0.5">•</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
