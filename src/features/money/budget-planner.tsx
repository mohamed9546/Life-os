"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Check, X } from "lucide-react";
import toast from "react-hot-toast";
import { percentage } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { DollarSign } from "lucide-react";

interface Budget {
  id: string;
  category: string;
  monthlyLimit: number;
  month: string;
  spent: number;
}

function BudgetCard({ budget, onEdit }: { budget: Budget; onEdit: (b: Budget) => void }) {
  const pct = percentage(budget.spent, budget.monthlyLimit);
  const barColor = pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-success";
  const textColor = pct >= 90 ? "text-danger" : pct >= 70 ? "text-warning" : "text-success";

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">{budget.category}</span>
        <button onClick={() => onEdit(budget)} className="btn-ghost p-1 text-text-tertiary">
          <Edit2 size={13} />
        </button>
      </div>
      <div className="progress-bar h-2">
        <div className={`progress-fill ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className={`font-mono font-semibold ${textColor}`}>£{budget.spent.toFixed(0)} spent</span>
        <span className="text-text-tertiary font-mono">£{budget.monthlyLimit.toFixed(0)} limit</span>
      </div>
      <div className="flex items-center justify-between text-2xs text-text-tertiary">
        <span>{pct}% used</span>
        <span>£{Math.max(0, budget.monthlyLimit - budget.spent).toFixed(0)} remaining</span>
      </div>
    </div>
  );
}

export function BudgetPlanner() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ category: "", monthlyLimit: "" });

  useEffect(() => {
    fetch("/api/money/budget")
      .then(r => r.json())
      .then(d => setBudgets(d.budgets ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!form.category || !form.monthlyLimit) { toast.error("Fill in all fields"); return; }
    try {
      if (editing) {
        const res = await fetch(`/api/money/budget/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ monthlyLimit: Number(form.monthlyLimit) }),
        });
        const d = await res.json();
        setBudgets(b => b.map(x => x.id === editing.id ? d.budget : x));
        toast.success("Budget updated");
      } else {
        const res = await fetch("/api/money/budget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: form.category, monthlyLimit: Number(form.monthlyLimit) }),
        });
        const d = await res.json();
        setBudgets(b => [...b, d.budget]);
        toast.success("Budget added");
      }
      setEditing(null);
      setAdding(false);
      setForm({ category: "", monthlyLimit: "" });
    } catch {
      toast.error("Failed to save budget");
    }
  }

  const totalLimit = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

  if (loading) return <div className="skeleton h-64 rounded-xl" />;

  return (
    <div className="space-y-6">
      {/* Summary */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Budget",    value: `£${totalLimit.toFixed(0)}`,   color: "text-text-primary" },
            { label: "Total Spent",     value: `£${totalSpent.toFixed(0)}`,   color: "text-danger" },
            { label: "Remaining",       value: `£${Math.max(0, totalLimit - totalSpent).toFixed(0)}`, color: "text-success" },
          ].map(m => (
            <div key={m.label} className="card text-center py-3">
              <p className="text-2xs text-text-tertiary mb-1">{m.label}</p>
              <p className={`text-lg font-mono font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {(adding || editing) && (
        <div className="card space-y-3 border-accent/30">
          <h3 className="text-sm font-semibold text-text-primary">{editing ? "Edit Budget" : "New Budget"}</h3>
          {!editing && (
            <div>
              <label className="label">Category</label>
              <input className="input" placeholder="e.g. Groceries" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            </div>
          )}
          <div>
            <label className="label">Monthly limit (£)</label>
            <input className="input" type="number" placeholder="500" value={form.monthlyLimit} onChange={e => setForm(f => ({ ...f, monthlyLimit: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary btn-sm flex-1"><Check size={13} /> Save</button>
            <button onClick={() => { setAdding(false); setEditing(null); setForm({ category: "", monthlyLimit: "" }); }} className="btn-secondary btn-sm"><X size={13} /></button>
          </div>
        </div>
      )}

      {/* Grid */}
      {budgets.length === 0 && !adding ? (
        <EmptyState icon={DollarSign} title="No budgets set" description="Set monthly limits per category to track your spending." action={{ label: "Add first budget", onClick: () => setAdding(true) }} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map(b => (
            <BudgetCard key={b.id} budget={b} onEdit={b => { setEditing(b); setForm({ category: b.category, monthlyLimit: String(b.monthlyLimit) }); }} />
          ))}
        </div>
      )}

      {!adding && !editing && (
        <button onClick={() => setAdding(true)} className="btn-secondary btn-sm">
          <Plus size={14} /> Add Budget Category
        </button>
      )}
    </div>
  );
}
