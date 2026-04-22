"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Brain, Briefcase, GitBranch, CheckSquare,
  DollarSign, Upload, Settings, Cpu, MessageSquare, Target,
  BookOpen, Users, GraduationCap, CalendarDays, ChevronLeft,
  ChevronRight, Zap, Heart, Workflow, ShieldCheck,
} from "lucide-react";
import { AuthenticatedAppUser } from "@/types";
import { cn } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  group?: "main" | "modules" | "system";
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", href: "/overview", icon: LayoutDashboard, group: "main" },
  { id: "life-os", label: "Life OS", href: "/life-os", icon: Brain, group: "main" },
  { id: "career", label: "Career", href: "/career", icon: Briefcase, group: "modules" },
  { id: "money", label: "Money", href: "/money", icon: DollarSign, group: "modules" },
  { id: "decisions", label: "Decisions", href: "/decisions", icon: GitBranch, group: "modules" },
  { id: "routines", label: "Routines", href: "/routines", icon: CheckSquare, group: "modules" },
  { id: "goals", label: "Goals", href: "/goals", icon: Target, group: "modules" },
  { id: "journal", label: "Journal", href: "/journal", icon: BookOpen, group: "modules" },
  { id: "contacts", label: "Contacts", href: "/contacts", icon: Users, group: "modules" },
  { id: "learning", label: "Learning", href: "/learning", icon: GraduationCap, group: "modules" },
  { id: "health", label: "Health", href: "/health", icon: Heart, group: "modules" },
  { id: "calendar", label: "Calendar", href: "/calendar", icon: CalendarDays, group: "modules" },
  { id: "chat", label: "AI Chat", href: "/chat", icon: MessageSquare, group: "modules" },
  { id: "imports", label: "Imports", href: "/imports", icon: Upload, group: "system" },
  { id: "automation", label: "Automation", href: "/automation", icon: Cpu, group: "system", adminOnly: true },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings, group: "system" },
];

const GROUP_LABELS: Record<string, string> = {
  main: "Command",
  modules: "Workstreams",
  system: "Control",
};

export function Sidebar({ user }: { user: AuthenticatedAppUser }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const navItems = NAV_ITEMS.filter((item) => !item.adminOnly || user.isAdmin);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") {
      setCollapsed(true);
      document.documentElement.style.setProperty(
        "--sidebar-current-width",
        "var(--sidebar-collapsed)"
      );
    }
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
    document.documentElement.style.setProperty(
      "--sidebar-current-width",
      next ? "var(--sidebar-collapsed)" : "var(--sidebar-width)"
    );
  }

  const width = collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)";

  const groups = (["main", "modules", "system"] as const)
    .map((groupKey) => ({
      key: groupKey,
      label: GROUP_LABELS[groupKey],
      items: navItems.filter((item) => item.group === groupKey),
    }))
    .filter((group) => group.items.length > 0);

  const initials = user.email ? user.email.slice(0, 2).toUpperCase() : "ME";

  return (
    <aside
      className="sidebar-container fixed bottom-0 left-0 top-0 z-50 flex flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(9,13,22,0.98)_0%,rgba(15,23,42,0.98)_100%)] text-slate-100 transition-all duration-300"
      style={{ width }}
    >
      <div
        className={cn(
          "border-b border-white/10",
          collapsed ? "flex justify-center px-3 py-5" : "px-5 py-5"
        )}
      >
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-[0_12px_30px_rgba(15,23,42,0.35)]">
            <Zap size={16} className="text-white" />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Personal Life OS
              </p>
              <h1 className="mt-1 text-sm font-semibold tracking-[-0.02em] text-white">
                AI-first command center
              </h1>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Career, money, routines, decisions, and automation in one operating system.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-none">
        {groups.map((group, index) => (
          <div key={group.key} className="mb-4">
            {index > 0 ? <div className="mx-2 mb-4 mt-3 border-t border-white/10" /> : null}
            {!collapsed ? (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                {group.label}
              </p>
            ) : null}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <div key={item.id} className="group relative">
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all duration-150",
                        collapsed ? "justify-center" : "",
                        isActive
                          ? "border border-white/10 bg-white text-slate-950 shadow-[0_18px_36px_rgba(15,23,42,0.18)]"
                          : "text-slate-400 hover:bg-white/6 hover:text-white"
                      )}
                    >
                      <Icon size={17} className="flex-shrink-0" />
                      {!collapsed ? (
                        <>
                          <span className="truncate">{item.label}</span>
                          {item.id === "career" ? (
                            <span className="ml-auto inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              flagship
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </Link>
                    {collapsed ? (
                      <span className="tooltip top-1/2 -translate-y-1/2 bg-slate-900 text-slate-100">
                        {item.label}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed ? (
        <div className="mx-3 mb-3 rounded-[24px] border border-white/10 bg-white/5 p-4">
          <div className="flex items-start gap-3">
            <Workflow size={16} className="mt-0.5 text-slate-300" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Runtime stance
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                Local UI with remote-ready automation and small-model AI for stable live flows.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-2 border-t border-white/10 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{user.email}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  <ShieldCheck size={10} />
                  {user.isAdmin ? "Admin" : "Member"}
                </span>
              </div>
            </div>
          </div>
        ) : null}
        {!collapsed ? <SignOutButton mode={user.mode} /> : null}

        <button
          onClick={toggle}
          className="flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-medium text-slate-400 transition-all duration-150 hover:bg-white/6 hover:text-white"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight size={14} />
          ) : (
            <>
              <ChevronLeft size={14} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
