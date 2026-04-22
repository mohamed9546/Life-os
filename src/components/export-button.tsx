"use client";

import { Download, FileText } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

interface ExportButtonProps {
  module: "jobs" | "transactions" | "decisions" | "routines" | "goals" | "contacts" | "learning";
  label?: string;
}

export function ExportButton({ module, label }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function exportCSV() {
    setLoading(true);
    try {
      const res = await fetch(`/api/export?module=${module}&format=csv`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `life-os-${module}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported successfully");
    } catch {
      toast.error("Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={exportCSV}
      disabled={loading}
      className="btn-ghost btn-sm gap-1.5 text-text-tertiary hover:text-text-primary"
      title={`Export ${module} as CSV`}
    >
      <Download size={13} />
      <span>{loading ? "Exporting…" : label ?? "Export CSV"}</span>
    </button>
  );
}
