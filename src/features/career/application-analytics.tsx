"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList } from "recharts";

interface Job {
  id: string;
  status: string;
  appliedAt?: string;
  trackedAt?: string;
}

const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface-2)",
  border: "1px solid var(--surface-3)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--text-primary)",
};

const STAGE_COLORS: Record<string, string> = {
  inbox: "#6b7280",
  tracked: "#6366f1",
  applied: "#f59e0b",
  interview: "#3b82f6",
  offer: "#22c55e",
  rejected: "#ef4444",
};

export function ApplicationAnalytics({ jobs }: { jobs: Job[] }) {
  const stats = useMemo(() => {
    const byStatus = jobs.reduce<Record<string, number>>((acc, j) => {
      acc[j.status] = (acc[j.status] ?? 0) + 1;
      return acc;
    }, {});

    const stages = ["inbox", "tracked", "applied", "interview", "offer", "rejected"];
    const funnelData = stages.map((s) => ({ name: s.charAt(0).toUpperCase() + s.slice(1), value: byStatus[s] ?? 0, fill: STAGE_COLORS[s] }));

    const applied = byStatus.applied ?? 0;
    const interview = byStatus.interview ?? 0;
    const offer = byStatus.offer ?? 0;

    const interviewRate = applied > 0 ? ((interview / applied) * 100).toFixed(0) : "0";
    const offerRate = interview > 0 ? ((offer / interview) * 100).toFixed(0) : "0";

    // Monthly applications
    const monthly: Record<string, number> = {};
    jobs.filter((j) => j.appliedAt || j.trackedAt).forEach((j) => {
      const date = new Date(j.appliedAt || j.trackedAt || "");
      if (isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthly[key] = (monthly[key] ?? 0) + 1;
    });

    const monthlyData = Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, count]) => ({ month: month.slice(5), count }));

    return { byStatus, funnelData, interviewRate, offerRate, applied, interview, offer, total: jobs.length, monthlyData };
  }, [jobs]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Jobs", value: stats.total, color: "text-text-primary" },
          { label: "Applied", value: stats.applied, color: "text-warning" },
          { label: "Interview Rate", value: `${stats.interviewRate}%`, color: "text-info" },
          { label: "Offer Rate", value: `${stats.offerRate}%`, color: "text-success" },
        ].map((m) => (
          <div key={m.label} className="card text-center py-3">
            <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            <p className="text-2xs text-text-tertiary mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">Pipeline by Stage</h3>
          <div className="space-y-2">
            {stats.funnelData.map((stage) => (
              <div key={stage.name} className="flex items-center gap-3">
                <span className="text-xs text-text-secondary w-20">{stage.name}</span>
                <div className="flex-1 h-6 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${stats.total > 0 ? Math.max(4, (stage.value / stats.total) * 100) : 4}%`, backgroundColor: stage.fill }}
                  >
                    {stage.value > 0 && <span className="text-2xs font-bold text-white">{stage.value}</span>}
                  </div>
                </div>
                <span className="text-xs font-mono text-text-tertiary w-6 text-right">{stage.value}</span>
              </div>
            ))}
          </div>
        </div>

        {stats.monthlyData.length > 1 && (
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Monthly Activity</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Jobs tracked" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Conversion Funnel</h3>
        <div className="flex items-center gap-2 text-sm">
          {["Tracked → Applied", "Applied → Interview", "Interview → Offer"].map((label, i) => {
            const rates = [
              stats.applied > 0 ? Math.round((stats.applied / Math.max(stats.byStatus.tracked ?? 1, 1)) * 100) : 0,
              Number(stats.interviewRate),
              Number(stats.offerRate),
            ];
            return (
              <div key={label} className="flex-1 bg-surface-2 rounded-lg p-3 text-center">
                <p className="text-2xs text-text-tertiary mb-1">{label}</p>
                <p className={`text-2xl font-bold ${rates[i] >= 20 ? "text-success" : rates[i] >= 10 ? "text-warning" : "text-danger"}`}>
                  {rates[i]}%
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
