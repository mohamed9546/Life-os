"use client";

import { useState, useMemo } from "react";
import { CheckCircle, XCircle, Minus, TrendingUp, Brain } from "lucide-react";
import toast from "react-hot-toast";

interface Decision {
  id: string;
  title: string;
  decision?: string;
  expectedOutcome?: string;
  status: string;
  createdAt: string;
}

interface OutcomeReview {
  decisionId: string;
  actualOutcome: string;
  rating: "better" | "as_expected" | "worse";
  learnings: string;
  reviewedAt: string;
}

const RATING_CONFIG = {
  better: { icon: TrendingUp, color: "text-success", bg: "bg-success/10", label: "Better than expected" },
  as_expected: { icon: Minus, color: "text-info", bg: "bg-info/10", label: "As expected" },
  worse: { icon: XCircle, color: "text-danger", bg: "bg-danger/10", label: "Worse than expected" },
};

export function DecisionOutcomeTracker({ decisions }: { decisions: Decision[] }) {
  const [reviews, setReviews] = useState<OutcomeReview[]>(() => {
    try { return JSON.parse(localStorage.getItem("decision-outcomes") || "[]"); } catch { return []; }
  });
  const [active, setActive] = useState<string | null>(null);
  const [form, setForm] = useState({ actualOutcome: "", rating: "as_expected" as OutcomeReview["rating"], learnings: "" });

  const closedDecisions = decisions.filter(d => d.status === "closed" || d.status === "done" || d.status === "resolved");
  const pendingReview = closedDecisions.filter(d => !reviews.find(r => r.decisionId === d.id));
  const reviewed = closedDecisions.filter(d => reviews.find(r => r.decisionId === d.id));

  const stats = useMemo(() => ({
    better: reviews.filter(r => r.rating === "better").length,
    as_expected: reviews.filter(r => r.rating === "as_expected").length,
    worse: reviews.filter(r => r.rating === "worse").length,
    calibrationScore: reviews.length > 0
      ? Math.round(((reviews.filter(r => r.rating !== "worse").length) / reviews.length) * 100)
      : null,
  }), [reviews]);

  function saveReview(decisionId: string) {
    if (!form.actualOutcome.trim()) { toast.error("Describe the actual outcome"); return; }
    const review: OutcomeReview = {
      decisionId,
      actualOutcome: form.actualOutcome.trim(),
      rating: form.rating,
      learnings: form.learnings.trim(),
      reviewedAt: new Date().toISOString(),
    };
    const updated = [...reviews.filter(r => r.decisionId !== decisionId), review];
    setReviews(updated);
    localStorage.setItem("decision-outcomes", JSON.stringify(updated));
    setActive(null);
    setForm({ actualOutcome: "", rating: "as_expected", learnings: "" });
    toast.success("Outcome recorded");
  }

  return (
    <div className="space-y-5">
      {reviews.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-success">{stats.better}</p>
            <p className="text-2xs text-text-tertiary mt-1">Better than expected</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-info">{stats.as_expected}</p>
            <p className="text-2xs text-text-tertiary mt-1">As expected</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-danger">{stats.worse}</p>
            <p className="text-2xs text-text-tertiary mt-1">Worse than expected</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-accent">{stats.calibrationScore ?? "—"}%</p>
            <p className="text-2xs text-text-tertiary mt-1">Calibration score</p>
          </div>
        </div>
      )}

      {pendingReview.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Brain size={14} className="text-accent" /> Awaiting outcome review ({pendingReview.length})
          </h3>
          {pendingReview.map(d => (
            <div key={d.id} className="card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{d.title}</p>
                  {d.decision && <p className="text-xs text-text-secondary mt-1">Decision: {d.decision}</p>}
                  {d.expectedOutcome && <p className="text-xs text-text-tertiary mt-1">Expected: {d.expectedOutcome}</p>}
                </div>
                <button onClick={() => setActive(active === d.id ? null : d.id)} className="btn-secondary btn-sm">
                  {active === d.id ? "Cancel" : "Review"}
                </button>
              </div>

              {active === d.id && (
                <div className="space-y-3 border-t border-surface-3 pt-3">
                  <div>
                    <label className="label">What actually happened?</label>
                    <textarea className="textarea min-h-[72px] text-sm" placeholder="Describe the real outcome..."
                      value={form.actualOutcome} onChange={e => setForm(f => ({ ...f, actualOutcome: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">How did it compare to your expectation?</label>
                    <div className="flex gap-2">
                      {(["better", "as_expected", "worse"] as const).map(r => {
                        const cfg = RATING_CONFIG[r];
                        return (
                          <button key={r} onClick={() => setForm(f => ({ ...f, rating: r }))}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-all ${form.rating === r ? `${cfg.bg} ${cfg.color} border-current` : "border-surface-3 text-text-tertiary"}`}>
                            <cfg.icon size={12} /> {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="label">Key learnings</label>
                    <textarea className="textarea min-h-[56px] text-sm" placeholder="What would you do differently?"
                      value={form.learnings} onChange={e => setForm(f => ({ ...f, learnings: e.target.value }))} />
                  </div>
                  <button onClick={() => saveReview(d.id)} className="btn-primary btn-sm w-full">
                    <CheckCircle size={13} /> Save Outcome
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Reviewed decisions</h3>
          {reviewed.map(d => {
            const review = reviews.find(r => r.decisionId === d.id)!;
            const cfg = RATING_CONFIG[review.rating];
            return (
              <div key={d.id} className={`card border-l-4 ${cfg.bg} ${review.rating === "better" ? "border-success" : review.rating === "as_expected" ? "border-info" : "border-danger"}`}>
                <div className="flex items-start gap-3">
                  <cfg.icon size={16} className={`mt-0.5 flex-shrink-0 ${cfg.color}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{d.title}</p>
                    <p className="text-xs text-text-secondary mt-1">{review.actualOutcome}</p>
                    {review.learnings && <p className="text-xs text-text-tertiary mt-1 italic">{review.learnings}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {closedDecisions.length === 0 && (
        <div className="card text-center py-10 text-text-secondary text-sm">
          No closed decisions to review yet. Close a decision to track its outcome.
        </div>
      )}
    </div>
  );
}
