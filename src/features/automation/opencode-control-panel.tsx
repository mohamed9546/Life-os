"use client";

import { useState } from "react";

export function OpenCodeControlPanel() {
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [shutdown, setShutdown] = useState({
    wins: "",
    blockers: "",
    top3: "",
    energy: "3",
    notes: "",
  });
  const [nextEnergy, setNextEnergy] = useState("3");
  const [jdInput, setJdInput] = useState({ sourceUrl: "", rawText: "" });
  const [triageText, setTriageText] = useState("");
  const [atsInput, setAtsInput] = useState({ jobText: "", cvText: "" });
  const [starQuestion, setStarQuestion] = useState("");
  const [paperIdentifier, setPaperIdentifier] = useState("");

  async function post(endpoint: string, body?: unknown, actionLabel?: string) {
    setRunning(actionLabel || endpoint);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Action failed");
      }
      setResult(payload);
      return payload;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
      return null;
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="card space-y-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          OpenCode Control Panel
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">Run the workflow helpers from the app</h2>
        <p className="mt-2 text-sm text-slate-400">
          This panel exposes the first OpenCode toolkit actions directly inside the application: shutdown capture, next-action picking, CTA-first JD ingest, ATS scoring, STAR retrieval, paper capture, follow-up generation, and regulatory watch.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Shutdown ritual</h3>
          <input className="input text-xs" placeholder="Wins separated by |" value={shutdown.wins} onChange={(e) => setShutdown((s) => ({ ...s, wins: e.target.value }))} />
          <input className="input text-xs" placeholder="Blockers separated by |" value={shutdown.blockers} onChange={(e) => setShutdown((s) => ({ ...s, blockers: e.target.value }))} />
          <input className="input text-xs" placeholder="Tomorrow top 3 separated by |" value={shutdown.top3} onChange={(e) => setShutdown((s) => ({ ...s, top3: e.target.value }))} />
          <input className="input text-xs" type="number" min="1" max="5" value={shutdown.energy} onChange={(e) => setShutdown((s) => ({ ...s, energy: e.target.value }))} />
          <textarea className="textarea min-h-[80px] text-xs" placeholder="Notes" value={shutdown.notes} onChange={(e) => setShutdown((s) => ({ ...s, notes: e.target.value }))} />
          <button
            className="btn-primary btn-sm"
            onClick={() =>
              void post(
                "/api/opencode/shutdown",
                {
                  wins: splitPipe(shutdown.wins),
                  blockers: splitPipe(shutdown.blockers),
                  top3: splitPipe(shutdown.top3),
                  energy: parseInt(shutdown.energy || "3", 10),
                  notes: shutdown.notes,
                },
                "shutdown"
              )
            }
            disabled={running !== null}
          >
            {running === "shutdown" ? "Saving..." : "Save shutdown entry"}
          </button>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Next action</h3>
          <input className="input text-xs" type="number" min="1" max="5" value={nextEnergy} onChange={(e) => setNextEnergy(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary btn-sm" onClick={() => void post("/api/opencode/next", { energy: parseInt(nextEnergy || "3", 10) }, "next")} disabled={running !== null}>
              {running === "next" ? "Running..." : "Pick next action"}
            </button>
            <button className="btn-secondary btn-sm" onClick={() => void post("/api/opencode/apps-status", undefined, "apps-status")} disabled={running !== null}>
              {running === "apps-status" ? "Refreshing..." : "Refresh apps status"}
            </button>
            <button className="btn-secondary btn-sm" onClick={() => void post("/api/opencode/followup-check", {}, "followups")} disabled={running !== null}>
              {running === "followups" ? "Generating..." : "Generate follow-ups"}
            </button>
            <button className="btn-secondary btn-sm" onClick={() => void post("/api/opencode/reg-watch", {}, "reg-watch")} disabled={running !== null}>
              {running === "reg-watch" ? "Fetching..." : "Run regulatory watch"}
            </button>
            <button className="btn-secondary btn-sm" onClick={() => void post("/api/opencode/month-review", {}, "month-review")} disabled={running !== null}>
              {running === "month-review" ? "Building..." : "Build month review"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3 xl:col-span-2">
          <h3 className="text-sm font-semibold text-white">CTA-first JD ingest</h3>
          <input className="input text-xs" placeholder="Optional JD URL" value={jdInput.sourceUrl} onChange={(e) => setJdInput((s) => ({ ...s, sourceUrl: e.target.value }))} />
          <textarea className="textarea min-h-[140px] text-xs" placeholder="Or paste raw JD text" value={jdInput.rawText} onChange={(e) => setJdInput((s) => ({ ...s, rawText: e.target.value }))} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary btn-sm" onClick={() => void post("/api/opencode/jd-ingest", jdInput, "jd-ingest")} disabled={running !== null}>
              {running === "jd-ingest" ? "Ingesting..." : "Ingest JD"}
            </button>
            <button className="btn-secondary btn-sm" onClick={() => void post("/api/opencode/track-triage", { text: jdInput.rawText || jdInput.sourceUrl }, "track-triage")} disabled={running !== null}>
              {running === "track-triage" ? "Scoring..." : "Track triage only"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3 xl:col-span-2">
          <h3 className="text-sm font-semibold text-white">ATS scorer</h3>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <textarea className="textarea min-h-[140px] text-xs" placeholder="Paste JD text" value={atsInput.jobText} onChange={(e) => setAtsInput((s) => ({ ...s, jobText: e.target.value }))} />
            <textarea className="textarea min-h-[140px] text-xs" placeholder="Paste CV text" value={atsInput.cvText} onChange={(e) => setAtsInput((s) => ({ ...s, cvText: e.target.value }))} />
          </div>
          <button className="btn-primary btn-sm" onClick={() => void post("/api/opencode/ats-score", atsInput, "ats-score")} disabled={running !== null}>
            {running === "ats-score" ? "Scoring..." : "Run ATS score"}
          </button>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">STAR retrieval</h3>
          <textarea className="textarea min-h-[100px] text-xs" placeholder="Paste an interview question" value={starQuestion} onChange={(e) => setStarQuestion(e.target.value)} />
          <button className="btn-primary btn-sm" onClick={() => void post("/api/opencode/star-pull", { question: starQuestion }, "star-pull")} disabled={running !== null}>
            {running === "star-pull" ? "Searching..." : "Find STAR stories"}
          </button>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Paper capture</h3>
          <input className="input text-xs" placeholder="PMID or DOI" value={paperIdentifier} onChange={(e) => setPaperIdentifier(e.target.value)} />
          <button className="btn-primary btn-sm" onClick={() => void post("/api/opencode/paper-grab", { identifier: paperIdentifier }, "paper-grab")} disabled={running !== null}>
            {running === "paper-grab" ? "Saving..." : "Save paper note"}
          </button>
        </section>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {result !== null && (
        <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-slate-300">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

function splitPipe(value: string): string[] {
  return value.split("|").map((item) => item.trim()).filter(Boolean);
}
