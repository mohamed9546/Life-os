"use client";

import { useState, useEffect } from "react";
import { Plus, Target, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

interface KeyResult {
  id: string;
  description: string;
  current: number;
  target: number;
  unit: string;
}

interface Objective {
  id: string;
  title: string;
  quarter: string;
  keyResults: KeyResult[];
  status: "active" | "completed" | "paused";
}

function progressColor(pct: number) {
  if (pct >= 100) return "bg-success";
  if (pct >= 70) return "bg-info";
  if (pct >= 40) return "bg-warning";
  return "bg-danger";
}

function getQuarters(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  const quarters = [];
  for (let y = year; y >= year - 1; y--) {
    for (let qi = 4; qi >= 1; qi--) {
      quarters.push(`Q${qi} ${y}`);
    }
  }
  return quarters.slice(0, 8);
}

export function OKRTracker() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [newObj, setNewObj] = useState({ title: "", quarter: `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}` });

  useEffect(() => {
    fetch("/api/goals/okr")
      .then((r) => r.json())
      .then((d) => setObjectives(d.objectives ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save(updated: Objective[]) {
    setObjectives(updated);
    await fetch("/api/goals/okr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectives: updated }),
    }).catch(() => toast.error("Failed to save"));
  }

  async function addObjective() {
    if (!newObj.title.trim()) return;
    const obj: Objective = {
      id: `okr-${Date.now()}`,
      title: newObj.title,
      quarter: newObj.quarter,
      keyResults: [],
      status: "active",
    };
    await save([...objectives, obj]);
    setNewObj({ title: "", quarter: newObj.quarter });
    setShowAdd(false);
    setExpanded((e) => new Set([...e, obj.id]));
    toast.success("Objective added");
  }

  async function addKeyResult(objId: string) {
    const updated = objectives.map((o) =>
      o.id !== objId ? o : {
        ...o,
        keyResults: [...o.keyResults, {
          id: `kr-${Date.now()}`,
          description: "New key result",
          current: 0,
          target: 100,
          unit: "%",
        }],
      }
    );
    await save(updated);
  }

  async function updateKR(objId: string, krId: string, field: keyof KeyResult, value: string | number) {
    const updated = objectives.map((o) =>
      o.id !== objId ? o : {
        ...o,
        keyResults: o.keyResults.map((kr) =>
          kr.id !== krId ? kr : { ...kr, [field]: value }
        ),
      }
    );
    await save(updated);
  }

  async function deleteObjective(id: string) {
    await save(objectives.filter((o) => o.id !== id));
    toast.success("Objective removed");
  }

  const quarters = getQuarters();
  const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`;
  const filtered = objectives.filter((o) => o.quarter === currentQuarter || o.status === "active");

  if (loading) return <div className="skeleton h-48 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">OKRs — {currentQuarter}</h3>
          <p className="text-xs text-text-tertiary">{filtered.length} active objectives</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm flex items-center gap-1.5">
          <Plus size={13} /> Add Objective
        </button>
      </div>

      {showAdd && (
        <div className="card space-y-3 animate-slide-up">
          <input className="input" placeholder="Objective title e.g. Become a senior engineer" value={newObj.title}
            onChange={(e) => setNewObj((n) => ({ ...n, title: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && addObjective()} />
          <div className="flex gap-2">
            <select className="select flex-1" value={newObj.quarter}
              onChange={(e) => setNewObj((n) => ({ ...n, quarter: e.target.value }))}>
              {quarters.map((q) => <option key={q}>{q}</option>)}
            </select>
            <button onClick={addObjective} className="btn-primary btn-sm">Add</button>
            <button onClick={() => setShowAdd(false)} className="btn-ghost btn-sm">Cancel</button>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="card text-center py-10 text-text-secondary text-sm">
          No objectives for {currentQuarter}. Add your first OKR!
        </div>
      )}

      {filtered.map((obj) => {
        const isOpen = expanded.has(obj.id);
        const krProgress = obj.keyResults.length === 0 ? 0 :
          obj.keyResults.reduce((s, kr) => s + Math.min(100, (kr.current / (kr.target || 1)) * 100), 0) / obj.keyResults.length;

        return (
          <div key={obj.id} className="card space-y-3">
            <div className="flex items-start gap-3">
              <button onClick={() => setExpanded((e) => { const n = new Set(e); isOpen ? n.delete(obj.id) : n.add(obj.id); return n; })}
                className="mt-0.5 text-text-tertiary hover:text-text-primary">
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Target size={13} className="text-accent flex-shrink-0" />
                  <span className="text-sm font-semibold text-text-primary">{obj.title}</span>
                  <span className="badge-neutral">{obj.quarter}</span>
                  <span className={`text-xs font-bold ml-auto ${krProgress >= 70 ? "text-success" : krProgress >= 40 ? "text-warning" : "text-danger"}`}>
                    {krProgress.toFixed(0)}%
                  </span>
                </div>
                <div className="progress-bar mt-2">
                  <div className={`progress-fill ${progressColor(krProgress)}`} style={{ width: `${krProgress}%` }} />
                </div>
              </div>
              <button onClick={() => deleteObjective(obj.id)} className="text-text-tertiary hover:text-danger">
                <Trash2 size={13} />
              </button>
            </div>

            {isOpen && (
              <div className="ml-7 space-y-2">
                {obj.keyResults.map((kr) => {
                  const pct = Math.min(100, (kr.current / (kr.target || 1)) * 100);
                  return (
                    <div key={kr.id} className="bg-surface-2 rounded-lg p-3 space-y-2">
                      <input className="input text-sm py-1" value={kr.description}
                        onChange={(e) => updateKR(obj.id, kr.id, "description", e.target.value)} />
                      <div className="flex items-center gap-2">
                        <input type="number" className="input w-20 text-center text-sm py-1 font-mono" value={kr.current}
                          onChange={(e) => updateKR(obj.id, kr.id, "current", Number(e.target.value))} />
                        <span className="text-text-tertiary">/</span>
                        <input type="number" className="input w-20 text-center text-sm py-1 font-mono" value={kr.target}
                          onChange={(e) => updateKR(obj.id, kr.id, "target", Number(e.target.value))} />
                        <input className="input w-16 text-center text-sm py-1" value={kr.unit}
                          onChange={(e) => updateKR(obj.id, kr.id, "unit", e.target.value)} />
                        <div className="flex-1 progress-bar">
                          <div className={`progress-fill ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-mono w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => addKeyResult(obj.id)} className="btn-ghost btn-sm text-xs">
                  <Plus size={11} /> Add Key Result
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
