import * as React from "react";
import { AlertTriangle, Loader2, RefreshCw, X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type PanelTone = "default" | "subtle" | "hero" | "rail";
type StatusTone = "neutral" | "success" | "info" | "warning" | "danger";
type ActionButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const PANEL_TONE_STYLES: Record<PanelTone, string> = {
  default: "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm",
  subtle: "rounded-2xl border border-white/8 bg-white/[0.03]",
  hero: "rounded-2xl border border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.04)_60%,rgba(99,102,241,0.06)_100%)]",
  rail: "rounded-2xl border border-white/10 bg-white/5",
};

const STATUS_TONE_STYLES: Record<StatusTone, string> = {
  neutral: "border-white/10 bg-white/8 text-slate-300",
  success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  info: "border-blue-400/25 bg-blue-400/10 text-blue-300",
  warning: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  danger: "border-rose-400/25 bg-rose-400/10 text-rose-300",
};

const STATUS_DOT_STYLES: Record<StatusTone, string> = {
  neutral: "bg-slate-400",
  success: "bg-emerald-400",
  info: "bg-blue-400",
  warning: "bg-amber-400",
  danger: "bg-rose-400",
};

const ACTION_BUTTON_STYLES: Record<ActionButtonVariant, string> = {
  primary: "bg-white text-slate-950 hover:bg-slate-100",
  secondary: "border border-white/15 bg-white/8 text-white hover:bg-white/12",
  ghost: "border border-transparent bg-transparent text-slate-400 hover:bg-white/8 hover:text-white",
  danger: "border border-rose-400/25 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15",
};

const ALERT_BANNER_STYLES: Record<StatusTone, string> = {
  neutral: "border-white/10 bg-white/8 text-slate-300",
  success: "border-emerald-400/20 bg-emerald-400/8 text-emerald-200",
  info: "border-blue-400/20 bg-blue-400/8 text-blue-200",
  warning: "border-amber-400/20 bg-amber-400/8 text-amber-200",
  danger: "border-rose-400/20 bg-rose-400/8 text-rose-200",
};

// ---- Core layout primitives ----

export function Panel({
  className,
  tone = "default",
  children,
}: React.HTMLAttributes<HTMLDivElement> & { tone?: PanelTone }) {
  return (
    <div className={cn("p-5 sm:p-6", PANEL_TONE_STYLES[tone], className)}>
      {children}
    </div>
  );
}

export function HeroPanel({
  title,
  description,
  eyebrow = "Operating Surface",
  actions,
  meta,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <Panel tone="hero" className={cn("relative overflow-hidden", className)}>
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-80 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_56%)] lg:block" />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-[15px]">
              {description}
            </p>
          ) : null}
          {meta ? <div className="mt-5 flex flex-wrap gap-2">{meta}</div> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </Panel>
  );
}

export function SectionHeading({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-white">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// ---- Data display ----

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  const toneValueStyles: Record<StatusTone, string> = {
    neutral: "text-white",
    success: "text-emerald-300",
    info: "text-blue-300",
    warning: "text-amber-300",
    danger: "text-rose-300",
  };

  return (
    <Panel className={cn("h-full", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <div
        className={cn(
          "mt-4 text-3xl font-semibold tracking-[-0.04em]",
          toneValueStyles[tone]
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-3 text-sm leading-6 text-slate-400">{hint}</div> : null}
    </Panel>
  );
}

export function KpiRow({
  items,
  className,
}: {
  items: Array<{
    label: string;
    value: React.ReactNode;
    trend?: "up" | "down" | "flat";
    badge?: string;
    tone?: StatusTone;
  }>;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-8 gap-y-4", className)}>
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {item.label}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tracking-tight text-white">{item.value}</span>
            {item.trend === "up" ? (
              <TrendingUp size={14} className="text-emerald-400" />
            ) : item.trend === "down" ? (
              <TrendingDown size={14} className="text-rose-400" />
            ) : item.trend === "flat" ? (
              <Minus size={14} className="text-slate-500" />
            ) : null}
            {item.badge ? (
              <StatusChip tone={item.tone ?? "neutral"} className="text-[9px]">
                {item.badge}
              </StatusChip>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatusChip({
  tone = "neutral",
  children,
  className,
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        STATUS_TONE_STYLES[tone],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", STATUS_DOT_STYLES[tone])} />
      {children}
    </span>
  );
}

export function ScoreMeter({
  label,
  value,
  tone = "info",
  className,
}: {
  label: string;
  value: number;
  tone?: StatusTone;
  className?: string;
}) {
  const barStyles: Record<StatusTone, string> = {
    neutral: "bg-slate-400",
    success: "bg-emerald-400",
    info: "bg-blue-400",
    warning: "bg-amber-400",
    danger: "bg-rose-400",
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-500">
        <span>{label}</span>
        <span className="font-mono text-slate-300">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full transition-all", barStyles[tone])}
          style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
        />
      </div>
    </div>
  );
}

// ---- Navigation ----

export function FilterBar({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: string; label: string; count?: number }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1",
        className
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-all duration-150",
            value === opt.value
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-400 hover:text-white"
          )}
        >
          {opt.label}
          {opt.count !== undefined ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                value === opt.value
                  ? "bg-slate-200 text-slate-700"
                  : "bg-white/10 text-slate-500"
              )}
            >
              {opt.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

// ---- Layout chrome ----

export function ActionButton({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ActionButtonVariant;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        ACTION_BUTTON_STYLES[variant],
        className
      )}
      {...props}
    />
  );
}

export function CommandBar({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DetailRail({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Panel tone="rail" className={cn("sticky top-24", className)}>
      {children}
    </Panel>
  );
}

// ---- State primitives ----

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Panel
      className={cn(
        "flex min-h-[220px] flex-col items-center justify-center text-center",
        className
      )}
    >
      <div className="max-w-md">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {description ? (
          <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
        ) : null}
        {action ? (
          <div className="mt-5 flex items-center justify-center">{action}</div>
        ) : null}
      </div>
    </Panel>
  );
}

export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[200px] flex-col items-center justify-center gap-3",
        className
      )}
    >
      <Loader2 size={20} className="animate-spin text-slate-500" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function FailureState({
  title,
  description,
  onRetry,
  className,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[200px] flex-col items-center justify-center gap-3 text-center",
        className
      )}
    >
      <AlertTriangle size={20} className="text-rose-400" />
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        ) : null}
      </div>
      {onRetry ? (
        <ActionButton variant="ghost" onClick={onRetry} className="gap-1.5 text-xs">
          <RefreshCw size={13} />
          Retry
        </ActionButton>
      ) : null}
    </div>
  );
}

export function SkeletonState({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-12 rounded-2xl"
          style={{ opacity: Math.max(0.3, 1 - i * 0.18) }}
        />
      ))}
    </div>
  );
}

export function AlertBanner({
  tone = "info",
  title,
  description,
  action,
  onDismiss,
  className,
}: {
  tone?: StatusTone;
  title: string;
  description?: string;
  action?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3",
        ALERT_BANNER_STYLES[tone],
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="mt-0.5 text-sm opacity-75">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
      {onDismiss ? (
        <button
          onClick={onDismiss}
          className="shrink-0 opacity-50 transition-opacity hover:opacity-100"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}

// ---- Timeline ----

export function TimelineRow({
  title,
  body,
  meta,
  tone = "neutral",
  isLast = false,
  className,
}: {
  title: string;
  body?: string;
  meta?: string;
  tone?: StatusTone;
  isLast?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-3", className)}>
      <div className="flex w-4 flex-col items-center">
        <span
          className={cn(
            "mt-1.5 h-2 w-2 flex-shrink-0 rounded-full",
            STATUS_DOT_STYLES[tone]
          )}
        />
        {!isLast ? <span className="mt-1 w-px flex-1 bg-white/10" /> : null}
      </div>
      <div className={cn("min-w-0 flex-1", !isLast && "pb-4")}>
        <p className="text-sm font-medium text-white">{title}</p>
        {body ? (
          <p className="mt-0.5 text-sm leading-6 text-slate-400">{body}</p>
        ) : null}
        {meta ? (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-600">
            {meta}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ActivityTimeline({
  items,
  className,
}: {
  items: Array<{
    id: string;
    title: string;
    body?: string;
    meta?: string;
    tone?: StatusTone;
  }>;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0", className)}>
      {items.map((item, index) => (
        <TimelineRow
          key={item.id}
          title={item.title}
          body={item.body}
          meta={item.meta}
          tone={item.tone ?? "neutral"}
          isLast={index === items.length - 1}
        />
      ))}
    </div>
  );
}
