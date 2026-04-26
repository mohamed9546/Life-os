"use client";

import { useEffect, useState } from "react";

interface StarStory {
  slug: string;
  title: string;
  tags: string[];
  situation: string;
  task: string;
  action: string;
  result: string;
}

interface ArchivedJd {
  slug: string;
  sourceUrl?: string;
  savedAt: string;
  parsed: {
    title: string;
    company: string;
    location: string;
    roleTrack: string;
    summary: string;
    keywords: string[];
  };
  triage: {
    recommendedTrack: {
      label: string;
      score: number;
    };
    note: string;
  };
}

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
  const [stories, setStories] = useState<StarStory[]>([]);
  const [jds, setJds] = useState<ArchivedJd[]>([]);
  const [selectedStorySlug, setSelectedStorySlug] = useState<string | null>(null);
  const [starForm, setStarForm] = useState({
    slug: "",
    title: "",
    tags: "",
    situation: "",
    task: "",
    action: "",
    result: "",
  });

  useEffect(() => {
    void loadReferenceData();
  }, []);

  async function loadReferenceData() {
    try {
      const [storiesRes, jdsRes] = await Promise.all([
        fetch("/api/opencode/stars", { cache: "no-store" }),
        fetch("/api/opencode/jds", { cache: "no-store" }),
      ]);
      const storiesPayload = (await storiesRes.json()) as { stories?: StarStory[]; error?: string };
      const jdsPayload = (await jdsRes.json()) as { docs?: ArchivedJd[]; error?: string };
      if (storiesRes.ok && storiesPayload.stories) {
        setStories(storiesPayload.stories);
      }
      if (jdsRes.ok && jdsPayload.docs) {
        setJds(jdsPayload.docs);
      }
    } catch {
      // Keep panel usable even if the reference data can't be loaded.
    }
  }

  useEffect(() => {
    if (!selectedStorySlug) {
      return;
    }
    const story = stories.find((item) => item.slug === selectedStorySlug);
    if (!story) {
      return;
    }
    setStarForm({
      slug: story.slug,
      title: story.title,
      tags: story.tags.join(", "),
      situation: story.situation,
      task: story.task,
      action: story.action,
      result: story.result,
    });
  }, [selectedStorySlug, stories]);

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
      if (["jd-ingest", "star-save", "star-delete"].includes(actionLabel || "")) {
        await loadReferenceData();
      }
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

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3 xl:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-white">STAR story bank</h3>
            <button
              className="btn-ghost btn-sm"
              onClick={() => {
                setSelectedStorySlug(null);
                setStarForm({ slug: "", title: "", tags: "", situation: "", task: "", action: "", result: "" });
              }}
            >
              New story
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.1fr]">
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {stories.length === 0 ? (
                <p className="text-xs text-slate-500">No STAR stories saved yet.</p>
              ) : (
                stories.map((story) => (
                  <button
                    key={story.slug}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${selectedStorySlug === story.slug ? "border-violet-400/50 bg-violet-400/10" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}
                    onClick={() => setSelectedStorySlug(story.slug)}
                  >
                    <p className="text-sm font-medium text-white">{story.title}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{story.tags.join(", ") || "No tags"}</p>
                  </button>
                ))
              )}
            </div>

            <div className="space-y-3">
              <input className="input text-xs" placeholder="Story title" value={starForm.title} onChange={(e) => setStarForm((s) => ({ ...s, title: e.target.value }))} />
              <input className="input text-xs" placeholder="Tags separated by commas" value={starForm.tags} onChange={(e) => setStarForm((s) => ({ ...s, tags: e.target.value }))} />
              <textarea className="textarea min-h-[88px] text-xs" placeholder="Situation" value={starForm.situation} onChange={(e) => setStarForm((s) => ({ ...s, situation: e.target.value }))} />
              <textarea className="textarea min-h-[72px] text-xs" placeholder="Task" value={starForm.task} onChange={(e) => setStarForm((s) => ({ ...s, task: e.target.value }))} />
              <textarea className="textarea min-h-[88px] text-xs" placeholder="Action" value={starForm.action} onChange={(e) => setStarForm((s) => ({ ...s, action: e.target.value }))} />
              <textarea className="textarea min-h-[72px] text-xs" placeholder="Result" value={starForm.result} onChange={(e) => setStarForm((s) => ({ ...s, result: e.target.value }))} />
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-primary btn-sm"
                  onClick={() =>
                    void post(
                      "/api/opencode/stars",
                      {
                        slug: starForm.slug || undefined,
                        title: starForm.title,
                        tags: starForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
                        situation: starForm.situation,
                        task: starForm.task,
                        action: starForm.action,
                        result: starForm.result,
                      },
                      "star-save"
                    )
                  }
                  disabled={running !== null || !starForm.title.trim()}
                >
                  {running === "star-save" ? "Saving..." : selectedStorySlug ? "Update story" : "Save story"}
                </button>
                {selectedStorySlug && (
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() =>
                      void (async () => {
                        setRunning("star-delete");
                        setError(null);
                        try {
                          const response = await fetch(`/api/opencode/stars?slug=${encodeURIComponent(selectedStorySlug)}`, { method: "DELETE" });
                          const payload = await response.json();
                          if (!response.ok) {
                            throw new Error(payload.error || "Delete failed");
                          }
                          setResult(payload);
                          setSelectedStorySlug(null);
                          setStarForm({ slug: "", title: "", tags: "", situation: "", task: "", action: "", result: "" });
                          await loadReferenceData();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Delete failed");
                        } finally {
                          setRunning(null);
                        }
                      })()
                    }
                    disabled={running !== null}
                  >
                    {running === "star-delete" ? "Deleting..." : "Delete story"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">JD archive</h3>
            <button className="btn-ghost btn-sm" onClick={() => void loadReferenceData()}>
              Refresh archive
            </button>
          </div>
          {jds.length === 0 ? (
            <p className="text-xs text-slate-500">No archived job documents yet. Ingest a JD to start building the archive.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {jds.slice(0, 12).map((doc) => (
                <div key={doc.slug} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{doc.parsed.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {doc.parsed.company} · {doc.parsed.location}
                      </p>
                    </div>
                    <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">
                      {doc.triage.recommendedTrack.label} {doc.triage.recommendedTrack.score}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 line-clamp-2">{doc.parsed.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {doc.parsed.keywords.slice(0, 5).map((keyword) => (
                      <span key={keyword} className="badge-neutral text-[10px]">{keyword}</span>
                    ))}
                  </div>
                  {doc.sourceUrl && (
                    <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[11px] text-violet-300 hover:text-violet-200">
                      Open source URL
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
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
