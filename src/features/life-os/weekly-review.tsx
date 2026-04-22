"use client";

import { useState } from "react";
import { Loader2, CheckCircle, RefreshCw, Copy } from "lucide-react";
import toast from "react-hot-toast";

interface ReviewSection {
  title: string;
  questions: string[];
  answers: string[];
}

const DEFAULT_SECTIONS: ReviewSection[] = [
  {
    title: "Wins & Achievements",
    questions: ["What went well this week?", "What am I proud of?", "What progress did I make?"],
    answers: ["", "", ""],
  },
  {
    title: "Challenges & Learnings",
    questions: ["What was difficult?", "What did I learn?", "What would I do differently?"],
    answers: ["", "", ""],
  },
  {
    title: "Next Week Planning",
    questions: ["Top 3 priorities for next week?", "Who do I need to connect with?", "What habit do I want to strengthen?"],
    answers: ["", "", ""],
  },
];

export function WeeklyReview() {
  const [sections, setSections] = useState<ReviewSection[]>(DEFAULT_SECTIONS);
  const [aiSummary, setAiSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const weekStr = new Date().toISOString().slice(0, 10);

  function updateAnswer(sectionIdx: number, questionIdx: number, value: string) {
    setSections((prev) => prev.map((s, si) =>
      si !== sectionIdx ? s : {
        ...s,
        answers: s.answers.map((a, qi) => qi === questionIdx ? value : a),
      }
    ));
  }

  async function generateSummary() {
    const context = sections.flatMap((s) =>
      s.questions.map((q, i) => `${q}: ${s.answers[i] || "(not answered)"}`)
    ).join("\n");

    if (!sections.some((s) => s.answers.some((a) => a.trim()))) {
      toast.error("Fill in at least a few answers first");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/life-os/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, weekOf: weekStr }),
      });
      const d = await res.json();
      setAiSummary(d.summary || "");
    } catch { toast.error("AI summary failed"); }
    finally { setLoading(false); }
  }

  async function copy() {
    const text = sections.map((s) =>
      `## ${s.title}\n${s.questions.map((q, i) => `**${q}**\n${s.answers[i] || "—"}`).join("\n\n")}`
    ).join("\n\n") + (aiSummary ? `\n\n## AI Summary\n${aiSummary}` : "");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Review copied");
  }

  const answeredCount = sections.flatMap((s) => s.answers).filter((a) => a.trim()).length;
  const totalQuestions = sections.flatMap((s) => s.questions).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-text-tertiary">Week of {weekStr}</p>
          <p className="text-xs text-text-tertiary">{answeredCount}/{totalQuestions} questions answered</p>
        </div>
        <div className="flex gap-2">
          <button onClick={copy} className="btn-ghost btn-sm flex items-center gap-1.5">
            {copied ? <CheckCircle size={13} /> : <Copy size={13} />} Export
          </button>
          <button onClick={generateSummary} disabled={loading} className="btn-primary btn-sm flex items-center gap-1.5">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            AI Summary
          </button>
        </div>
      </div>

      {sections.map((section, si) => (
        <div key={si} className="card space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">{section.title}</h3>
          {section.questions.map((q, qi) => (
            <div key={qi} className="space-y-1.5">
              <label className="text-xs text-text-secondary">{q}</label>
              <textarea
                className="textarea min-h-[72px] text-sm"
                placeholder="Reflect here…"
                value={section.answers[qi]}
                onChange={(e) => updateAnswer(si, qi, e.target.value)}
              />
            </div>
          ))}
        </div>
      ))}

      {aiSummary && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">AI Synthesis</h3>
          <pre className="text-sm text-text-primary whitespace-pre-wrap font-sans leading-relaxed">
            {aiSummary}
          </pre>
        </div>
      )}
    </div>
  );
}
