"use client";

import { useState } from "react";
import { Brain, ChevronDown, ChevronUp, RotateCcw, Loader2, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { EmptyState } from "@/components/empty-state";

interface Job {
  id: string;
  title: string;
  company: string;
  description?: string;
  [key: string]: unknown;
}

interface Question {
  category: string;
  question: string;
  modelAnswer?: string;
  confidence?: number;
}

const CONFIDENCE_LABELS = ["", "Shaky", "Familiar", "Solid", "Strong", "Nailed it"];

export function InterviewPrep({ trackedJobs }: { trackedJobs: Job[] }) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [confidences, setConfidences] = useState<Record<number, number>>({});

  async function generateQuestions() {
    if (!selectedJob) return;
    setLoading(true);
    try {
      const res = await fetch("/api/career/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJob.id, title: selectedJob.title, company: selectedJob.company, description: selectedJob.description }),
      });
      const data = await res.json();
      setQuestions(data.questions ?? []);
      setExpanded(null);
      setConfidences({});
    } catch {
      toast.error("Failed to generate questions");
    } finally {
      setLoading(false);
    }
  }

  const categories = [...new Set(questions.map(q => q.category))];

  return (
    <div className="space-y-6">
      {/* Job selector */}
      <div className="card space-y-3">
        <label className="label">Select a job to prepare for</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {trackedJobs.length === 0 ? (
            <p className="text-xs text-text-tertiary col-span-2">No tracked jobs yet. Track a job first.</p>
          ) : trackedJobs.map(job => (
            <button
              key={job.id}
              onClick={() => { setSelectedJob(job); setQuestions([]); }}
              className={`text-left px-3 py-2 rounded-lg border text-sm transition-all duration-150 ${
                selectedJob?.id === job.id
                  ? "border-accent/40 bg-accent-subtle text-accent"
                  : "border-surface-3 bg-surface-2 text-text-secondary hover:border-surface-4 hover:text-text-primary"
              }`}
            >
              <span className="font-medium">{job.title}</span>
              <span className="text-2xs block text-text-tertiary mt-0.5">{job.company}</span>
            </button>
          ))}
        </div>
        {selectedJob && (
          <button
            onClick={generateQuestions}
            disabled={loading}
            className="btn-primary btn-sm w-full"
          >
            {loading ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : <><Brain size={14} /> Generate Interview Questions</>}
          </button>
        )}
      </div>

      {/* Questions */}
      {questions.length === 0 && !loading && selectedJob && (
        <EmptyState icon={Brain} title="No questions yet" description="Click Generate to create AI-tailored interview questions." />
      )}

      {categories.map(cat => (
        <div key={cat} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary px-1">{cat}</h3>
          {questions.filter(q => q.category === cat).map((q, qi) => {
            const idx = questions.indexOf(q);
            const isOpen = expanded === idx;
            return (
              <div key={qi} className="card py-0 px-0 overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left gap-3 hover:bg-surface-2 transition-colors"
                >
                  <span className="text-sm text-text-primary">{q.question}</span>
                  {confidences[idx] ? (
                    <span className="text-2xs text-success flex-shrink-0">{CONFIDENCE_LABELS[confidences[idx]]}</span>
                  ) : null}
                  {isOpen ? <ChevronUp size={14} className="text-text-tertiary flex-shrink-0" /> : <ChevronDown size={14} className="text-text-tertiary flex-shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-surface-3 pt-3 space-y-3">
                    {q.modelAnswer && (
                      <div className="bg-accent-subtle rounded-lg p-3">
                        <p className="text-2xs font-semibold text-accent uppercase tracking-wider mb-1">Model answer</p>
                        <p className="text-xs text-text-secondary leading-relaxed">{q.modelAnswer}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-2xs text-text-tertiary mb-2">My confidence</p>
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(n => (
                          <button
                            key={n}
                            onClick={() => setConfidences(c => ({ ...c, [idx]: n }))}
                            className={`flex-1 py-1.5 rounded text-2xs font-medium transition-colors ${
                              (confidences[idx] ?? 0) >= n
                                ? "bg-accent text-white"
                                : "bg-surface-3 text-text-tertiary hover:bg-surface-4"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      {confidences[idx] && (
                        <p className="text-2xs text-text-secondary mt-1 text-center">{CONFIDENCE_LABELS[confidences[idx]]}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
