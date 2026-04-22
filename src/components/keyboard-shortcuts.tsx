"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Keyboard } from "lucide-react";

const SHORTCUTS = [
  { keys: ["Ctrl", "K"],        label: "Open command palette" },
  { keys: ["Ctrl", "Shift", "F"], label: "Toggle focus mode" },
  { keys: ["?"],                label: "Show this cheatsheet" },
  { keys: ["G", "O"],          label: "Go to Overview" },
  { keys: ["G", "C"],          label: "Go to Career" },
  { keys: ["G", "M"],          label: "Go to Money" },
  { keys: ["G", "D"],          label: "Go to Decisions" },
  { keys: ["G", "R"],          label: "Go to Routines" },
  { keys: ["G", "J"],          label: "Go to Journal" },
  { keys: ["G", "L"],          label: "Go to Life OS" },
  { keys: ["Esc"],             label: "Close modals / panels" },
];

const GOTO: Record<string, string> = {
  o: "/overview", c: "/career", m: "/money",
  d: "/decisions", r: "/routines", j: "/journal", l: "/life-os",
};

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [gPressed, setGPressed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;

      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        setOpen((v) => !v);
        return;
      }

      if (e.key === "Escape") {
        setOpen(false);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setFocusMode((v) => {
          const next = !v;
          document.documentElement.setAttribute("data-focus-mode", String(next));
          return next;
        });
        return;
      }

      if (e.key === "g" && !e.ctrlKey && !e.metaKey) {
        setGPressed(true);
        setTimeout(() => setGPressed(false), 1500);
        return;
      }

      if (gPressed && GOTO[e.key]) {
        e.preventDefault();
        router.push(GOTO[e.key]);
        setGPressed(false);
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [gPressed, router]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative glass-panel p-6 w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-accent" />
            <span className="text-sm font-semibold text-text-primary">Keyboard Shortcuts</span>
          </div>
          <button onClick={() => setOpen(false)} className="text-text-tertiary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-text-secondary">{s.label}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, ki) => (
                  <span key={ki} className="px-2 py-0.5 rounded bg-surface-3 text-2xs font-mono text-text-primary border border-surface-4">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-2xs text-text-tertiary text-center mt-4">Press ? to toggle this panel</p>
      </div>
    </div>
  );
}
