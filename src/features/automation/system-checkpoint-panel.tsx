"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertBanner } from "@/components/ui/system";
import { SystemCheckpointSection, SystemCheckpointSnapshot, SystemCheckpointStatus } from "@/types";

type SystemCheckpointApiResponse = {
  ok: boolean;
  snapshot: SystemCheckpointSnapshot;
  error?: string;
};

export function SystemCheckpointPanel() {
  const [snapshot, setSnapshot] = useState<SystemCheckpointSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/system-checkpoint", { cache: "no-store" });
        const payload = (await response.json()) as SystemCheckpointApiResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Failed to load system checkpoint");
        }
        setSnapshot(payload.snapshot);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load system checkpoint");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <div className="card space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-tertiary">
            System Checkpoint
          </p>
          <h2 className="mt-1 text-lg font-semibold text-text-primary">
            Operational control room
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Compact read-only trust view across source health, AI telemetry, backup safety, runtime guardrails, and application outcomes.
          </p>
        </div>
        {snapshot?.generatedAt ? (
          <span className="text-xs text-text-tertiary">
            Updated {new Date(snapshot.generatedAt).toLocaleString("en-GB")}
          </span>
        ) : null}
      </div>

      {error ? <AlertBanner tone="danger" title="System checkpoint failed" description={error} /> : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-surface-3 bg-surface-2 p-4">
              <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-5 w-16 animate-pulse rounded bg-white/10" />
              <div className="mt-4 h-10 animate-pulse rounded bg-white/10" />
            </div>
          ))}
        </div>
      ) : snapshot ? (
        <>
          <div className="rounded-xl border border-surface-3 bg-surface-2 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Overall</p>
              <p className="mt-1 text-sm text-text-secondary">Is Life-OS healthy enough to trust today?</p>
            </div>
            <CheckpointStatusBadge status={snapshot.overallStatus} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <CheckpointCard title="Source Health" section={snapshot.sourceHealth} />
            <CheckpointCard title="AI Telemetry" section={snapshot.aiTelemetry} />
            <CheckpointCard title="Encrypted Backup" section={snapshot.encryptedBackup} />
            <CheckpointCard title="Runtime Guardrails" section={snapshot.runtimeGuardrails} />
            <CheckpointCard title="Application Outcomes" section={snapshot.applicationOutcomes} />
          </div>

          <div className="rounded-xl border border-surface-3 bg-surface-2 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Operator checklist</p>
            {snapshot.operatorChecklist.length === 0 ? (
              <p className="mt-3 text-sm text-text-secondary">No urgent operator actions derived from current local checkpoints.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                {snapshot.operatorChecklist.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function CheckpointCard({
  title,
  section,
}: {
  title: string;
  section: SystemCheckpointSection<any>;
}) {
  return (
    <div className="rounded-xl border border-surface-3 bg-surface-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-tertiary">{title}</p>
          <p className="mt-2 text-sm font-medium text-text-primary">{section.summary}</p>
        </div>
        <CheckpointStatusBadge status={section.status} compact />
      </div>
      {section.updatedAt ? (
        <p className="mt-3 text-2xs text-text-tertiary">
          Updated {new Date(section.updatedAt).toLocaleString("en-GB")}
        </p>
      ) : null}
      {section.actions?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {section.actions.map((action) => (
            <Link key={`${title}-${action.href}`} className="btn-secondary btn-sm" href={action.href}>
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CheckpointStatusBadge({
  status,
  compact = false,
}: {
  status: SystemCheckpointStatus;
  compact?: boolean;
}) {
  const classes = {
    healthy: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    attention: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    critical: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    unknown: "bg-white/5 text-slate-300 border-white/10",
  }[status];

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${classes} ${compact ? "" : "min-w-[92px] justify-center"}`}>
      {status}
    </span>
  );
}
