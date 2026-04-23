"use client";

import { usePathname } from "next/navigation";
import { Search, Sun, Moon, Sparkles, Cpu, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthenticatedAppUser } from "@/types";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "./notification-center";
import { FocusTimer } from "./focus-timer";

const PAGE_META: Record<string, { label: string; detail: string }> = {
  "/overview": {
    label: "Overview",
    detail: "Weekly posture, focus, and system health",
  },
  "/life-os": {
    label: "Life OS",
    detail: "Planning, review, and operating cadence",
  },
  "/career": {
    label: "Career",
    detail: "Recruiting intelligence and job pipeline",
  },
  "/decisions": {
    label: "Decisions",
    detail: "Executive memory, risk review, and outcomes",
  },
  "/routines": {
    label: "Routines",
    detail: "Execution stability and consistency control",
  },
  "/money": {
    label: "Money",
    detail: "Cash runway, categorisation, and financial risk",
  },
  "/imports": {
    label: "Imports",
    detail: "Structured intake for jobs, CVs, and bank data",
  },
  "/settings": {
    label: "Settings",
    detail: "AI runtime, connectors, and workspace control",
  },
  "/automation": {
    label: "Automation",
    detail: "Mission control for worker tasks and runtime policy",
  },
  "/goals": {
    label: "Goals",
    detail: "Targets, milestones, and execution tracking",
  },
  "/chat": {
    label: "AI Chat",
    detail: "Manual analyst mode",
  },
  "/journal": {
    label: "Journal",
    detail: "Capture, reflection, and operating notes",
  },
  "/contacts": {
    label: "Contacts",
    detail: "People, context, and relationship memory",
  },
  "/learning": {
    label: "Learning",
    detail: "Skill-building and knowledge progression",
  },
  "/calendar": {
    label: "Calendar",
    detail: "Time awareness and scheduling context",
  },
  "/health": {
    label: "Health",
    detail: "Energy, stability, and daily operating condition",
  },
};

type AiStatus = "online" | "degraded" | "offline";

function useAiStatus(): { status: AiStatus; model: string } {
  const [status, setStatus] = useState<AiStatus>("online");
  const [model, setModel] = useState("");

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/health/ai", { signal: AbortSignal.timeout(4000) });
        if (!res.ok) { setStatus("offline"); return; }
        const data = (await res.json()) as { status?: string; model?: string };
        setStatus(data.status === "ok" ? "online" : data.status === "degraded" ? "degraded" : "offline");
        if (data.model) setModel(data.model);
      } catch {
        setStatus("offline");
      }
    }
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  return { status, model };
}

export function TopBar({ user }: { user: AuthenticatedAppUser }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const { status: aiStatus, model: aiModel } = useAiStatus();

  const meta = PAGE_META[pathname] ?? {
    label: pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" / "),
    detail: "Premium operating surface",
  };

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle("light", saved === "light");
    }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("light", next === "light");
  }

  function openCommandPalette() {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  }

  return (
    <header
      className="fixed right-0 top-0 z-40"
      style={{ left: "var(--sidebar-current-width, var(--sidebar-width))" }}
    >
      <div className="px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.85)_0%,rgba(9,13,22,0.8)_100%)] px-4 py-3 shadow-[0_18px_40px_rgba(2,6,23,0.3)] backdrop-blur-xl">
          <div className="hidden min-w-0 flex-1 md:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {meta.label}
            </p>
            <p className="mt-0.5 truncate text-sm text-slate-300">{meta.detail}</p>
          </div>

          <div className="hidden items-center gap-2 xl:flex">
            <AiStatusChip status={aiStatus} model={aiModel} />
            <UtilityChip
              icon={Cpu}
              label={user.isAdmin ? "Worker Ready" : "Worker"}
              tone={user.isAdmin ? "ready" : "muted"}
            />
            <UtilityChip
              icon={ShieldCheck}
              label={user.isAdmin ? "Admin" : "Member"}
              tone={user.isAdmin ? "ready" : "muted"}
            />
          </div>

          <button
            onClick={openCommandPalette}
            className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-xs text-slate-400 transition-all duration-150 hover:border-white/20 hover:bg-white/10 hover:text-white md:flex"
            aria-label="Open command palette"
          >
            <Search size={13} />
            <span>Command</span>
            <span className="rounded-md border border-white/10 bg-white/8 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Ctrl K
            </span>
          </button>

          <FocusTimer />

          <button
            onClick={toggleTheme}
            className="btn-icon btn-ghost text-slate-400 hover:bg-white/8 hover:text-white"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <NotificationCenter />
        </div>
      </div>
    </header>
  );
}

function AiStatusChip({ status, model }: { status: AiStatus; model: string }) {
  const toneStyles = {
    online: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    degraded: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    offline: "border-rose-400/25 bg-rose-400/10 text-rose-300",
  };
  const dotStyles = {
    online: "bg-emerald-400",
    degraded: "bg-amber-400 animate-pulse",
    offline: "bg-rose-400",
  };
  const label = status === "online" ? model : status === "degraded" ? "AI Degraded" : "AI Offline";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        toneStyles[status]
      )}
      title={`AI runtime: ${model}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", dotStyles[status])} />
      <Sparkles size={11} />
      {label}
    </span>
  );
}

function UtilityChip({
  icon: Icon,
  label,
  tone = "default",
}: {
  icon: typeof Zap;
  label: string;
  tone?: "default" | "ready" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        tone === "ready"
          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
          : tone === "muted"
            ? "border-white/10 bg-white/5 text-slate-500"
            : "border-blue-400/25 bg-blue-400/10 text-blue-200"
      )}
    >
      <Icon size={11} />
      {label}
    </span>
  );
}
