"use client";

import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

interface CalEvent { date: string; type: "routine" | "job" | "decision" | "goal" | "journal"; label: string; color: string; href?: string; }

const TYPE_COLOR: Record<string, string> = {
  routine: "bg-success", job: "bg-accent", decision: "bg-warning",
  goal: "bg-info", journal: "bg-text-tertiary",
};

export function CalendarView() {
  const [month, setMonth] = useState(new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [routines, decisions, goals, journal] = await Promise.all([
        fetch("/api/routines").then(r => r.json()).catch(() => ({ checkIns: [] })),
        fetch("/api/decisions").then(r => r.json()).catch(() => ({ decisions: [] })),
        fetch("/api/goals").then(r => r.json()).catch(() => ({ goals: [] })),
        fetch("/api/journal").then(r => r.json()).catch(() => ({ entries: [] })),
      ]);

      const evts: CalEvent[] = [];

      (routines.checkIns ?? []).forEach((ci: { completedAt?: string; title?: string }) => {
        if (ci.completedAt) evts.push({ date: ci.completedAt.slice(0,10), type: "routine", label: ci.title ?? "Routine", color: TYPE_COLOR.routine });
      });

      (decisions.decisions ?? []).forEach((d: { reviewDate?: string; title?: string; id?: string }) => {
        if (d.reviewDate) evts.push({ date: d.reviewDate.slice(0,10), type: "decision", label: d.title ?? "Decision review", color: TYPE_COLOR.decision, href: "/decisions" });
      });

      (goals.goals ?? []).forEach((g: { targetDate?: string; title?: string }) => {
        if (g.targetDate) evts.push({ date: g.targetDate.slice(0,10), type: "goal", label: g.title ?? "Goal deadline", color: TYPE_COLOR.goal, href: "/goals" });
      });

      (journal.entries ?? []).forEach((e: { date?: string }) => {
        if (e.date) evts.push({ date: e.date, type: "journal", label: "Journal entry", color: TYPE_COLOR.journal, href: "/journal" });
      });

      setEvents(evts);
    }
    load();
  }, []);

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startDow = startOfMonth(month).getDay();
  const eventsByDate = events.reduce<Record<string, CalEvent[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});

  const selectedEvents = selected ? (eventsByDate[selected] ?? []) : [];

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        {/* Nav */}
        <div className="flex items-center justify-between">
          <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth()-1,1))} className="btn-ghost btn-sm"><ChevronLeft size={16} /></button>
          <span className="text-base font-semibold text-text-primary">{format(month, "MMMM yyyy")}</span>
          <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth()+1,1))} className="btn-ghost btn-sm"><ChevronRight size={16} /></button>
        </div>

        {/* DOW headers */}
        <div className="grid grid-cols-7 text-center text-2xs text-text-tertiary font-medium">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} className="py-1">{d}</div>)}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-1">
          {Array(startDow).fill(null).map((_,i) => <div key={`e${i}`} />)}
          {days.map(day => {
            const ds = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDate[ds] ?? [];
            const isSelected = selected === ds;
            const isTodayDay = isToday(day);
            return (
              <button
                key={ds}
                onClick={() => setSelected(isSelected ? null : ds)}
                className={`calendar-day ${isTodayDay ? "calendar-day-today" : ""} ${isSelected ? "ring-2 ring-accent" : ""}`}
              >
                <span className="text-xs">{format(day, "d")}</span>
                {dayEvents.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                    {dayEvents.slice(0,3).map((e, i) => (
                      <span key={i} className={`w-1.5 h-1.5 rounded-full ${e.color}`} />
                    ))}
                    {dayEvents.length > 3 && <span className="text-2xs text-text-tertiary">+{dayEvents.length-3}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(TYPE_COLOR).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-2xs text-text-tertiary capitalize">{type}</span>
          </div>
        ))}
      </div>

      {/* Selected day events */}
      {selected && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">{format(parseISO(selected), "EEEE, dd MMMM yyyy")}</h3>
          {selectedEvents.length === 0 ? (
            <p className="text-xs text-text-tertiary">No events on this day.</p>
          ) : selectedEvents.map((e, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${e.color}`} />
              <span className="text-sm text-text-secondary capitalize">{e.type}</span>
              <span className="text-sm text-text-primary flex-1">{e.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
