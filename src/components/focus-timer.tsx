"use client";

import { Play, Pause, RotateCcw, X, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

const PRESETS = [
  { label: "Focus", minutes: 25 },
  { label: "Short break", minutes: 5 },
  { label: "Long break", minutes: 15 },
];

export function FocusTimer() {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(PRESETS[0].minutes * 60);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = PRESETS[preset].minutes * 60;
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");
  const progress = 1 - secondsLeft / total;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            setCycles((c) => c + 1);
            toast.success(`${PRESETS[preset].label} session complete! 🎉`);
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Life OS Timer", { body: `${PRESETS[preset].label} complete!` });
            }
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current!);
    }
    return () => clearInterval(intervalRef.current!);
  }, [running, preset]);

  useEffect(() => {
    if (running) {
      document.title = `(${mins}:${secs}) Life OS`;
    } else {
      document.title = "Life OS";
    }
  }, [running, mins, secs]);

  function selectPreset(i: number) {
    setPreset(i);
    setRunning(false);
    setSecondsLeft(PRESETS[i].minutes * 60);
  }

  function reset() {
    setRunning(false);
    setSecondsLeft(PRESETS[preset].minutes * 60);
  }

  function requestNotifPermission() {
    if ("Notification" in window) Notification.requestPermission();
  }

  const circumference = 2 * Math.PI * 18;

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); requestNotifPermission(); }}
        className={`btn-icon btn-ghost text-text-tertiary hover:text-text-primary relative ${running ? "text-accent" : ""}`}
        aria-label="Focus timer"
      >
        <Timer size={16} />
        {running && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent animate-pulse-slow" />
        )}
      </button>

      {running && !open && (
        <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 text-2xs font-mono text-accent whitespace-nowrap">
          {mins}:{secs}
        </span>
      )}

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 glass-panel p-4 animate-slide-down z-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-text-primary">Focus Timer</span>
            <button onClick={() => setOpen(false)} className="text-text-tertiary hover:text-text-primary"><X size={14} /></button>
          </div>

          {/* Preset tabs */}
          <div className="flex gap-1 mb-4">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                onClick={() => selectPreset(i)}
                className={`flex-1 py-1 rounded-md text-2xs font-medium transition-colors ${
                  preset === i ? "bg-accent text-white" : "bg-surface-2 text-text-tertiary hover:text-text-primary"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Circle progress */}
          <div className="flex flex-col items-center gap-3 mb-4">
            <div className="relative">
              <svg width="80" height="80" className="-rotate-90">
                <circle cx="40" cy="40" r="32" fill="none" stroke="var(--surface-3)" strokeWidth="3" />
                <circle
                  cx="40" cy="40" r="32" fill="none"
                  stroke="#6366f1" strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - progress)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-mono font-bold text-text-primary">{mins}:{secs}</span>
              </div>
            </div>
            {cycles > 0 && <span className="text-2xs text-text-tertiary">{cycles} session{cycles > 1 ? "s" : ""} completed</span>}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-2">
            <button onClick={reset} className="btn-ghost btn-sm">
              <RotateCcw size={14} />
            </button>
            <button
              onClick={() => setRunning(!running)}
              className="btn-primary btn-sm px-6"
            >
              {running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Start</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
