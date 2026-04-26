"use client";

import { useEffect, useState } from "react";

interface ArchivedJd {
  slug: string;
  sourceUrl?: string;
  savedAt: string;
  parsed: {
    title: string;
    company: string;
    location: string;
    salaryText: string | null;
    employmentType: string;
    remoteType: string;
    roleTrack: string;
    summary: string;
    keywords: string[];
    mustHaves: string[];
    niceToHaves: string[];
  };
  triage: {
    recommendedTrack: {
      label: string;
      score: number;
    };
    note: string;
  };
}

export function JdArchiveBrowser() {
  const [docs, setDocs] = useState<ArchivedJd[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selected, setSelected] = useState<ArchivedJd | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/opencode/jds", { cache: "no-store" });
        const payload = (await response.json()) as { docs?: ArchivedJd[]; error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load JD archive");
        }
        const nextDocs = payload.docs || [];
        setDocs(nextDocs);
        if (nextDocs.length > 0) {
          setSelectedSlug((current) => current || nextDocs[0].slug);
          setSelected((current) => current || nextDocs[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load JD archive");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    if (!selectedSlug) {
      return;
    }
    const local = docs.find((item) => item.slug === selectedSlug);
    if (local) {
      setSelected(local);
    }
  }, [docs, selectedSlug]);

  if (loading) {
    return <div className="card py-12 text-center text-sm text-text-secondary">Loading JD archive...</div>;
  }

  if (error) {
    return <div className="card py-12 text-center text-sm text-danger">{error}</div>;
  }

  if (docs.length === 0) {
    return <div className="card py-12 text-center text-sm text-text-secondary">No archived JDs yet. Use JD ingest from Automation to start building the archive.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="card space-y-3 max-h-[70vh] overflow-y-auto">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">Archived JDs</h2>
        <div className="space-y-2">
          {docs.map((doc) => (
            <button
              key={doc.slug}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${selectedSlug === doc.slug ? "border-violet-400/50 bg-violet-400/10" : "border-surface-3 bg-surface-2 hover:border-surface-4"}`}
              onClick={() => setSelectedSlug(doc.slug)}
            >
              <p className="text-sm font-medium text-text-primary">{doc.parsed.title}</p>
              <p className="mt-1 text-xs text-text-secondary">{doc.parsed.company} · {doc.parsed.location}</p>
              <p className="mt-2 text-[11px] text-violet-300">{doc.triage.recommendedTrack.label} · {doc.triage.recommendedTrack.score}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-4">
        {selected ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{selected.parsed.title}</h2>
                <p className="text-sm text-text-secondary mt-1">{selected.parsed.company} · {selected.parsed.location}</p>
              </div>
              <span className="badge-neutral">{new Date(selected.savedAt).toLocaleString("en-GB")}</span>
            </div>

            <div className="rounded-xl bg-accent-subtle px-4 py-3">
              <p className="text-xs font-semibold text-accent mb-1">Triage</p>
              <p className="text-sm text-text-primary">{selected.triage.recommendedTrack.label} ({selected.triage.recommendedTrack.score})</p>
              <p className="mt-1 text-xs text-text-secondary">{selected.triage.note}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <MetaCard label="Role track" value={selected.parsed.roleTrack} />
              <MetaCard label="Employment" value={selected.parsed.employmentType} />
              <MetaCard label="Remote" value={selected.parsed.remoteType} />
              <MetaCard label="Salary" value={selected.parsed.salaryText || "Not specified"} />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Summary</p>
              <p className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-text-secondary">{selected.parsed.summary}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <ListCard title="Must Haves" items={selected.parsed.mustHaves} />
              <ListCard title="Nice To Haves" items={selected.parsed.niceToHaves} />
              <ListCard title="Keywords" items={selected.parsed.keywords} />
            </div>

            {selected.sourceUrl && (
              <a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex text-sm text-accent hover:text-accent/80">
                Open original JD
              </a>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-4 py-3">
      <p className="text-2xs font-semibold uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="text-sm text-text-primary mt-2">{value}</p>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">{title}</p>
      <div className="space-y-2">
        {(items.length > 0 ? items : ["None extracted"]).map((item, index) => (
          <div key={`${title}-${index}`} className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-text-secondary">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
