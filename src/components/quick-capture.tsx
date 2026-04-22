"use client";

import { Plus, X, Briefcase, DollarSign, GitBranch } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

type Mode = null | "job" | "transaction" | "decision";

export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  function reset() {
    setMode(null);
    setForm({});
    setOpen(false);
  }

  async function submit() {
    setLoading(true);
    try {
      if (mode === "job") {
        await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: form.title, company: form.company, url: form.url }),
        });
        toast.success("Job added to inbox");
      } else if (mode === "transaction") {
        await fetch("/api/money/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: form.description, amount: parseFloat(form.amount), date: form.date || new Date().toISOString().slice(0, 10) }),
        });
        toast.success("Transaction logged");
      } else if (mode === "decision") {
        await fetch("/api/decisions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: form.title, context: form.context }),
        });
        toast.success("Decision recorded");
      }
      reset();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {/* Mode panel */}
      {open && mode && (
        <div className="glass-panel p-4 w-72 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-text-primary capitalize">{mode === "job" ? "Add Job" : mode === "transaction" ? "Log Transaction" : "New Decision"}</span>
            <button onClick={() => setMode(null)} className="text-text-tertiary hover:text-text-primary"><X size={14} /></button>
          </div>

          {mode === "job" && (
            <div className="space-y-2">
              <input className="input" placeholder="Job title" value={form.title || ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              <input className="input" placeholder="Company" value={form.company || ""} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
              <input className="input" placeholder="URL (optional)" value={form.url || ""} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
            </div>
          )}

          {mode === "transaction" && (
            <div className="space-y-2">
              <input className="input" placeholder="Description" value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <input className="input" type="number" placeholder="Amount (£)" value={form.amount || ""} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              <input className="input" type="date" value={form.date || new Date().toISOString().slice(0, 10)} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          )}

          {mode === "decision" && (
            <div className="space-y-2">
              <input className="input" placeholder="Decision title" value={form.title || ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              <textarea className="textarea min-h-[72px]" placeholder="Context (optional)" value={form.context || ""} onChange={e => setForm(f => ({ ...f, context: e.target.value }))} />
            </div>
          )}

          <button onClick={submit} disabled={loading} className="btn-primary w-full mt-3 btn-sm">
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {/* Mode selector */}
      {open && !mode && (
        <div className="glass-panel p-2 flex flex-col gap-1 animate-slide-up">
          <button onClick={() => setMode("job")} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors">
            <Briefcase size={15} className="text-accent" /> Add Job
          </button>
          <button onClick={() => setMode("transaction")} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors">
            <DollarSign size={15} className="text-success" /> Log Transaction
          </button>
          <button onClick={() => setMode("decision")} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors">
            <GitBranch size={15} className="text-warning" /> New Decision
          </button>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => { setOpen(!open); setMode(null); }}
        className="w-12 h-12 rounded-full bg-accent-gradient shadow-glow-accent flex items-center justify-center text-white transition-all duration-200 hover:shadow-glow hover:scale-105 active:scale-95"
        aria-label="Quick capture"
      >
        <Plus size={22} className={`transition-transform duration-200 ${open ? "rotate-45" : ""}`} />
      </button>
    </div>
  );
}
