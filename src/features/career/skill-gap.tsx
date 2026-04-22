"use client";

import { useState } from "react";
import { Brain, Loader2, CheckCircle, XCircle, AlertCircle, BookOpen } from "lucide-react";
import toast from "react-hot-toast";

interface SkillGapResult {
  matchedSkills: string[];
  missingSkills: string[];
  niceToHave: string[];
  matchScore: number;
  summary: string;
  learningPriorities: { skill: string; reason: string; resource: string }[];
}

interface Job {
  id: string;
  title: string;
  company: string;
  description?: string;
}

export function SkillGapAnalyzer({ jobs }: { jobs: Job[] }) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [customJD, setCustomJD] = useState("");
  const [mySkills, setMySkills] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SkillGapResult | null>(null);

  async function analyze() {
    const jd = customJD || selectedJob?.description || "";
    if (!jd.trim()) { toast.error("Need a job description"); return; }
    if (!mySkills.trim()) { toast.error("Enter your skills first"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/career/skill-gap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jd, mySkills, jobTitle: selectedJob?.title }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setResult(d.result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Brain size={14} className="text-accent" /> Skill Gap Analysis
          </h3>

          {jobs.length > 0 && (
            <div>
              <label className="label">Target job</label>
              <select className="select" value={selectedJob?.id || ""}
                onChange={(e) => { setSelectedJob(jobs.find((j) => j.id === e.target.value) || null); setCustomJD(""); }}>
                <option value="">-- Select from tracked jobs --</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} @ {j.company}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label">Or paste job description</label>
            <textarea className="textarea min-h-[100px]" placeholder="Paste job description..."
              value={customJD} onChange={(e) => { setCustomJD(e.target.value); setSelectedJob(null); }} />
          </div>

          <div>
            <label className="label">Your current skills</label>
            <textarea className="textarea min-h-[100px]"
              placeholder="e.g. TypeScript, React, Node.js, 5 years web dev, led 3-person team, AWS basics..."
              value={mySkills} onChange={(e) => setMySkills(e.target.value)} />
          </div>

          <button onClick={analyze} disabled={loading} className="btn-primary w-full">
            {loading ? <><Loader2 size={14} className="animate-spin" /> Analysing…</> : "Analyse Skill Gap"}
          </button>
        </div>

        {!result && !loading && (
          <div className="card flex items-center justify-center text-text-tertiary text-sm">
            Analysis results will appear here
          </div>
        )}

        {loading && (
          <div className="card flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-accent" />
          </div>
        )}

        {result && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Match Analysis</h3>
              <div className={`text-2xl font-bold ${result.matchScore >= 70 ? "text-success" : result.matchScore >= 50 ? "text-warning" : "text-danger"}`}>
                {result.matchScore}%
              </div>
            </div>

            <p className="text-xs text-text-secondary">{result.summary}</p>

            <div>
              <p className="text-xs font-semibold text-success mb-2 flex items-center gap-1">
                <CheckCircle size={12} /> You have ({result.matchedSkills.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {result.matchedSkills.map((s) => (
                  <span key={s} className="badge-neutral text-success">{s}</span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-danger mb-2 flex items-center gap-1">
                <XCircle size={12} /> Missing ({result.missingSkills.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {result.missingSkills.map((s) => (
                  <span key={s} className="badge-reject">{s}</span>
                ))}
              </div>
            </div>

            {result.niceToHave.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-warning mb-2 flex items-center gap-1">
                  <AlertCircle size={12} /> Nice to have ({result.niceToHave.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {result.niceToHave.map((s) => (
                    <span key={s} className="badge-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {result && result.learningPriorities.length > 0 && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <BookOpen size={14} className="text-accent" /> Learning Priorities
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {result.learningPriorities.map((p, i) => (
              <div key={i} className="bg-surface-2 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xs text-accent font-bold">#{i + 1}</span>
                  <span className="text-sm font-semibold text-text-primary">{p.skill}</span>
                </div>
                <p className="text-2xs text-text-secondary">{p.reason}</p>
                <p className="text-2xs text-accent mt-1">{p.resource}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
