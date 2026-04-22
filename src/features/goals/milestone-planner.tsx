"use client";

import { useState } from "react";
import { Loader2, Target, CheckCircle2, Circle, Plus, Wand2 } from "lucide-react";
import toast from "react-hot-toast";

interface Goal {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;
}

interface Milestone {
  id: string;
  title: string;
  week: number;
  completed: boolean;
}

interface MilestonePlan {
  goalId: string;
  milestones: Milestone[];
}

export function MilestonePlanner({ goals }: { goals: Goal[] }) {
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [plans, setPlans] = useState<MilestonePlan[]>([]);
  const [loading, setLoading] = useState(false);

  const currentPlan = selectedGoal ? plans.find((p) => p.goalId === selectedGoal.id) : null;

  async function generateMilestones() {
    if (!selectedGoal) return;
    setLoading(true);
    try {
      const res = await fetch("/api/goals/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: selectedGoal.id, title: selectedGoal.title, description: selectedGoal.description, targetDate: selectedGoal.targetDate }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setPlans((prev) => {
        const filtered = prev.filter((p) => p.goalId !== selectedGoal.id);
        return [...filtered, { goalId: selectedGoal.id, milestones: d.milestones }];
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate milestones");
    } finally {
      setLoading(false);
    }
  }

  function toggleMilestone(milestoneId: string) {
    if (!selectedGoal) return;
    setPlans((prev) => prev.map((p) =>
      p.goalId !== selectedGoal.id ? p : {
        ...p,
        milestones: p.milestones.map((m) => m.id === milestoneId ? { ...m, completed: !m.completed } : m),
      }
    ));
  }

  function addMilestone() {
    if (!selectedGoal) return;
    const plan = plans.find((p) => p.goalId === selectedGoal.id);
    const maxWeek = plan ? Math.max(...plan.milestones.map((m) => m.week), 0) + 1 : 1;
    const newM: Milestone = { id: `ms-${Date.now()}`, title: "New milestone", week: maxWeek, completed: false };
    setPlans((prev) => {
      const existing = prev.find((p) => p.goalId === selectedGoal.id);
      if (existing) return prev.map((p) => p.goalId === selectedGoal.id ? { ...p, milestones: [...p.milestones, newM] } : p);
      return [...prev, { goalId: selectedGoal.id, milestones: [newM] }];
    });
  }

  const completedCount = currentPlan?.milestones.filter((m) => m.completed).length ?? 0;
  const totalCount = currentPlan?.milestones.length ?? 0;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <Target size={15} className="text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">Milestone Planner</h3>
        </div>

        <div className="flex gap-2">
          <select className="select flex-1" value={selectedGoal?.id || ""}
            onChange={(e) => setSelectedGoal(goals.find((g) => g.id === e.target.value) || null)}>
            <option value="">Select a goal…</option>
            {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
          {selectedGoal && (
            <button onClick={generateMilestones} disabled={loading} className="btn-primary btn-sm flex items-center gap-1.5">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              AI Plan
            </button>
          )}
        </div>
      </div>

      {selectedGoal && (
        <div className="card space-y-4">
          {currentPlan && (
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 progress-bar">
                <div className="progress-fill bg-accent" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-xs font-mono text-accent">{completedCount}/{totalCount}</span>
            </div>
          )}

          {!currentPlan && !loading && (
            <p className="text-sm text-text-secondary text-center py-4">
              Click &quot;AI Plan&quot; to auto-generate weekly milestones, or add them manually below.
            </p>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-accent" />
            </div>
          )}

          {currentPlan && (
            <div className="space-y-2">
              {currentPlan.milestones.map((m) => (
                <div key={m.id} className={`flex items-start gap-3 p-3 rounded-lg transition-all ${m.completed ? "bg-surface-2 opacity-70" : "bg-surface-2"}`}>
                  <button onClick={() => toggleMilestone(m.id)} className="mt-0.5 flex-shrink-0">
                    {m.completed
                      ? <CheckCircle2 size={16} className="text-success" />
                      : <Circle size={16} className="text-text-tertiary" />
                    }
                  </button>
                  <div className="flex-1">
                    <span className={`text-sm ${m.completed ? "line-through text-text-tertiary" : "text-text-primary"}`}>
                      {m.title}
                    </span>
                    <span className="ml-2 text-2xs text-text-tertiary">Week {m.week}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={addMilestone} className="btn-ghost btn-sm flex items-center gap-1.5 w-full justify-center">
            <Plus size={13} /> Add Milestone
          </button>
        </div>
      )}
    </div>
  );
}
