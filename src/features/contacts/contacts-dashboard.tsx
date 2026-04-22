"use client";

import { useState, useEffect } from "react";
import { Users, Plus, Search, X, Check, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { EmptyState } from "@/components/empty-state";
import { differenceInDays, parseISO } from "date-fns";
import { SkeletonList } from "@/components/skeleton";

interface Contact { id: string; name: string; company?: string; role?: string; email?: string; linkedin?: string; notes?: string; lastContact?: string; tags: string[]; source: string; createdAt: string; }

const TAG_COLORS: Record<string, string> = {
  "recruiter": "badge-accent", "hiring-manager": "badge-high",
  "peer": "badge-low", "mentor": "badge-medium", "investor": "badge-neutral",
};

export function ContactsDashboard() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [form, setForm] = useState({ name: "", company: "", role: "", email: "", linkedin: "", tags: "" });

  useEffect(() => {
    fetch("/api/contacts").then(r => r.json()).then(d => setContacts(d.contacts ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function add() {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, tags: form.tags.split(",").map(t=>t.trim()).filter(Boolean) }),
    });
    const d = await res.json();
    setContacts(c => [...c, d.contact]);
    setAdding(false);
    setForm({ name: "", company: "", role: "", email: "", linkedin: "", tags: "" });
    toast.success("Contact added");
  }

  async function markContacted(id: string) {
    const today = new Date().toISOString().slice(0,10);
    await fetch("/api/contacts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, lastContact: today }) });
    setContacts(c => c.map(x => x.id === id ? { ...x, lastContact: today } : x));
    toast.success("Marked as contacted");
  }

  const filtered = contacts.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase()) ||
    c.role?.toLowerCase().includes(search.toLowerCase())
  );

  function staleness(c: Contact) {
    if (!c.lastContact) return "never";
    const d = differenceInDays(new Date(), parseISO(c.lastContact));
    if (d > 60) return "stale";
    if (d > 30) return "warn";
    return "ok";
  }

  if (loading) return <SkeletonList count={5} />;

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input className="input pl-8" placeholder="Search contacts…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setAdding(true)} className="btn-primary btn-sm"><Plus size={14} /> Add</button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="card space-y-3 border-accent/30">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">New Contact</h3><button onClick={() => setAdding(false)}><X size={14} className="text-text-tertiary" /></button></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({...f,name:e.target.value}))} /></div>
            <div><label className="label">Company</label><input className="input" value={form.company} onChange={e => setForm(f => ({...f,company:e.target.value}))} /></div>
            <div><label className="label">Role</label><input className="input" value={form.role} onChange={e => setForm(f => ({...f,role:e.target.value}))} /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({...f,email:e.target.value}))} /></div>
            <div><label className="label">LinkedIn URL</label><input className="input" value={form.linkedin} onChange={e => setForm(f => ({...f,linkedin:e.target.value}))} /></div>
            <div><label className="label">Tags</label><input className="input" placeholder="recruiter, mentor" value={form.tags} onChange={e => setForm(f => ({...f,tags:e.target.value}))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="btn-primary btn-sm flex-1"><Check size={13} /> Save</button>
            <button onClick={() => setAdding(false)} className="btn-secondary btn-sm"><X size={13} /></button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No contacts yet" description="Add networking contacts to track your relationships." action={{ label: "Add contact", onClick: () => setAdding(true) }} />
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const s = staleness(c);
            return (
              <div key={c.id} className="card-hover flex items-center gap-4 py-3 px-4" onClick={() => setSelected(c === selected ? null : c)}>
                <div className="w-9 h-9 rounded-lg bg-accent-gradient flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{c.name}</span>
                    {c.tags.slice(0,2).map(t => <span key={t} className={`badge ${TAG_COLORS[t] ?? "badge-neutral"}`}>{t}</span>)}
                  </div>
                  <p className="text-xs text-text-tertiary">{[c.role, c.company].filter(Boolean).join(" @ ")}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {s === "stale" && <span className="flex items-center gap-1 text-2xs text-danger"><Clock size={11} /> Overdue</span>}
                  {s === "warn"  && <span className="flex items-center gap-1 text-2xs text-warning"><Clock size={11} /> 30d+</span>}
                  <button onClick={e => { e.stopPropagation(); markContacted(c.id); }} className="btn-ghost btn-sm text-text-tertiary"><Check size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
