"use client";

import { useState } from "react";
import { GitBranch, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import { EmptyState } from "@/components/empty-state";
import { formatDistanceToNow } from "date-fns";

interface Decision {
  id: string; title: string; context?: string; status: string;
  decidedAt?: string; outcome?: string; reflection?: string;
  [key: string]: unknown;
}

export function DecisionRetrospective({ decisions }: { decisions: Decision[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, { outcome: string; reflection: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [patterns, setPatterns] = useState<string[]>([]);

  const closed = decisions.filter(d => d.status === "decided" || d.status === "closed");

  function getForm(id: string, d: Decision) {
    return forms[id] ?? { outcome: d.outcome ?? "", reflection: d.reflection ?? "" };
  }

  async function save(d: Decision) {
    const form = getForm(d.id, d);
    setSaving(d.id);
    try {
      await fetch(`/api/decisions/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: form.outcome, reflection: form.reflection }),
      });
      toast.success("Retrospective saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(null);
    }
  }

  async function analyzePatterns() {
    if (closed.length < 2) { toast("Add at least 2 retrospectives first"); return; }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/decisions/patterns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decisions: closed }) });
      const d = await res.json();
      setPatterns(d.patterns ?? []);
    } catch {
      toast.error("Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  if (closed.length === 0) {
    return <EmptyState icon={GitBranch} title="No closed decisions" description="Decisions marked as 'decided' will appear here for retrospective review." />;
  }

  return (
    <div className="space-y-6">
      {patterns.length > 0 && (
        <div className="card border-accent/30 space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Patterns detected</h3>
          {patterns.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-accent mt-0.5">◆</span>
              <p className="text-xs text-text-secondary">{p}</p>
            </div>
          ))}
        </div>
      )}

      <button onClick={analyzePatterns} disabled={analyzing || closed.filter(d => d.reflection).length < 2} className="btn-secondary btn-sm">
        {analyzing ? <><Loader2 size={13} className="animate-spin" /> Analysing…</> : "Detect patterns across retrospectives"}
      </button>

      <div className="space-y-3">
        {closed.map(d => {
          const isOpen = expanded === d.id;
          const form = getForm(d.id, d);
          return (
            <div key={d.id} className="card py-0 px-0 overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : d.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{d.title}</p>
                  {d.decidedAt && (
                    <p className="text-2xs text-text-tertiary mt-0.5">
                      Decided {formatDistanceToNow(new Date(d.decidedAt), { addSuffix: true })}
                    </p>
                  )}
                </div>
                {form.reflection ? <span className="badge badge-high flex-shrink-0">Reviewed</span> : <span className="badge badge-neutral flex-shrink-0">Pending</span>}
                {isOpen ? <ChevronUp size={14} className="text-text-tertiary flex-shrink-0" /> : <ChevronDown size={14} className="text-text-tertiary flex-shrink-0" />}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 border-t border-surface-3 pt-3 space-y-3">
                  {d.context && (
                    <div className="bg-surface-2 rounded-lg p-3">
                      <p className="text-2xs text-text-tertiary mb-1 font-semibold uppercase tracking-wide">Original context</p>
                      <p className="text-xs text-text-secondary">{d.context}</p>
                    </div>
                  )}
                  <div>
                    <label className="label">What actually happened?</label>
                    <textarea
                      className="textarea min-h-[80px]"
                      placeholder="Describe the actual outcome…"
                      value={form.outcome}
                      onChange={e => setForms(f => ({ ...f, [d.id]: { ...getForm(d.id, d), outcome: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <label className="label">Reflection — what did you learn?</label>
                    <textarea
                      className="textarea min-h-[80px]"
                      placeholder="What would you do differently? What assumptions were wrong?"
                      value={form.reflection}
                      onChange={e => setForms(f => ({ ...f, [d.id]: { ...getForm(d.id, d), reflection: e.target.value } }))}
                    />
                  </div>
                  <button onClick={() => save(d)} disabled={saving === d.id} className="btn-primary btn-sm">
                    {saving === d.id ? "Saving…" : "Save retrospective"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
