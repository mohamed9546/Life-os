"use client";

import { useState } from "react";
import { FileText, Loader2, Copy, Check } from "lucide-react";
import toast from "react-hot-toast";

interface Job {
  id: string;
  title: string;
  company: string;
  description?: string;
}

interface OptResult {
  atsScore: number;
  keywordGaps: string[];
  suggestions: { section: string; original: string; improved: string }[];
  summary: string;
}

export function CVOptimizer({ cvText, trackedJobs }: { cvText: string; trackedJobs: Job[] }) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [customJD, setCustomJD] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptResult | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  async function optimize() {
    const jd = customJD || selectedJob?.description || "";
    if (!jd.trim()) { toast.error("Provide a job description"); return; }
    if (!cvText.trim()) { toast.error("No CV text found in your profile"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/career/cv-optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvText, jobDescription: jd, jobTitle: selectedJob?.title }),
      });
      const data = await res.json();
      setResult(data.result);
    } catch {
      toast.error("CV optimization failed");
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string, idx: number) {
    await navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  }

  const scoreColor = result
    ? result.atsScore >= 70 ? "text-success" : result.atsScore >= 40 ? "text-warning" : "text-danger"
    : "";

  return (
    <div className="space-y-6">
      <div className="card space-y-3">
        <div>
          <label className="label">Select a tracked job (auto-fills JD)</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            {trackedJobs.slice(0, 6).map(job => (
              <button
                key={job.id}
                onClick={() => { setSelectedJob(job); setCustomJD(""); }}
                className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                  selectedJob?.id === job.id
                    ? "border-accent/40 bg-accent-subtle text-accent"
                    : "border-surface-3 bg-surface-2 text-text-secondary hover:border-surface-4"
                }`}
              >
                <span className="font-medium">{job.title}</span>
                <span className="block text-text-tertiary">{job.company}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Or paste a job description</label>
          <textarea
            className="textarea min-h-[100px]"
            placeholder="Paste the job description here…"
            value={customJD}
            onChange={e => { setCustomJD(e.target.value); setSelectedJob(null); }}
          />
        </div>
        <button onClick={optimize} disabled={loading} className="btn-primary w-full">
          {loading ? <><Loader2 size={14} className="animate-spin" /> Analysing CV…</> : <><FileText size={14} /> Optimise CV</>}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          {/* ATS score */}
          <div className="card flex items-center gap-4">
            <div className="text-center">
              <p className={`text-4xl font-bold font-mono ${scoreColor}`}>{result.atsScore}</p>
              <p className="text-2xs text-text-tertiary mt-1">ATS score</p>
            </div>
            <div className="flex-1 space-y-2">
              <div className="progress-bar h-2">
                <div
                  className={`progress-fill ${result.atsScore >= 70 ? "bg-success" : result.atsScore >= 40 ? "bg-warning" : "bg-danger"}`}
                  style={{ width: `${result.atsScore}%` }}
                />
              </div>
              <p className="text-xs text-text-secondary">{result.summary}</p>
            </div>
          </div>

          {/* Keyword gaps */}
          {result.keywordGaps.length > 0 && (
            <div className="card space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-danger">Missing keywords</h3>
              <div className="flex flex-wrap gap-2">
                {result.keywordGaps.map((kw, i) => (
                  <span key={i} className="badge bg-danger-muted text-danger">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Suggested rewrites</h3>
              {result.suggestions.map((s, i) => (
                <div key={i} className="card space-y-2">
                  <span className="badge badge-accent">{s.section}</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-2xs text-text-tertiary mb-1">Original</p>
                      <p className="text-xs text-text-secondary bg-surface-2 rounded-lg p-2 leading-relaxed">{s.original}</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-2xs text-success">Improved</p>
                        <button onClick={() => copy(s.improved, i)} className="btn-ghost btn-sm p-1">
                          {copied === i ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                        </button>
                      </div>
                      <p className="text-xs text-text-primary bg-success-muted rounded-lg p-2 leading-relaxed">{s.improved}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
