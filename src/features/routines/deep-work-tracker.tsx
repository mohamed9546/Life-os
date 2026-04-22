"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Pause, StopCircle, Zap, BookOpen } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, eachDayOfInterval } from "date-fns";
import toast from "react-hot-toast";

interface WorkSession {
  id: string;
  date: string;
  goalTag: string;
  durationMinutes: number;
  notes: string;
  quality: 1 | 2 | 3 | 4 | 5;
}

const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface-2)",
  border: "1px solid var(--surface-3)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--text-primary)",
};

export function DeepWorkTracker({ goals }: { goals: { id: string; title: string }[] }) {
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [goalTag, setGoalTag] = useState(goals[0]?.title || "");
  const [quality, setQuality] = useState<1|2|3|4|5>(3);
  const [notes, setNotes] = useState("");
  const startTime = useRef<number>(0);
  const interval = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    fetch("/api/deep-work").then((r) => r.json()).then((d) => setSessions(d.sessions ?? [])).catch(() => {});
    return () => clearInterval(interval.current);
  }, []);

  function start() {
    startTime.current = Date.now() - elapsed * 1000;
    setRunning(true);
    interval.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
  }

  function pause() {
    setRunning(false);
    clearInterval(interval.current);
  }

  async function stop() {
    setRunning(false);
    clearInterval(interval.current);
    if (elapsed < 60) { toast.error("Too short to log (need ≥1 min)"); setElapsed(0); return; }

    const session: WorkSession = {
      id: `dw-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      goalTag: goalTag || "General",
      durationMinutes: Math.round(elapsed / 60),
      notes,
      quality,
    };

    const updated = [session, ...sessions];
    setSessions(updated);
    await fetch("/api/deep-work", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session }),
    }).catch(() => {});

    toast.success(`${session.durationMinutes}min deep work session logged`);
    setElapsed(0);
    setNotes("");
  }

  const totalHours = sessions.reduce((s, sess) => s + sess.durationMinutes, 0) / 60;
  const thisWeek = sessions.filter((s) => {
    const d = new Date(s.date);
    return d >= subDays(new Date(), 7);
  }).reduce((s, sess) => s + sess.durationMinutes, 0) / 60;

  const chartDays = eachDayOfInterval({ start: subDays(new Date(), 13), end: new Date() });
  const chartData = chartDays.map((day) => {
    const ds = format(day, "yyyy-MM-dd");
    const mins = sessions.filter((s) => s.date === ds).reduce((s, sess) => s + sess.durationMinutes, 0);
    return { date: format(day, "dd/MM"), hours: mins / 60 };
  });

  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;
  const timerDisplay = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center py-3">
          <Zap size={16} className="text-accent mx-auto mb-1" />
          <p className="text-2xl font-bold text-text-primary">{totalHours.toFixed(1)}h</p>
          <p className="text-2xs text-text-tertiary">total deep work</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-text-primary">{thisWeek.toFixed(1)}h</p>
          <p className="text-2xs text-text-tertiary">this week</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-text-primary">{sessions.length}</p>
          <p className="text-2xs text-text-tertiary">sessions logged</p>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Zap size={14} className="text-accent" /> Active Session
        </h3>

        <div className="flex flex-col items-center gap-4">
          <div className={`text-5xl font-mono font-bold transition-colors ${running ? "text-accent" : "text-text-primary"}`}>
            {timerDisplay}
          </div>

          <div className="flex gap-3">
            {!running ? (
              <button onClick={start} className="btn-primary btn-sm flex items-center gap-1.5">
                <Play size={14} /> {elapsed > 0 ? "Resume" : "Start"}
              </button>
            ) : (
              <button onClick={pause} className="btn-secondary btn-sm flex items-center gap-1.5">
                <Pause size={14} /> Pause
              </button>
            )}
            {elapsed > 0 && (
              <button onClick={stop} className="btn-danger btn-sm flex items-center gap-1.5">
                <StopCircle size={14} /> Log Session
              </button>
            )}
          </div>

          {(running || elapsed > 0) && (
            <div className="w-full space-y-3">
              <div>
                <label className="label">Goal / Task</label>
                <select className="select" value={goalTag} onChange={(e) => setGoalTag(e.target.value)}>
                  <option value="General">General focus</option>
                  {goals.map((g) => <option key={g.id} value={g.title}>{g.title}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Session Quality</label>
                <div className="flex gap-1">
                  {([1,2,3,4,5] as const).map((q) => (
                    <button key={q} onClick={() => setQuality(q)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${quality === q ? "bg-accent text-white" : "bg-surface-3 text-text-tertiary"}`}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <textarea className="textarea min-h-[56px] text-xs" placeholder="What did you accomplish? (optional)"
                value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {chartData.some((d) => d.hours > 0) && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <BookOpen size={13} /> 14-Day Deep Work
          </h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-tertiary)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "var(--text-tertiary)" }} tickLine={false} unit="h" />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [`${Number(v).toFixed(1)}h`]} />
              <Bar dataKey="hours" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
