"use client";

import { useState } from "react";
import { FileText, Copy, Check, Loader2, Wand2 } from "lucide-react";
import toast from "react-hot-toast";

interface Job {
  id: string;
  title: string;
  company: string;
  description?: string;
}

interface CoverLetterResult {
  subject: string;
  body: string;
  tone: string;
  wordCount: number;
}

export function CoverLetterGenerator({ jobs }: { jobs: Job[] }) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [customJD, setCustomJD] = useState("");
  const [tone, setTone] = useState<"professional" | "enthusiastic" | "concise">("professional");
  const [highlights, setHighlights] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoverLetterResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    const jd = customJD || selectedJob?.description || "";
    if (!jd.trim()) { toast.error("Need a job description to generate from"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/career/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: selectedJob?.title || "the role",
          company: selectedJob?.company || "the company",
          jobDescription: jd,
          tone,
          highlights,
        }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setResult(d.result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(`Subject: ${result.subject}\n\n${result.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Wand2 size={14} className="text-accent" /> Generate Cover Letter
          </h3>

          {jobs.length > 0 && (
            <div>
              <label className="label">Select a tracked job</label>
              <select
                className="select"
                value={selectedJob?.id || ""}
                onChange={(e) => {
                  const j = jobs.find((j) => j.id === e.target.value) || null;
                  setSelectedJob(j);
                  if (j?.description) setCustomJD("");
                }}
              >
                <option value="">-- Choose job --</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title} @ {j.company}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Or paste job description</label>
            <textarea
              className="textarea min-h-[120px]"
              placeholder="Paste the full job description here..."
              value={customJD}
              onChange={(e) => { setCustomJD(e.target.value); setSelectedJob(null); }}
            />
          </div>

          <div>
            <label className="label">Tone</label>
            <div className="flex gap-2">
              {(["professional", "enthusiastic", "concise"] as const).map((t) => (
                <button key={t} onClick={() => setTone(t)}
                  className={`flex-1 btn-sm capitalize ${tone === t ? "btn-primary" : "btn-secondary"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Key highlights to mention</label>
            <textarea
              className="textarea min-h-[72px]"
              placeholder="e.g. 5 years TypeScript, led team of 8, built £2M product..."
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
            />
          </div>

          <button onClick={generate} disabled={loading} className="btn-primary w-full">
            {loading ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : "Generate Cover Letter"}
          </button>
        </div>

        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <FileText size={14} /> Result
            </h3>
            {result && (
              <div className="flex items-center gap-2">
                <span className="text-2xs text-text-tertiary">{result.wordCount} words · {result.tone}</span>
                <button onClick={copy} className="btn-secondary btn-sm">
                  {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
            )}
          </div>

          {!result && !loading && (
            <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm py-16">
              Generated letter will appear here
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-accent" />
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="bg-surface-2 rounded-lg p-3">
                <p className="text-xs text-text-tertiary mb-1">Subject line</p>
                <p className="text-sm font-medium text-text-primary">{result.subject}</p>
              </div>
              <div className="bg-surface-2 rounded-lg p-3 max-h-96 overflow-y-auto">
                <pre className="text-xs text-text-primary whitespace-pre-wrap font-sans leading-relaxed">
                  {result.body}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
