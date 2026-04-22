"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Briefcase, DollarSign, GitBranch, CheckSquare, Target, Brain, Filter } from "lucide-react";
import { SkeletonList } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";

interface ActivityEvent { id: string; timestamp: string; type: string; module: string; title: string; href?: string; }

const MODULE_ICONS: Record<string, React.ElementType> = {
  career: Briefcase, money: DollarSign, decisions: GitBranch,
  routines: CheckSquare, goals: Target, "life-os": Brain,
};
const MODULE_COLORS: Record<string, string> = {
  career: "bg-accent/20 text-accent", money: "bg-success/20 text-success",
  decisions: "bg-warning/20 text-warning", routines: "bg-info/20 text-info",
  goals: "bg-success/20 text-success", "life-os": "bg-accent/20 text-accent",
};

export function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/activity")
      .then(r => r.json())
      .then(d => setEvents(d.events ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const modules = ["all", ...Array.from(new Set(events.map(e => e.module)))];
  const filtered = filter === "all" ? events : events.filter(e => e.module === filter);

  // Group by day
  const grouped = filtered.reduce<Record<string, ActivityEvent[]>>((acc, e) => {
    const day = e.timestamp.slice(0, 10);
    (acc[day] ??= []).push(e);
    return acc;
  }, {});

  if (loading) return <SkeletonList count={6} />;

  if (events.length === 0) {
    return <EmptyState icon={Brain} title="No activity yet" description="Actions across Career, Money, Goals, and Routines will appear here." />;
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      {modules.length > 2 && (
        <div className="flex items-center gap-1 flex-wrap">
          <Filter size={13} className="text-text-tertiary mr-1" />
          {modules.map(m => (
            <button
              key={m}
              onClick={() => setFilter(m)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === m ? "bg-accent-subtle text-accent border border-accent/20" : "text-text-tertiary hover:text-text-primary hover:bg-surface-2"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {/* Events by day */}
      {Object.entries(grouped).map(([day, dayEvents]) => (
        <div key={day}>
          <p className="text-2xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
            {day === new Date().toISOString().slice(0, 10) ? "Today" : day === new Date(Date.now() - 86400000).toISOString().slice(0, 10) ? "Yesterday" : day}
          </p>
          <div className="space-y-1">
            {dayEvents.map(e => {
              const Icon = MODULE_ICONS[e.module] ?? Brain;
              return (
                <div key={e.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-2 transition-colors">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${MODULE_COLORS[e.module] ?? "bg-surface-3 text-text-tertiary"}`}>
                    <Icon size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-primary truncate">{e.title}</p>
                    <p className="text-2xs text-text-tertiary capitalize">{e.module} · {e.type.replace(/_/g, " ")}</p>
                  </div>
                  <span className="text-2xs text-text-tertiary flex-shrink-0">
                    {formatDistanceToNow(new Date(e.timestamp), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
