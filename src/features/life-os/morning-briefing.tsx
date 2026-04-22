"use client";

import { useState, useEffect } from "react";
import { Sun, RefreshCw, Copy, Check, Loader2 } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";

interface Briefing {
  greeting: string;
  priorities: string[];
  financialSnapshot: string;
  careerUpdate: string;
  habitReminder: string;
  motivationalNote: string;
  generatedAt: string;
}

export function MorningBriefing() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem("morning-briefing");
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Briefing;
        const isToday = parsed.generatedAt?.startsWith(
          new Date().toISOString().slice(0, 10)
        );
        if (isToday) {
          setBriefing(parsed);
          return;
        }
      } catch {
        // Ignore stale cached data.
      }
    }
    void generate();
  }, []);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/life-os/morning-briefing", {
        method: "POST",
      });
      const d = (await res.json()) as { briefing: Briefing };
      setBriefing(d.briefing);
      localStorage.setItem("morning-briefing", JSON.stringify(d.briefing));
    } catch {
      toast.error("Briefing failed - check AI connection");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!briefing) return;
    const text = [
      briefing.greeting,
      "",
      "Priorities",
      ...briefing.priorities.map((p, i) => `${i + 1}. ${p}`),
      "",
      `Finance: ${briefing.financialSnapshot}`,
      `Career: ${briefing.careerUpdate}`,
      `Habits: ${briefing.habitReminder}`,
      "",
      briefing.motivationalNote,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sun size={18} className="text-warning" />
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Morning Briefing
              </h3>
              <p className="text-xs text-text-tertiary">
                {format(new Date(), "EEEE, d MMMM yyyy")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {briefing && (
              <button onClick={copy} className="btn-ghost btn-sm">
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            )}
            <button
              onClick={generate}
              disabled={loading}
              className="btn-secondary btn-sm flex items-center gap-1.5"
            >
              {loading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              Refresh
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 size={24} className="animate-spin text-accent" />
            <p className="text-sm text-text-secondary">
              Preparing your briefing...
            </p>
          </div>
        )}

        {!loading && !briefing && (
          <div className="text-center py-10 text-text-secondary text-sm">
            Click Refresh to generate your morning briefing
          </div>
        )}

        {briefing && !loading && (
          <div className="space-y-4">
            <p className="text-base font-medium text-text-primary">
              {briefing.greeting}
            </p>

            <div>
              <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">
                Today&apos;s Priorities
              </p>
              <ol className="space-y-1.5">
                {briefing.priorities.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-text-primary"
                  >
                    <span className="text-accent font-bold text-xs mt-0.5 w-4">
                      {i + 1}.
                    </span>
                    {p}
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  label: "Finance",
                  text: briefing.financialSnapshot,
                },
                {
                  label: "Career",
                  text: briefing.careerUpdate,
                },
                {
                  label: "Habits",
                  text: briefing.habitReminder,
                },
              ].map((section) => (
                <div
                  key={section.label}
                  className="bg-surface-2 rounded-lg p-3"
                >
                  <p className="text-xs font-semibold text-text-tertiary mb-1">
                    {section.label}
                  </p>
                  <p className="text-xs text-text-primary leading-relaxed">
                    {section.text}
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-accent-subtle border border-accent/20 rounded-lg p-3">
              <p className="text-sm text-text-primary italic">
                {briefing.motivationalNote}
              </p>
            </div>

            <p className="text-2xs text-text-tertiary text-right">
              Generated{" "}
              {briefing.generatedAt
                ? format(new Date(briefing.generatedAt), "HH:mm")
                : "today"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
