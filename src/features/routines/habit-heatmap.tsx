"use client";

import { useMemo, useState } from "react";
import { format, eachDayOfInterval, subDays, startOfWeek, getDay } from "date-fns";
import { clamp } from "@/lib/utils";

interface CheckIn { completedAt: string; routineId?: string; }

const CELL_COLORS = [
  "bg-surface-3",          // 0
  "bg-accent/20",          // 1
  "bg-accent/40",          // 2
  "bg-accent/65",          // 3
  "bg-accent",             // 4+
];

export function HabitHeatmap({ checkIns }: { checkIns: CheckIn[] }) {
  const [tooltip, setTooltip] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

  const { weeks, countByDate } = useMemo(() => {
    const today = new Date();
    const start = subDays(today, 364);
    const days = eachDayOfInterval({ start, end: today });

    const countByDate: Record<string, number> = {};
    checkIns.forEach(ci => {
      const d = ci.completedAt?.slice(0, 10);
      if (d) countByDate[d] = (countByDate[d] ?? 0) + 1;
    });

    // Pad so grid starts on Sunday
    const startDow = getDay(start);
    const padded = [...Array(startDow).fill(null), ...days];

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) {
      weeks.push(padded.slice(i, i + 7));
    }

    return { weeks, countByDate };
  }, [checkIns]);

  const months = useMemo(() => {
    const seen = new Set<string>();
    const result: { label: string; col: number }[] = [];
    weeks.forEach((week, col) => {
      week.forEach(day => {
        if (!day) return;
        const m = format(day, "MMM");
        if (!seen.has(m)) {
          seen.add(m);
          result.push({ label: m, col });
        }
      });
    });
    return result;
  }, [weeks]);

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Habit Activity — Past Year</h3>
        <div className="flex items-center gap-1.5 text-2xs text-text-tertiary">
          <span>Less</span>
          {CELL_COLORS.map((c, i) => <span key={i} className={`heatmap-cell ${c}`} />)}
          <span>More</span>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-none">
        <div className="inline-flex flex-col gap-1">
          {/* Month labels */}
          <div className="flex gap-1 pl-6">
            {weeks.map((_, col) => {
              const m = months.find(m => m.col === col);
              return <div key={col} className="w-3 text-2xs text-text-tertiary">{m?.label ?? ""}</div>;
            })}
          </div>

          {/* Day rows */}
          <div className="flex gap-1">
            {/* DOW labels */}
            <div className="flex flex-col gap-1 pr-1">
              {["","M","","W","","F",""].map((d,i) => (
                <div key={i} className="h-3 text-2xs text-text-tertiary leading-3">{d}</div>
              ))}
            </div>

            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) => {
                  if (!day) return <div key={di} className="heatmap-cell" />;
                  const ds = format(day, "yyyy-MM-dd");
                  const count = countByDate[ds] ?? 0;
                  const colorIdx = clamp(count, 0, CELL_COLORS.length - 1);
                  return (
                    <div
                      key={di}
                      className={`heatmap-cell ${CELL_COLORS[colorIdx]}`}
                      onMouseEnter={e => setTooltip({ date: format(day, "dd MMM yyyy"), count, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1.5 bg-surface-2 border border-surface-3 rounded-lg text-2xs text-text-primary shadow-glass pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 36 }}
        >
          <span className="font-medium">{tooltip.date}</span>
          <span className="text-text-tertiary ml-1">— {tooltip.count} check-in{tooltip.count !== 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
}
