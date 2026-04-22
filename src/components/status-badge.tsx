import { TaskStatus } from "@/types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: TaskStatus;
  label?: string;
}

const STATUS_CONFIG: Record<
  TaskStatus,
  { dot: string; chip: string; label: string }
> = {
  idle: {
    dot: "bg-slate-400",
    chip: "border-slate-200 bg-slate-100 text-slate-600",
    label: "Idle",
  },
  running: {
    dot: "bg-blue-500",
    chip: "border-blue-200 bg-blue-50 text-blue-700",
    label: "Running",
  },
  success: {
    dot: "bg-emerald-500",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    label: "Success",
  },
  skipped: {
    dot: "bg-amber-500",
    chip: "border-amber-200 bg-amber-50 text-amber-700",
    label: "Skipped",
  },
  failed: {
    dot: "bg-rose-500",
    chip: "border-rose-200 bg-rose-50 text-rose-700",
    label: "Failed",
  },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        config.chip
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          config.dot,
          status === "running" ? "animate-pulse" : undefined
        )}
      />
      <span>{label || config.label}</span>
    </span>
  );
}
