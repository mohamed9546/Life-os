"use client";

import { useState } from "react";
import { useApi } from "@/hooks/use-api";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { ScoreBar } from "@/components/score-bar";
import { ParsedJobPosting, JobFitEvaluation, AIMetadata } from "@/types";

interface ParseResponse {
  success: boolean;
  data: ParsedJobPosting;
  meta: AIMetadata;
}

interface EvalResponse {
  success: boolean;
  data: JobFitEvaluation;
  meta: AIMetadata;
}

export function PasteJobPanel() {
  const [rawText, setRawText] = useState("");
  const parseApi = useApi<ParseResponse>();
  const evalApi = useApi<EvalResponse>();
  const saveApi = useApi<{ success: boolean }>();

  const [parsed, setParsed] = useState<ParsedJobPosting | null>(null);
  const [evaluation, setEvaluation] = useState<JobFitEvaluation | null>(null);

  const handleParse = async () => {
    if (rawText.trim().length < 20) return;
    setParsed(null);
    setEvaluation(null);

    const result = await parseApi.call("/api/ai/parse-job", {
      method: "POST",
      body: JSON.stringify({ rawText }),
    });

    if (result?.success && result.data) {
      setParsed(result.data);

      // Automatically evaluate fit
      const evalResult = await evalApi.call("/api/ai/evaluate-job", {
        method: "POST",
        body: JSON.stringify({ job: result.data }),
      });

      if (evalResult?.success && evalResult.data) {
        setEvaluation(evalResult.data);
      }
    }
  };

  const handleSaveToInbox = async () => {
    if (!parsed) return;

    await saveApi.call("/api/jobs/manual", {
      method: "POST",
      body: JSON.stringify({
        rawText,
        parsed,
        evaluation,
      }),
    });
  };

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="card">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          Paste Raw Job Description
        </h3>
        <textarea
          className="textarea"
          rows={8}
          placeholder="Paste a full job posting here - the AI will parse it, extract structure, evaluate fit, and flag concerns..."
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            className="btn-primary"
            onClick={handleParse}
            disabled={
              parseApi.loading ||
              evalApi.loading ||
              rawText.trim().length < 20
            }
          >
            {parseApi.loading
              ? "Parsing..."
              : evalApi.loading
                ? "Evaluating..."
                : "Parse & Evaluate"}
          </button>
          <span className="text-xs text-text-tertiary">
            {rawText.length} chars
          </span>
          {parseApi.loading && (
            <StatusBadge status="running" label="AI parsing..." />
          )}
          {evalApi.loading && (
            <StatusBadge status="running" label="AI evaluating..." />
          )}
        </div>
        {parseApi.error && (
          <p className="text-xs text-danger mt-2">{parseApi.error}</p>
        )}
      </div>

      {/* Parsed result */}
      {parsed && (
        <div className="card animate-fade-in">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-text-primary">
                {parsed.title}
              </h3>
              <p className="text-sm text-text-secondary">
                {parsed.company} - {parsed.location}
              </p>
            </div>
            {evaluation && <PriorityBadge band={evaluation.priorityBand} />}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <MetaField label="Employment" value={parsed.employmentType} />
            <MetaField label="Seniority" value={parsed.seniority} />
            <MetaField label="Remote" value={parsed.remoteType} />
            <MetaField label="Track" value={parsed.roleTrack} />
            <MetaField label="Family" value={parsed.roleFamily} />
            <MetaField
              label="Salary"
              value={parsed.salaryText || "Not specified"}
            />
            <MetaField
              label="Parse Confidence"
              value={`${Math.round(parsed.confidence * 100)}%`}
            />
          </div>

          <p className="text-sm text-text-secondary mb-4">{parsed.summary}</p>

          {/* Scores */}
          {evaluation && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <ScoreBar score={evaluation.fitScore} label="Fit Score" />
              <ScoreBar
                score={evaluation.redFlagScore}
                label="Red Flag Score"
                colorClass={
                  evaluation.redFlagScore > 50
                    ? "bg-danger"
                    : evaluation.redFlagScore > 25
                      ? "bg-warning"
                      : "bg-success"
                }
              />
            </div>
          )}

          {/* Requirements */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <ListSection title="Must Haves" items={parsed.mustHaves} />
            <ListSection title="Nice to Haves" items={parsed.niceToHaves} />
          </div>

          {/* Red flags */}
          {parsed.redFlags.length > 0 && (
            <div className="bg-danger-muted rounded-lg p-3 mb-4">
              <p className="text-xs font-semibold text-danger mb-1">
                Red Flags
              </p>
              <ul className="text-xs text-danger space-y-0.5">
                {parsed.redFlags.map((flag, i) => (
                  <li key={i}>- {flag}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Evaluation details */}
          {evaluation && (
            <div className="space-y-4 pt-4 border-t border-surface-3">
              <div className="grid grid-cols-2 gap-4">
                <ListSection
                  title="Why Matched"
                  items={evaluation.whyMatched}
                  color="text-success"
                />
                <ListSection
                  title="Why Not"
                  items={evaluation.whyNot}
                  color="text-warning"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-text-tertiary mb-1">
                    Strategic Value
                  </p>
                  <p className="text-sm text-text-secondary">
                    {evaluation.strategicValue}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-tertiary mb-1">
                    Interviewability
                  </p>
                  <p className="text-sm text-text-secondary">
                    {evaluation.likelyInterviewability}
                  </p>
                </div>
              </div>

              <div className="bg-accent-subtle rounded-lg p-3">
                <p className="text-xs font-semibold text-accent mb-1">
                  Recommended Action
                </p>
                <p className="text-sm text-text-primary">
                  {evaluation.actionRecommendation}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  className="btn-primary btn-sm"
                  onClick={handleSaveToInbox}
                  disabled={saveApi.loading}
                >
                  Save to Inbox
                </button>
                {saveApi.data?.success && (
                  <span className="text-xs text-success">Saved</span>
                )}
                {saveApi.error && (
                  <span className="text-xs text-danger">{saveApi.error}</span>
                )}
              </div>
            </div>
          )}

          {/* Keywords */}
          {parsed.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-surface-3">
              {parsed.keywords.map((kw, i) => (
                <span key={i} className="badge-neutral">
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xs text-text-tertiary">{label}</p>
      <p className="text-xs text-text-primary font-medium capitalize mt-0.5">
        {value}
      </p>
    </div>
  );
}

function ListSection({
  title,
  items,
  color = "text-text-secondary",
}: {
  title: string;
  items: string[];
  color?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-text-tertiary mb-1">{title}</p>
      <ul className={`text-xs ${color} space-y-0.5`}>
        {items.map((item, i) => (
          <li key={i}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}
