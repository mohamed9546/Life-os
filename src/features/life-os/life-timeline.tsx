"use client";

import { useState, useEffect } from "react";
import { Plus, Star, Briefcase, Heart, GraduationCap, Home, Globe, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description?: string;
  category: "career" | "personal" | "education" | "health" | "travel" | "milestone";
}

const CATEGORY_CONFIG = {
  career: { icon: Briefcase, color: "text-accent", bg: "bg-accent-subtle" },
  personal: { icon: Heart, color: "text-danger", bg: "bg-danger-muted" },
  education: { icon: GraduationCap, color: "text-info", bg: "bg-info-muted" },
  health: { icon: Heart, color: "text-success", bg: "bg-success-muted" },
  travel: { icon: Globe, color: "text-warning", bg: "bg-warning-muted" },
  milestone: { icon: Star, color: "text-warning", bg: "bg-warning-muted" },
};

export function LifeTimeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), title: "", description: "", category: "milestone" as TimelineEvent["category"] });

  useEffect(() => {
    fetch("/api/life-timeline")
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save(updated: TimelineEvent[]) {
    setEvents(updated);
    await fetch("/api/life-timeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: updated }),
    }).catch(() => toast.error("Failed to save"));
  }

  async function addEvent() {
    if (!form.title.trim()) return;
    const ev: TimelineEvent = { id: `ev-${Date.now()}`, ...form };
    await save([...events, ev].sort((a, b) => b.date.localeCompare(a.date)));
    setForm({ date: new Date().toISOString().slice(0, 10), title: "", description: "", category: "milestone" });
    setShowAdd(false);
    toast.success("Event added to timeline");
  }

  async function deleteEvent(id: string) {
    await save(events.filter((e) => e.id !== id));
  }

  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));

  // Group by year
  const byYear = sorted.reduce<Record<string, TimelineEvent[]>>((acc, ev) => {
    const year = ev.date.slice(0, 4);
    if (!acc[year]) acc[year] = [];
    acc[year].push(ev);
    return acc;
  }, {});

  if (loading) return <div className="skeleton h-48 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-text-tertiary">{events.length} life events recorded</p>
        <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm flex w-full items-center justify-center gap-1.5 sm:w-auto">
          <Plus size={13} /> Add Event
        </button>
      </div>

      {showAdd && (
        <div className="card space-y-3 animate-slide-up">
          <h3 className="text-sm font-semibold text-text-primary">Add Life Event</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as TimelineEvent["category"] }))}>
                {Object.keys(CATEGORY_CONFIG).map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <input className="input" placeholder="Event title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <textarea className="textarea min-h-[64px]" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={addEvent} className="btn-primary btn-sm flex-1">Add</button>
            <button onClick={() => setShowAdd(false)} className="btn-ghost btn-sm w-full sm:w-auto">Cancel</button>
          </div>
        </div>
      )}

      {events.length === 0 && !showAdd && (
        <div className="card text-center py-10 text-text-secondary text-sm">
          Your life timeline is empty. Start by adding key milestones, career moves, or personal achievements.
        </div>
      )}

      {Object.entries(byYear).map(([year, yearEvents]) => (
        <div key={year}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-bold text-accent">{year}</span>
            <div className="flex-1 border-t border-surface-3" />
          </div>
          <div className="relative ml-4 space-y-3">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-surface-3" />
            {yearEvents.map((ev) => {
              const config = CATEGORY_CONFIG[ev.category];
              const Icon = config.icon;
              return (
                <div key={ev.id} className="relative ml-6 card py-3 group">
                  <div className={`absolute -left-9 w-6 h-6 rounded-full ${config.bg} flex items-center justify-center`}>
                    <Icon size={12} className={config.color} />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">{ev.title}</span>
                        <span className="badge-neutral capitalize">{ev.category}</span>
                      </div>
                      <span className="text-xs text-text-tertiary">
                        {new Date(ev.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                      {ev.description && <p className="text-xs text-text-secondary mt-1">{ev.description}</p>}
                    </div>
                    <button onClick={() => deleteEvent(ev.id)}
                      className="self-start text-text-tertiary transition-opacity hover:text-danger sm:opacity-0 sm:group-hover:opacity-100">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
