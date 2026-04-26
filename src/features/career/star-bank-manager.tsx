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

const EMPTY_FORM = {
  slug: "",
  title: "",
  tags: "",
  situation: "",
  task: "",
  action: "",
  result: "",
};

export function StarBankManager() {
  const [stories, setStories] = useState<StarStory[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadStories();
  }, []);

  useEffect(() => {
    if (!selectedSlug) {
      return;
    }
    const story = stories.find((item) => item.slug === selectedSlug);
    if (!story) {
      return;
    }
    setForm({
      slug: story.slug,
      title: story.title,
      tags: story.tags.join(", "),
      situation: story.situation,
      task: story.task,
      action: story.action,
      result: story.result,
    });
  }, [selectedSlug, stories]);

  async function loadStories() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/opencode/stars", { cache: "no-store" });
      const payload = (await response.json()) as { stories?: StarStory[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load STAR stories");
      }
      const nextStories = payload.stories || [];
      setStories(nextStories);
      if (nextStories.length > 0) {
        setSelectedSlug((current) => current || nextStories[0].slug);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load STAR stories");
    } finally {
      setLoading(false);
    }
  }

  async function saveStory() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/opencode/stars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: form.slug || undefined,
          title: form.title,
          tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          situation: form.situation,
          task: form.task,
          action: form.action,
          result: form.result,
        }),
      });
      const payload = (await response.json()) as { error?: string; story?: StarStory };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save STAR story");
      }
      await loadStories();
      if (payload.story?.slug) {
        setSelectedSlug(payload.story.slug);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save STAR story");
    } finally {
      setSaving(false);
    }
  }

  async function deleteStory() {
    if (!selectedSlug) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/opencode/stars?slug=${encodeURIComponent(selectedSlug)}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete STAR story");
      }
      setSelectedSlug(null);
      setForm(EMPTY_FORM);
      await loadStories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete STAR story");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="card space-y-3 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">STAR stories</h2>
          <button className="btn-ghost btn-sm" onClick={() => { setSelectedSlug(null); setForm(EMPTY_FORM); }}>
            New story
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-text-secondary">Loading stories...</p>
        ) : stories.length === 0 ? (
          <p className="text-sm text-text-secondary">No STAR stories saved yet.</p>
        ) : (
          <div className="space-y-2">
            {stories.map((story) => (
              <button
                key={story.slug}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${selectedSlug === story.slug ? "border-violet-400/50 bg-violet-400/10" : "border-surface-3 bg-surface-2 hover:border-surface-4"}`}
                onClick={() => setSelectedSlug(story.slug)}
              >
                <p className="text-sm font-medium text-text-primary">{story.title}</p>
                <p className="mt-1 text-xs text-text-secondary">{story.tags.join(", ") || "No tags"}</p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{selectedSlug ? "Edit STAR story" : "Create STAR story"}</h2>
          <p className="text-sm text-text-secondary mt-1">
            Build a reusable interview evidence bank with one story per file and strong retrieval tags.
          </p>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <input className="input" placeholder="Story title" value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} />
        <input className="input" placeholder="Tags separated by commas" value={form.tags} onChange={(e) => setForm((s) => ({ ...s, tags: e.target.value }))} />
        <textarea className="textarea min-h-[110px]" placeholder="Situation" value={form.situation} onChange={(e) => setForm((s) => ({ ...s, situation: e.target.value }))} />
        <textarea className="textarea min-h-[90px]" placeholder="Task" value={form.task} onChange={(e) => setForm((s) => ({ ...s, task: e.target.value }))} />
        <textarea className="textarea min-h-[120px]" placeholder="Action" value={form.action} onChange={(e) => setForm((s) => ({ ...s, action: e.target.value }))} />
        <textarea className="textarea min-h-[90px]" placeholder="Result" value={form.result} onChange={(e) => setForm((s) => ({ ...s, result: e.target.value }))} />

        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => void saveStory()} disabled={saving || !form.title.trim()}>
            {saving ? "Saving..." : selectedSlug ? "Update story" : "Save story"}
          </button>
          {selectedSlug && (
            <button className="btn-secondary" onClick={() => void deleteStory()} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete story"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
