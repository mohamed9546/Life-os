"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  LayoutDashboard, Brain, Briefcase, DollarSign, GitBranch,
  CheckSquare, Target, BookOpen, Users, GraduationCap, CalendarDays,
  MessageSquare, Settings, Upload, Cpu, Search, ArrowRight,
} from "lucide-react";

interface Page {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
}

const PAGES: Page[] = [
  { id: "overview",  label: "Overview",   href: "/overview",  icon: LayoutDashboard },
  { id: "life-os",   label: "Life OS",    href: "/life-os",   icon: Brain },
  { id: "career",    label: "Career",     href: "/career",    icon: Briefcase },
  { id: "career-jd-archive", label: "Career JD Archive", href: "/career/jd-archive", icon: Briefcase },
  { id: "career-star-bank", label: "Career STAR Bank", href: "/career/star-bank", icon: Briefcase },
  { id: "money",     label: "Money",      href: "/money",     icon: DollarSign },
  { id: "decisions", label: "Decisions",  href: "/decisions", icon: GitBranch },
  { id: "routines",  label: "Routines",   href: "/routines",  icon: CheckSquare },
  { id: "goals",     label: "Goals",      href: "/goals",     icon: Target },
  { id: "journal",   label: "Journal",    href: "/journal",   icon: BookOpen },
  { id: "contacts",  label: "Contacts",   href: "/contacts",  icon: Users },
  { id: "learning",  label: "Learning",   href: "/learning",  icon: GraduationCap },
  { id: "calendar",  label: "Calendar",   href: "/calendar",  icon: CalendarDays },
  { id: "chat",      label: "AI Chat",    href: "/chat",      icon: MessageSquare },
  { id: "imports",   label: "Imports",    href: "/imports",   icon: Upload },
  { id: "settings",  label: "Settings",   href: "/settings",  icon: Settings },
  { id: "automation",label: "Automation", href: "/automation",icon: Cpu },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    function handleCustom() { setOpen(true); }
    document.addEventListener("keydown", handleKey);
    window.addEventListener("open-command-palette", handleCustom);
    return () => {
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("open-command-palette", handleCustom);
    };
  }, []);

  function navigate(href: string) {
    router.push(href);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div className="relative w-full max-w-xl glass-panel overflow-hidden animate-scale-in">
        <Command className="bg-transparent">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-3">
            <Search size={16} className="text-text-tertiary flex-shrink-0" />
            <Command.Input
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
              placeholder="Search pages, actions…"
              autoFocus
            />
            <kbd className="px-1.5 py-0.5 rounded bg-surface-3 text-2xs text-text-tertiary font-mono">ESC</kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="text-center text-xs text-text-tertiary py-8">
              No results found.
            </Command.Empty>

            <Command.Group heading={
              <span className="px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-text-tertiary">Pages</span>
            }>
              {PAGES.map((page) => {
                const Icon = page.icon;
                return (
                  <Command.Item
                    key={page.id}
                    value={page.label}
                    onSelect={() => navigate(page.href)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary cursor-pointer transition-colors duration-100
                      data-[selected=true]:bg-accent-subtle data-[selected=true]:text-accent"
                  >
                    <Icon size={15} />
                    <span>{page.label}</span>
                    <ArrowRight size={13} className="ml-auto opacity-50" />
                  </Command.Item>
                );
              })}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
