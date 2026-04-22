"use client";

import { useState, useEffect } from "react";
import { format, parseISO, startOfMonth, eachDayOfInterval, endOfMonth } from "date-fns";
import { BookOpen, ChevronLeft, ChevronRight, Save } from "lucide-react";
import toast from "react-hot-toast";
import { EmptyState } from "@/components/empty-state";

interface JournalEntry { id: string; date: string; mood: number; energy: number; body: string; tags: string[]; createdAt: string; }

const MOOD_EMOJI = ["", "😴", "😐", "😊", "😄", "⚡"];
const ENERGY_EMOJI = ["", "🔋", "⚡", "💪", "🔥", "🚀"];

export function JournalDashboard() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [calMonth, setCalMonth] = useState(new Date());
  const [form, setForm] = useState({ mood: 3, energy: 3, body: "", tags: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/journal").then(r => r.json()).then(d => setEntries(d.entries ?? [])).catch(() => {});
  }, []);

  const entryDates = new Set(entries.map(e => e.date));
  const selectedEntry = entries.find(e => e.date === selectedDate);

  useEffect(() => {
    if (selectedEntry) {
      setForm({ mood: selectedEntry.mood, energy: selectedEntry.energy, body: selectedEntry.body, tags: selectedEntry.tags.join(", ") });
    } else {
      setForm({ mood: 3, energy: 3, body: "", tags: "" });
    }
  }, [selectedDate, selectedEntry]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, date: selectedDate, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean) }),
      });
      const d = await res.json();
      setEntries(e => {
        const idx = e.findIndex(x => x.date === selectedDate);
        return idx >= 0 ? e.map((x, i) => i === idx ? d.entry : x) : [...e, d.entry];
      });
      toast.success("Entry saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const days = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) });
  const startDow = startOfMonth(calMonth).getDay();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth()-1,1))} className="btn-ghost p-1"><ChevronLeft size={14} /></button>
          <span className="text-sm font-semibold text-text-primary">{format(calMonth, "MMMM yyyy")}</span>
          <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth()+1,1))} className="btn-ghost p-1"><ChevronRight size={14} /></button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {["S","M","T","W","T","F","S"].map((d,i) => (
            <div key={i} className="text-center text-2xs text-text-tertiary py-1 font-medium">{d}</div>
          ))}
          {Array(startDow).fill(null).map((_,i) => <div key={`e${i}`} />)}
          {days.map(day => {
            const ds = format(day, "yyyy-MM-dd");
            const hasEntry = entryDates.has(ds);
            const isSelected = ds === selectedDate;
            const isToday = ds === new Date().toISOString().slice(0,10);
            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(ds)}
                className={`relative aspect-square flex items-center justify-center rounded-lg text-xs transition-colors ${
                  isSelected ? "bg-accent text-white font-semibold" :
                  isToday ? "bg-accent-subtle text-accent font-semibold" :
                  "hover:bg-surface-2 text-text-secondary"
                }`}
              >
                {format(day, "d")}
                {hasEntry && !isSelected && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>

        <div className="pt-2 border-t border-surface-3">
          <p className="text-2xs text-text-tertiary">{entries.length} entries total</p>
          {entries.slice(0,3).map(e => (
            <button key={e.id} onClick={() => setSelectedDate(e.date)} className="w-full text-left flex items-center gap-2 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors">
              <span className="text-text-tertiary">{format(parseISO(e.date), "dd MMM")}</span>
              <span>{MOOD_EMOJI[e.mood]}</span>
              <span className="truncate">{e.body.slice(0,40)}…</span>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="lg:col-span-2 card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">{format(parseISO(selectedDate), "EEEE, dd MMMM yyyy")}</h2>
          {selectedEntry && <span className="badge badge-accent">Saved</span>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Mood {MOOD_EMOJI[form.mood]}</label>
            <input type="range" min={1} max={5} value={form.mood} onChange={e => setForm(f => ({ ...f, mood: Number(e.target.value) }))} className="w-full accent-accent" />
            <div className="flex justify-between text-2xs text-text-tertiary mt-1">
              <span>Low</span><span>High</span>
            </div>
          </div>
          <div>
            <label className="label">Energy {ENERGY_EMOJI[form.energy]}</label>
            <input type="range" min={1} max={5} value={form.energy} onChange={e => setForm(f => ({ ...f, energy: Number(e.target.value) }))} className="w-full accent-accent" />
            <div className="flex justify-between text-2xs text-text-tertiary mt-1">
              <span>Drained</span><span>Energised</span>
            </div>
          </div>
        </div>

        <div>
          <label className="label">Entry</label>
          <textarea
            className="textarea min-h-[200px]"
            placeholder="What happened today? How are you feeling? What's on your mind?"
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          />
        </div>

        <div>
          <label className="label">Tags (comma separated)</label>
          <input className="input" placeholder="work, win, learning" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
        </div>

        <button onClick={save} disabled={saving || !form.body.trim()} className="btn-primary">
          <Save size={14} /> {saving ? "Saving…" : "Save Entry"}
        </button>
      </div>
    </div>
  );
}
