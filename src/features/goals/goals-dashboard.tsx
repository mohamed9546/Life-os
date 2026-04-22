"use client";

import { useState, useEffect } from "react";
import { Plus, Check, Target, X, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton";
import { percentage } from "@/lib/utils";
import { OKRTracker } from "./okr-tracker";
import { GratitudeJournal } from "./gratitude-journal";
import { MilestonePlanner } from "./milestone-planner";

type GoalsTab = "goals" | "okr" | "gratitude" | "milestones";
const GOALS_TABS: { id: GoalsTab; label: string }[] = [
  { id: "goals", label: "Goals" },
  { id: "okr", label: "OKRs" },
  { id: "gratitude", label: "Gratitude" },
  { id: "milestones", label: "Milestones" },
];

interface Milestone { title: string; done: boolean; }
interface Goal { id: string; title: string; category: string; targetDate?: string; milestones: Milestone[]; notes?: string; status: "active" | "done" | "paused"; createdAt: string; }

const CATEGORIES = ["career", "money", "health", "life", "learning"];
const CAT_COLORS: Record<string, string> = {
  career: "badge-accent", money: "badge-high", health: "badge-medium",
  life: "badge-low", learning: "badge-neutral",
};

export function GoalsDashboard() {
  const [activeTab, setActiveTab] = useState<GoalsTab>("goals");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({ title: "", category: "life", targetDate: "", milestones: ["", "", ""], notes: "" });

  useEffect(() => {
    fetch("/api/goals").then(r => r.json()).then(d => setGoals(d.goals ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function addGoal() {
    if (!form.title.trim()) { toast.error("Enter a goal title"); return; }
    const milestones = form.milestones.filter(m => m.trim());
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, milestones }),
    });
    const d = await res.json();
    setGoals(g => [...g, d.goal]);
    setAdding(false);
    setForm({ title: "", category: "life", targetDate: "", milestones: ["", "", ""], notes: "" });
    toast.success("Goal added");
  }

  async function toggleMilestone(goalId: string, mi: number) {
    const goal = goals.find(g => g.id === goalId)!;
    const milestones = goal.milestones.map((m, i) => i === mi ? { ...m, done: !m.done } : m);
    const updated = { ...goal, milestones };
    setGoals(g => g.map(x => x.id === goalId ? updated : x));
    await fetch("/api/goals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
  }

  const filtered = filter === "all" ? goals : goals.filter(g => g.category === filter);

  if (loading && activeTab === "goals") return <SkeletonList count={4} />;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-surface-2 rounded-xl p-1">
        {GOALS_TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${activeTab === tab.id ? "bg-surface-0 text-text-primary shadow-sm" : "text-text-tertiary hover:text-text-primary"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "okr" && <OKRTracker />}
      {activeTab === "gratitude" && <GratitudeJournal />}
      {activeTab === "milestones" && <MilestonePlanner goals={goals.filter(g => g.status === "active")} />}

      {activeTab === "goals" && <>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total",   value: goals.length },
          { label: "Active",  value: goals.filter(g => g.status === "active").length },
          { label: "Done",    value: goals.filter(g => g.status === "done").length },
          { label: "On track",value: goals.filter(g => { const p = percentage(g.milestones.filter(m=>m.done).length, g.milestones.length); return p >= 50; }).length },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <p className="text-2xl font-bold text-text-primary">{s.value}</p>
            <p className="text-2xs text-text-tertiary mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {["all", ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setFilter(c)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${filter === c ? "bg-accent-subtle text-accent border border-accent/20" : "text-text-tertiary hover:text-text-primary hover:bg-surface-2"}`}>{c}</button>
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <div className="card space-y-3 border-accent/30">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-text-primary">New Goal</h3><button onClick={() => setAdding(false)}><X size={14} className="text-text-tertiary" /></button></div>
          <div><label className="label">Goal</label><input className="input" placeholder="What do you want to achieve?" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select className="select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
            <div><label className="label">Target date</label><input type="date" className="input" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} /></div>
          </div>
          <div>
            <label className="label">Milestones</label>
            <div className="space-y-2">
              {form.milestones.map((m, i) => (
                <input key={i} className="input" placeholder={`Milestone ${i+1}`} value={m} onChange={e => setForm(f => ({ ...f, milestones: f.milestones.map((x, xi) => xi === i ? e.target.value : x) }))} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addGoal} className="btn-primary btn-sm flex-1"><Check size={13} /> Save Goal</button>
            <button onClick={() => setAdding(false)} className="btn-secondary btn-sm"><X size={13} /></button>
          </div>
        </div>
      )}

      {/* Goals list */}
      {filtered.length === 0 && !adding ? (
        <EmptyState icon={Target} title="No goals yet" description="Set goals with milestones to track your progress." action={{ label: "Add first goal", onClick: () => setAdding(true) }} />
      ) : (
        <div className="space-y-3">
          {filtered.map(goal => {
            const done = goal.milestones.filter(m => m.done).length;
            const total = goal.milestones.length;
            const pct = percentage(done, total);
            const isOpen = expanded === goal.id;
            return (
              <div key={goal.id} className="card py-0 px-0 overflow-hidden">
                <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors" onClick={() => setExpanded(isOpen ? null : goal.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-text-primary">{goal.title}</span>
                      <span className={`badge ${CAT_COLORS[goal.category] ?? "badge-neutral"} capitalize`}>{goal.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 progress-bar"><div className={`progress-fill ${pct >= 70 ? "bg-success" : pct >= 40 ? "bg-warning" : "bg-accent"}`} style={{ width: `${pct}%` }} /></div>
                      <span className="text-2xs text-text-tertiary font-mono">{done}/{total}</span>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp size={14} className="text-text-tertiary flex-shrink-0" /> : <ChevronDown size={14} className="text-text-tertiary flex-shrink-0" />}
                </button>
                {isOpen && total > 0 && (
                  <div className="px-4 pb-4 border-t border-surface-3 pt-3 space-y-2">
                    {goal.milestones.map((m, mi) => (
                      <button key={mi} onClick={() => toggleMilestone(goal.id, mi)} className="flex items-center gap-2 w-full text-left group">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${m.done ? "bg-success border-success" : "border-surface-4 group-hover:border-accent"}`}>
                          {m.done && <Check size={10} className="text-white" />}
                        </div>
                        <span className={`text-xs ${m.done ? "line-through text-text-tertiary" : "text-text-secondary"}`}>{m.title}</span>
                      </button>
                    ))}
                    {goal.notes && <p className="text-2xs text-text-tertiary mt-2 pt-2 border-t border-surface-3">{goal.notes}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!adding && <button onClick={() => setAdding(true)} className="btn-secondary btn-sm"><Plus size={14} /> Add Goal</button>}
      </>}
    </div>
  );
}
