"use client";

import { useState, useEffect } from "react";
import { GraduationCap, Plus, X, Check, Star } from "lucide-react";
import toast from "react-hot-toast";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton";

interface LearningItem { id: string; title: string; type: string; url?: string; status: "queue" | "in-progress" | "done"; notes?: string; rating?: number; completedDate?: string; createdAt: string; }

const TYPES = ["book","course","article","video","podcast"];
const TYPE_ICON: Record<string, string> = { book:"📚", course:"🎓", article:"📄", video:"🎬", podcast:"🎧" };
const STATUS_COLS: LearningItem["status"][] = ["queue","in-progress","done"];
const STATUS_LABEL: Record<string, string> = { queue:"Queue", "in-progress":"In Progress", done:"Done" };
const STATUS_STYLE: Record<string, string> = { queue:"text-text-tertiary", "in-progress":"text-accent", done:"text-success" };

export function LearningDashboard() {
  const [items, setItems] = useState<LearningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", type: "book", url: "", notes: "" });

  useEffect(() => {
    fetch("/api/learning").then(r => r.json()).then(d => setItems(d.items ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function add() {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    const res = await fetch("/api/learning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json();
    setItems(i => [...i, d.item]);
    setAdding(false);
    setForm({ title: "", type: "book", url: "", notes: "" });
    toast.success("Added to queue");
  }

  async function advance(item: LearningItem) {
    const next: LearningItem["status"] = item.status === "queue" ? "in-progress" : "done";
    const patch = { id: item.id, status: next, ...(next === "done" ? { completedDate: new Date().toISOString().slice(0,10) } : {}) };
    await fetch("/api/learning", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    setItems(is => is.map(i => i.id === item.id ? { ...i, ...patch } : i));
    toast.success(next === "done" ? "Marked as done 🎉" : "Started!");
  }

  const doneCount = items.filter(i => i.status === "done").length;

  if (loading) return <SkeletonList count={5} />;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total",       value: items.length },
          { label: "In Queue",    value: items.filter(i => i.status === "queue").length },
          { label: "In Progress", value: items.filter(i => i.status === "in-progress").length },
          { label: "Completed",   value: doneCount },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <p className="text-2xl font-bold text-text-primary">{s.value}</p>
            <p className="text-2xs text-text-tertiary mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <div className="card space-y-3 border-accent/30">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Add to list</h3><button onClick={() => setAdding(false)}><X size={14} className="text-text-tertiary" /></button></div>
          <div><label className="label">Title</label><input className="input" placeholder="Book / course name" value={form.title} onChange={e => setForm(f => ({...f,title:e.target.value}))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="select" value={form.type} onChange={e => setForm(f => ({...f,type:e.target.value}))}>
                {TYPES.map(t => <option key={t} value={t} className="capitalize">{TYPE_ICON[t]} {t}</option>)}
              </select>
            </div>
            <div><label className="label">URL (optional)</label><input className="input" value={form.url} onChange={e => setForm(f => ({...f,url:e.target.value}))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="btn-primary btn-sm flex-1"><Check size={13} /> Add</button>
            <button onClick={() => setAdding(false)} className="btn-secondary btn-sm"><X size={13} /></button>
          </div>
        </div>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STATUS_COLS.map(col => {
          const colItems = items.filter(i => i.status === col);
          return (
            <div key={col} className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold uppercase tracking-wider ${STATUS_STYLE[col]}`}>{STATUS_LABEL[col]}</span>
                <span className="text-2xs text-text-tertiary bg-surface-3 rounded-full px-2">{colItems.length}</span>
              </div>
              {colItems.length === 0 ? (
                <div className="border border-dashed border-surface-3 rounded-xl h-20 flex items-center justify-center">
                  <span className="text-2xs text-text-tertiary">Empty</span>
                </div>
              ) : colItems.map(item => (
                <div key={item.id} className="card-hover py-3 px-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0">{TYPE_ICON[item.type] ?? "📌"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-primary line-clamp-2">{item.title}</p>
                      <p className="text-2xs text-text-tertiary capitalize mt-0.5">{item.type}</p>
                    </div>
                  </div>
                  {col !== "done" && (
                    <button onClick={() => advance(item)} className={`w-full text-2xs py-1 rounded-md transition-colors ${col === "queue" ? "bg-accent-subtle text-accent hover:bg-accent hover:text-white" : "bg-success-muted text-success hover:bg-success hover:text-white"}`}>
                      {col === "queue" ? "▶ Start" : "✓ Done"}
                    </button>
                  )}
                  {col === "done" && item.completedDate && (
                    <p className="text-2xs text-text-tertiary">Completed {item.completedDate}</p>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {items.length === 0 && !adding && (
        <EmptyState icon={GraduationCap} title="Nothing in your list" description="Add books, courses, articles, and more to track your learning." action={{ label: "Add first item", onClick: () => setAdding(true) }} />
      )}

      {!adding && <button onClick={() => setAdding(true)} className="btn-secondary btn-sm"><Plus size={14} /> Add to list</button>}
    </div>
  );
}
