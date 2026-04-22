"use client";

import { useEffect, useState } from "react";
import { Decision } from "@/types";
import { StatusBadge } from "@/components/status-badge";
import { DecisionOutcomeTracker } from "./decision-outcome-tracker";

type DecisionsTab = "decisions" | "outcomes";
const DECISIONS_TABS: { id: DecisionsTab; label: string }[] = [
  { id: "decisions", label: "Decisions" },
  { id: "outcomes", label: "Outcome Tracker" },
];

interface DecisionsResponse {
  decisions: Decision[];
}

interface DecisionPatternEntry {
  id: string;
  review: {
    data: {
      repeatedAssumptions: string[];
      commonRiskThemes: string[];
      avoidanceLoops: string[];
      reviewChecklist: string[];
      narrativeSummary: string;
      confidence: number;
    };
  };
  createdAt: string;
}

interface DecisionFormState {
  title: string;
  context: string;
  options: string;
  chosenOption: string;
  outcome: string;
  status: "open" | "decided" | "reviewed";
}

const INITIAL_FORM: DecisionFormState = {
  title: "",
  context: "",
  options: "",
  chosenOption: "",
  outcome: "",
  status: "open",
};

export function DecisionsDashboard() {
  const [activeTab, setActiveTab] = useState<DecisionsTab>("decisions");
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [patternReview, setPatternReview] = useState<DecisionPatternEntry | null>(null);
  const [patternLoading, setPatternLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/decisions");
      const payload = (await response.json()) as DecisionsResponse | { error?: string };
      if (!response.ok || !("decisions" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Failed to load decisions");
      }
      setDecisions(payload.decisions);
      const patternResponse = await fetch("/api/decisions/patterns");
      const patternPayload = (await patternResponse.json()) as
        | { entries?: DecisionPatternEntry[]; error?: string }
        | { error?: string };
      if (patternResponse.ok && "entries" in patternPayload) {
        setPatternReview(patternPayload.entries?.[0] || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load decisions");
    } finally {
      setLoading(false);
    }
  };

  const analyzePatterns = async () => {
    setPatternLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/decisions/patterns", { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to analyze decision patterns");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze decision patterns");
    } finally {
      setPatternLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const submit = async () => {
    if (!form.title.trim() || !form.context.trim() || !form.options.trim()) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          context: form.context.trim(),
          options: form.options
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          chosenOption: form.chosenOption.trim() || undefined,
          outcome: form.outcome.trim() || undefined,
          status: form.status,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save decision");
      }
      setForm(INITIAL_FORM);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save decision");
    } finally {
      setSaving(false);
    }
  };

  const analyze = async (decisionId: string) => {
    setAnalyzingId(decisionId);
    setError(null);
    try {
      const response = await fetch("/api/decisions/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to analyze decision");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze decision");
    } finally {
      setAnalyzingId(null);
    }
  };

  if (loading && decisions.length === 0) {
    return (
      <div className="card text-center py-12">
        <StatusBadge status="running" label="Loading decisions..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-surface-2 rounded-xl p-1">
        {DECISIONS_TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${activeTab === tab.id ? "bg-surface-0 text-text-primary shadow-sm" : "text-text-tertiary hover:text-text-primary"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "outcomes" && <DecisionOutcomeTracker decisions={decisions.map(d => ({
        id: d.id,
        title: d.title,
        decision: d.chosenOption,
        expectedOutcome: d.outcome,
        status: d.status === "open" ? "open" : "closed",
        createdAt: d.createdAt,
      }))} />}

      {activeTab === "decisions" && <>
      <section className="card space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Decision pattern memory
            </h2>
            <p className="text-sm text-text-secondary mt-2">
              Detect recurring assumptions, risk themes, and avoidance loops across your stored decisions.
            </p>
          </div>
          <button className="btn-secondary btn-sm" onClick={analyzePatterns} disabled={patternLoading}>
            {patternLoading ? "Analyzing..." : "Run pattern review"}
          </button>
        </div>

        {patternReview ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-lg bg-accent-subtle px-4 py-3">
              <p className="text-xs font-semibold text-accent mb-1">Pattern summary</p>
              <p className="text-sm text-text-primary">
                {patternReview.review.data.narrativeSummary}
              </p>
            </div>
            <div className="space-y-3">
              <DetailList
                title="Repeated assumptions"
                items={patternReview.review.data.repeatedAssumptions}
              />
              <DetailList
                title="Common risk themes"
                items={patternReview.review.data.commonRiskThemes}
              />
              <DetailList
                title="Avoidance loops"
                items={patternReview.review.data.avoidanceLoops}
              />
              <DetailList
                title="Review checklist"
                items={patternReview.review.data.reviewChecklist}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-surface-3 px-4 py-5 text-sm text-text-secondary">
            No decision pattern review yet. Generate one after you have a few decisions in the system.
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            Capture a decision
          </h2>
          <p className="text-sm text-text-secondary mt-2">
            Add the real context, the options you are weighing, and let the AI surface hidden assumptions and risks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Which CV track should I prioritize this week?"
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as "open" | "decided" | "reviewed",
                }))
              }
            >
              <option value="open">Open</option>
              <option value="decided">Decided</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Context</label>
          <textarea
            className="textarea"
            value={form.context}
            onChange={(event) =>
              setForm((current) => ({ ...current, context: event.target.value }))
            }
            placeholder="What makes this decision difficult, urgent, or high stakes?"
          />
        </div>

        <div>
          <label className="label">Options, one per line</label>
          <textarea
            className="textarea"
            value={form.options}
            onChange={(event) =>
              setForm((current) => ({ ...current, options: event.target.value }))
            }
            placeholder={"Focus QA applications\nFocus Regulatory applications\nSplit effort evenly"}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Chosen option</label>
            <input
              className="input"
              value={form.chosenOption}
              onChange={(event) =>
                setForm((current) => ({ ...current, chosenOption: event.target.value }))
              }
              placeholder="Optional until decided"
            />
          </div>
          <div>
            <label className="label">Outcome</label>
            <input
              className="input"
              value={form.outcome}
              onChange={(event) =>
                setForm((current) => ({ ...current, outcome: event.target.value }))
              }
              placeholder="Optional review note"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saving..." : "Save decision"}
          </button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </section>

      <section className="space-y-4">
        {decisions.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-sm text-text-secondary">
              No decisions yet. Capture one above to start building your review memory.
            </p>
          </div>
        ) : (
          decisions.map((decision) => (
            <div key={decision.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge-neutral">{decision.status}</span>
                    <span className="text-2xs text-text-tertiary">
                      Updated {new Date(decision.updatedAt).toLocaleString("en-GB")}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mt-2">
                    {decision.title}
                  </h3>
                  <p className="text-sm text-text-secondary mt-2">{decision.context}</p>
                </div>
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => analyze(decision.id)}
                  disabled={analyzingId !== null}
                >
                  {analyzingId === decision.id ? "Analyzing..." : "Run AI review"}
                </button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
                    Options
                  </p>
                  <ul className="space-y-2 text-sm text-text-secondary">
                    {decision.options.map((option, index) => (
                      <li key={`${decision.id}-option-${index}`} className="rounded-lg bg-surface-2 px-3 py-2">
                        {option}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  {decision.aiSummary ? (
                    <>
                      <div className="rounded-lg bg-accent-subtle px-4 py-3">
                        <p className="text-xs font-semibold text-accent mb-1">AI Summary</p>
                        <p className="text-sm text-text-primary">
                          {decision.aiSummary.data.conciseSummary}
                        </p>
                      </div>
                      <DetailList
                        title="Hidden assumptions"
                        items={decision.aiSummary.data.hiddenAssumptions}
                      />
                      <DetailList
                        title="Risks"
                        items={decision.aiSummary.data.risks}
                      />
                      <DetailList
                        title="Next review questions"
                        items={decision.aiSummary.data.nextReviewQuestions}
                      />
                    </>
                  ) : (
                    <div className="rounded-lg border border-dashed border-surface-3 px-4 py-5 text-sm text-text-secondary">
                      No AI review yet. Run one to surface assumptions, risks, and review prompts.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </section>
      </>}
    </div>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
        {title}
      </p>
      <ul className="space-y-2 text-sm text-text-secondary">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="rounded-lg bg-surface-2 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
