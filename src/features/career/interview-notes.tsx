"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Clock, Tag, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";

interface Note {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  timestamp: string;
  stage: "prep" | "phone" | "technical" | "onsite" | "debrief";
  content: string;
  tags: string[];
}

const STAGE_COLORS: Record<Note["stage"], string> = {
  prep: "badge-neutral",
  phone: "badge-accent",
  technical: "badge-high",
  onsite: "badge-medium",
  debrief: "badge-low",
};

interface Job { id: string; title: string; company: string; }

export function InterviewNotes({ jobs }: { jobs: Job[] }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    jobId: jobs[0]?.id || "",
    stage: "prep" as Note["stage"],
    content: "",
    tags: "",
  });

  useEffect(() => {
    const saved = localStorage.getItem("interview-notes");
    if (saved) { try { setNotes(JSON.parse(saved)); } catch {} }
  }, []);

  function save(updated: Note[]) {
    setNotes(updated);
    localStorage.setItem("interview-notes", JSON.stringify(updated));
  }

  function addNote() {
    if (!form.content.trim()) { toast.error("Enter note content"); return; }
    const job = jobs.find(j => j.id === form.jobId) || { title: "General", company: "" };
    const note: Note = {
      id: `note-${Date.now()}`,
      jobId: form.jobId,
      jobTitle: job.title,
      company: job.company,
      timestamp: new Date().toISOString(),
      stage: form.stage,
      content: form.content.trim(),
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
    };
    save([note, ...notes]);
    setForm(f => ({ ...f, content: "", tags: "" }));
    setShowAdd(false);
    toast.success("Note saved");
  }

  function deleteNote(id: string) {
    save(notes.filter(n => n.id !== id));
  }

  const grouped = notes.reduce<Record<string, Note[]>>((acc, n) => {
    const key = n.jobId || "general";
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-tertiary">{notes.length} interview notes</p>
        <button onClick={() => setShowAdd(s => !s)} className="btn-primary btn-sm flex items-center gap-1.5">
          <Plus size={13} /> Add Note
        </button>
      </div>

      {showAdd && (
        <div className="card space-y-3 border-accent/20">
          <h3 className="text-sm font-semibold text-text-primary">New Interview Note</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Job</label>
              <select className="select" value={form.jobId} onChange={e => setForm(f => ({ ...f, jobId: e.target.value }))}>
                <option value="">General</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title} — {j.company}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Stage</label>
              <select className="select" value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value as Note["stage"] }))}>
                {(["prep", "phone", "technical", "onsite", "debrief"] as const).map(s => (
                  <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)} Screen</option>
                ))}
              </select>
            </div>
          </div>
          <textarea className="textarea min-h-[100px] text-sm" placeholder="Questions asked, answers given, things to follow up..."
            value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
          <input className="input text-sm" placeholder="Tags (comma separated): culture, technical, behavioural"
            value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
          <div className="flex gap-2">
            <button onClick={addNote} className="btn-primary btn-sm flex-1">Save Note</button>
            <button onClick={() => setShowAdd(false)} className="btn-ghost btn-sm">Cancel</button>
          </div>
        </div>
      )}

      {notes.length === 0 && !showAdd && (
        <div className="card text-center py-10 text-text-secondary text-sm">
          No interview notes yet. Track questions, answers, and key insights for each stage.
        </div>
      )}

      {Object.entries(grouped).map(([jobId, jobNotes]) => {
        const first = jobNotes[0];
        const isOpen = expanded === jobId;
        return (
          <div key={jobId} className="card py-0 px-0 overflow-hidden">
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors"
              onClick={() => setExpanded(isOpen ? null : jobId)}>
              <div>
                <p className="text-sm font-semibold text-text-primary">{first.jobTitle || "General Notes"}</p>
                {first.company && <p className="text-xs text-text-tertiary">{first.company}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-tertiary">{jobNotes.length} note{jobNotes.length !== 1 ? "s" : ""}</span>
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-surface-3 divide-y divide-surface-3">
                {jobNotes.map(note => (
                  <div key={note.id} className="px-4 py-3 space-y-2 group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`badge ${STAGE_COLORS[note.stage]} capitalize`}>{note.stage}</span>
                        <span className="flex items-center gap-1 text-2xs text-text-tertiary">
                          <Clock size={10} />
                          {new Date(note.timestamp).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>
                      <button onClick={() => deleteNote(note.id)}
                        className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger transition-opacity">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <p className="text-sm text-text-secondary whitespace-pre-wrap">{note.content}</p>
                    {note.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {note.tags.map(tag => (
                          <span key={tag} className="flex items-center gap-0.5 text-2xs text-text-tertiary bg-surface-3 px-1.5 py-0.5 rounded">
                            <Tag size={9} /> {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
