"use client";

import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowRight, ArrowDown } from "lucide-react";
import toast from "react-hot-toast";

interface Task {
  id: string;
  title: string;
  urgency: 1 | 2 | 3;
  impact: 1 | 2 | 3;
  effort: 1 | 2 | 3;
  area: string;
  done: boolean;
}

const LABELS = { 1: "Low", 2: "Medium", 3: "High" };
const AREAS = ["career", "money", "health", "life", "learning", "admin"];

function priorityScore(t: Task) {
  return (t.urgency * 2 + t.impact * 3 - t.effort) / 6;
}

function quadrant(t: Task): "do-now" | "schedule" | "delegate" | "eliminate" {
  if (t.urgency >= 2 && t.impact >= 2) return "do-now";
  if (t.urgency < 2 && t.impact >= 2) return "schedule";
  if (t.urgency >= 2 && t.impact < 2) return "delegate";
  return "eliminate";
}

const QUADRANT_CONFIG = {
  "do-now": { label: "Do Now", color: "text-danger", bg: "bg-danger/10", border: "border-danger/30" },
  schedule: { label: "Schedule", color: "text-accent", bg: "bg-accent/10", border: "border-accent/30" },
  delegate: { label: "Delegate", color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
  eliminate: { label: "Eliminate", color: "text-text-tertiary", bg: "bg-surface-2", border: "border-surface-3" },
};

export function SmartTaskPrioritizer() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try { return JSON.parse(localStorage.getItem("smart-tasks") || "[]"); } catch { return []; }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", urgency: 2 as 1|2|3, impact: 2 as 1|2|3, effort: 2 as 1|2|3, area: "life" });

  function save(updated: Task[]) {
    setTasks(updated);
    localStorage.setItem("smart-tasks", JSON.stringify(updated));
  }

  function addTask() {
    if (!form.title.trim()) { toast.error("Enter task title"); return; }
    const task: Task = { id: `t-${Date.now()}`, ...form, done: false };
    save([...tasks, task]);
    setForm({ title: "", urgency: 2, impact: 2, effort: 2, area: "life" });
    setShowAdd(false);
  }

  function toggle(id: string) {
    save(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  function remove(id: string) {
    save(tasks.filter(t => t.id !== id));
  }

  const active = tasks.filter(t => !t.done).sort((a, b) => priorityScore(b) - priorityScore(a));
  const done = tasks.filter(t => t.done);

  const byQuadrant = {
    "do-now": active.filter(t => quadrant(t) === "do-now"),
    schedule: active.filter(t => quadrant(t) === "schedule"),
    delegate: active.filter(t => quadrant(t) === "delegate"),
    eliminate: active.filter(t => quadrant(t) === "eliminate"),
  };

  const UrgencyIcon = form.urgency === 3 ? ArrowUp : form.urgency === 2 ? ArrowRight : ArrowDown;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-text-tertiary">{active.length} active tasks · {done.length} completed</p>
        </div>
        <button onClick={() => setShowAdd(s => !s)} className="btn-primary btn-sm flex items-center gap-1.5">
          <Plus size={13} /> Add Task
        </button>
      </div>

      {showAdd && (
        <div className="card space-y-4 border-accent/20">
          <h3 className="text-sm font-semibold text-text-primary">New Task</h3>
          <input className="input" placeholder="What needs to be done?" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Area</label>
              <select className="select" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}>
                {AREAS.map(a => <option key={a} value={a} className="capitalize">{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Urgency: {LABELS[form.urgency]}</label>
              <input type="range" min={1} max={3} step={1} value={form.urgency}
                onChange={e => setForm(f => ({ ...f, urgency: Number(e.target.value) as 1|2|3 }))}
                className="w-full accent-danger" />
            </div>
            <div>
              <label className="label">Impact: {LABELS[form.impact]}</label>
              <input type="range" min={1} max={3} step={1} value={form.impact}
                onChange={e => setForm(f => ({ ...f, impact: Number(e.target.value) as 1|2|3 }))}
                className="w-full accent-accent" />
            </div>
            <div>
              <label className="label">Effort: {LABELS[form.effort]}</label>
              <input type="range" min={1} max={3} step={1} value={form.effort}
                onChange={e => setForm(f => ({ ...f, effort: Number(e.target.value) as 1|2|3 }))}
                className="w-full accent-warning" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addTask} className="btn-primary btn-sm flex-1">Add Task</button>
            <button onClick={() => setShowAdd(false)} className="btn-ghost btn-sm">Cancel</button>
          </div>
        </div>
      )}

      {(["do-now", "schedule", "delegate", "eliminate"] as const).map(q => {
        const cfg = QUADRANT_CONFIG[q];
        const items = byQuadrant[q];
        if (items.length === 0) return null;
        return (
          <div key={q}>
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${cfg.color}`}>{cfg.label}</h3>
            <div className="space-y-2">
              {items.map(task => (
                <div key={task.id} className={`card py-2 flex items-center gap-3 border ${cfg.border} ${cfg.bg}`}>
                  <button onClick={() => toggle(task.id)}
                    className="w-4 h-4 rounded border border-surface-4 flex-shrink-0 hover:border-accent transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">{task.title}</p>
                    <div className="flex gap-2 mt-0.5 text-2xs text-text-tertiary">
                      <span className="capitalize">{task.area}</span>
                      <span>U:{task.urgency} I:{task.impact} E:{task.effort}</span>
                      <span className="font-medium text-accent">Score: {priorityScore(task).toFixed(2)}</span>
                    </div>
                  </div>
                  <button onClick={() => remove(task.id)} className="text-text-tertiary hover:text-danger flex-shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {active.length === 0 && !showAdd && (
        <div className="card text-center py-10 text-text-secondary text-sm">
          No tasks yet. Add tasks and the system will prioritize them by urgency × impact.
        </div>
      )}

      {done.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-text-tertiary">Completed ({done.length})</h3>
          <div className="space-y-1.5">
            {done.map(task => (
              <div key={task.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-2">
                <button onClick={() => toggle(task.id)}
                  className="w-4 h-4 rounded bg-success border-success flex-shrink-0" />
                <p className="text-sm text-text-tertiary line-through flex-1">{task.title}</p>
                <button onClick={() => remove(task.id)} className="text-text-tertiary hover:text-danger">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
