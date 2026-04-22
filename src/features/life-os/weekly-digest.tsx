"use client";

import { useState } from "react";
import { Copy, Check, Loader2, FileText, Mail } from "lucide-react";
import toast from "react-hot-toast";

export function WeeklyDigest() {
  const [digest, setDigest] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/life-os/digest", { method: "POST" });
      const d = await res.json();
      setDigest(d.digest ?? "");
    } catch {
      toast.error("Failed to generate digest");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(digest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  }

  const emailHref = digest
    ? `mailto:?subject=Life OS Weekly Digest&body=${encodeURIComponent(digest)}`
    : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={generate} disabled={loading} className="btn-primary btn-sm">
          {loading ? <><Loader2 size={13} className="animate-spin" /> Generating…</> : <><FileText size={13} /> Generate Weekly Digest</>}
        </button>
        {digest && (
          <>
            <button onClick={copy} className="btn-secondary btn-sm gap-1.5">
              {copied ? <><Check size={13} className="text-success" /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
            {emailHref && (
              <a href={emailHref} className="btn-ghost btn-sm gap-1.5">
                <Mail size={13} /> Email to self
              </a>
            )}
          </>
        )}
      </div>

      {digest && (
        <div className="card bg-surface-2 border-surface-3 overflow-hidden">
          <pre className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap font-mono overflow-x-auto">
            {digest}
          </pre>
        </div>
      )}
    </div>
  );
}
