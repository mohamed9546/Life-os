"use client";

import { useState } from "react";
import { Download, FileText, Table, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface ExportSection {
  id: string;
  label: string;
  endpoint: string;
  dataKey: string;
}

const SECTIONS: ExportSection[] = [
  { id: "goals", label: "Goals & Milestones", endpoint: "/api/goals", dataKey: "goals" },
  { id: "decisions", label: "Decisions", endpoint: "/api/decisions", dataKey: "decisions" },
  { id: "transactions", label: "Transactions", endpoint: "/api/money", dataKey: "transactions" },
  { id: "routines", label: "Routines", endpoint: "/api/routines", dataKey: "routines" },
  { id: "contacts", label: "Contacts", endpoint: "/api/contacts", dataKey: "contacts" },
  { id: "journal", label: "Journal Entries", endpoint: "/api/journal", dataKey: "entries" },
];

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const header = keys.join(",");
  const body = rows.map(r =>
    keys.map(k => {
      const v = r[k];
      const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")
  );
  return [header, ...body].join("\n");
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function LifeOSExport() {
  const [selected, setSelected] = useState<Set<string>>(new Set(SECTIONS.map(s => s.id)));
  const [loading, setLoading] = useState(false);

  function toggleSection(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function exportJSON() {
    setLoading(true);
    try {
      const sections = SECTIONS.filter(s => selected.has(s.id));
      const results: Record<string, unknown> = {};
      await Promise.all(sections.map(async s => {
        const r = await fetch(s.endpoint);
        const d = await r.json();
        results[s.id] = d[s.dataKey] ?? d;
      }));
      const json = JSON.stringify({ exportedAt: new Date().toISOString(), ...results }, null, 2);
      downloadBlob(json, `life-os-export-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
      toast.success("JSON exported");
    } catch { toast.error("Export failed"); }
    finally { setLoading(false); }
  }

  async function exportCSV() {
    setLoading(true);
    try {
      const sections = SECTIONS.filter(s => selected.has(s.id));
      let combined = "";
      for (const s of sections) {
        const r = await fetch(s.endpoint);
        const d = await r.json();
        const rows = (d[s.dataKey] ?? []) as Record<string, unknown>[];
        if (rows.length > 0) {
          combined += `## ${s.label}\n${toCSV(rows)}\n\n`;
        }
      }
      downloadBlob(combined, `life-os-export-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv");
      toast.success("CSV exported");
    } catch { toast.error("Export failed"); }
    finally { setLoading(false); }
  }

  async function exportMarkdown() {
    setLoading(true);
    try {
      const sections = SECTIONS.filter(s => selected.has(s.id));
      let md = `# Life OS Export\n_${new Date().toLocaleDateString("en-GB", { dateStyle: "long" })}_\n\n`;
      for (const s of sections) {
        const r = await fetch(s.endpoint);
        const d = await r.json();
        const rows = (d[s.dataKey] ?? []) as Record<string, unknown>[];
        md += `## ${s.label}\n\n`;
        if (rows.length === 0) { md += "_No data_\n\n"; continue; }
        const keys = Object.keys(rows[0]).slice(0, 6);
        md += `| ${keys.join(" | ")} |\n| ${keys.map(() => "---").join(" | ")} |\n`;
        rows.forEach(row => {
          md += `| ${keys.map(k => {
            const v = row[k];
            return v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v).replace(/\|/g, "\\|");
          }).join(" | ")} |\n`;
        });
        md += "\n";
      }
      downloadBlob(md, `life-os-export-${new Date().toISOString().slice(0, 10)}.md`, "text/markdown");
      toast.success("Markdown exported");
    } catch { toast.error("Export failed"); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Select data to export</h3>
        <div className="grid grid-cols-2 gap-2">
          {SECTIONS.map(s => (
            <label key={s.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${selected.has(s.id) ? "border-accent/40 bg-accent/5" : "border-surface-3"}`}>
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSection(s.id)} className="accent-accent" />
              <span className="text-sm text-text-primary">{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button onClick={exportJSON} disabled={loading || selected.size === 0}
          className="card flex flex-col items-center gap-2 py-5 hover:border-accent/40 transition-all cursor-pointer disabled:opacity-50">
          {loading ? <Loader2 size={20} className="text-accent animate-spin" /> : <Download size={20} className="text-accent" />}
          <span className="text-xs font-semibold text-text-primary">JSON</span>
          <span className="text-2xs text-text-tertiary">Full data</span>
        </button>
        <button onClick={exportCSV} disabled={loading || selected.size === 0}
          className="card flex flex-col items-center gap-2 py-5 hover:border-accent/40 transition-all cursor-pointer disabled:opacity-50">
          {loading ? <Loader2 size={20} className="text-accent animate-spin" /> : <Table size={20} className="text-accent" />}
          <span className="text-xs font-semibold text-text-primary">CSV</span>
          <span className="text-2xs text-text-tertiary">Spreadsheet</span>
        </button>
        <button onClick={exportMarkdown} disabled={loading || selected.size === 0}
          className="card flex flex-col items-center gap-2 py-5 hover:border-accent/40 transition-all cursor-pointer disabled:opacity-50">
          {loading ? <Loader2 size={20} className="text-accent animate-spin" /> : <FileText size={20} className="text-accent" />}
          <span className="text-xs font-semibold text-text-primary">Markdown</span>
          <span className="text-2xs text-text-tertiary">Readable report</span>
        </button>
      </div>

      <div className="card py-3 text-center">
        <p className="text-xs text-text-tertiary">All data is stored locally on your machine. Exports are downloaded directly to your browser.</p>
      </div>
    </div>
  );
}
