import { promises as fs } from "fs";
import path from "path";
import {
  ApplicationOutcomeSnapshot,
  AITelemetrySummary,
  SourceHealthSnapshot,
  SystemCheckpointSnapshot,
  SystemCheckpointStatus,
} from "@/types";
import { getLatestSourceHealthSnapshot } from "@/lib/jobs/source-health";
import { getAiTelemetrySummary } from "@/lib/ai/telemetry";
import { getApplicationLogs } from "@/lib/applications/storage";
import { getLatestApplicationOutcomeSnapshot } from "@/lib/applications/outcomes";

const CHECKPOINT_BACKUP_STALE_DAYS = 7;
const CHECKPOINT_AI_FAILURE_RATE_ATTENTION = 0.25;
const CHECKPOINT_AI_FAILURE_RATE_CRITICAL = 0.5;
const CHECKPOINT_AI_MIN_SAMPLE = 5;

type BackupMetadata = {
  latestBackupName: string | null;
  latestBackupModifiedAt: string | null;
  latestBackupSizeBytes: number | null;
  backupAgeDays: number | null;
  backupCount: number;
};

function statusPriority(status: SystemCheckpointStatus): number {
  switch (status) {
    case "critical":
      return 4;
    case "attention":
      return 3;
    case "healthy":
      return 2;
    default:
      return 1;
  }
}

function reduceOverallStatus(statuses: SystemCheckpointStatus[]): SystemCheckpointStatus {
  if (statuses.every((status) => status === "unknown")) {
    return "unknown";
  }

  return [...statuses].sort((left, right) => statusPriority(right) - statusPriority(left))[0] || "unknown";
}

function pickBestSummary(
  entries: ApplicationOutcomeSnapshot["summaries"]["bySource"]
): string | null {
  return (
    [...entries]
      .filter((entry) => entry.appliedAttempts >= 2 && entry.responseRate != null)
      .sort((left, right) => {
        const responseDelta = (right.responseRate || 0) - (left.responseRate || 0);
        if (responseDelta !== 0) return responseDelta;
        return right.appliedAttempts - left.appliedAttempts;
      })[0]?.label || null
  );
}

async function readEncryptedBackupMetadata(now: Date): Promise<BackupMetadata | null> {
  try {
    const exportsDir = path.join(process.cwd(), "private", "exports");
    const entries = await fs.readdir(exportsDir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".age"));

    if (files.length === 0) {
      return {
        latestBackupName: null,
        latestBackupModifiedAt: null,
        latestBackupSizeBytes: null,
        backupAgeDays: null,
        backupCount: 0,
      };
    }

    const withStats = await Promise.all(
      files.map(async (entry) => {
        const fullPath = path.join(exportsDir, entry.name);
        const stats = await fs.stat(fullPath);
        return {
          name: entry.name,
          modifiedAt: stats.mtime.toISOString(),
          sizeBytes: stats.size,
          mtimeMs: stats.mtime.getTime(),
        };
      })
    );

    const latest = [...withStats].sort((left, right) => right.mtimeMs - left.mtimeMs)[0];
    const backupAgeDays = Math.floor((now.getTime() - latest.mtimeMs) / (1000 * 60 * 60 * 24));

    return {
      latestBackupName: latest.name,
      latestBackupModifiedAt: latest.modifiedAt,
      latestBackupSizeBytes: latest.sizeBytes,
      backupAgeDays,
      backupCount: withStats.length,
    };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        latestBackupName: null,
        latestBackupModifiedAt: null,
        latestBackupSizeBytes: null,
        backupAgeDays: null,
        backupCount: 0,
      };
    }
    return null;
  }
}

async function inspectRuntimeGuardrails() {
  try {
    const [gitignoreRaw, hookInstallerStats, preCommitStats, repoSafetyStats] = await Promise.all([
      fs.readFile(path.join(process.cwd(), ".gitignore"), "utf-8"),
      fs.stat(path.join(process.cwd(), "scripts", "opencode", "install-hooks.ps1")).then(() => true).catch(() => false),
      fs.stat(path.join(process.cwd(), "scripts", "git-hooks", "pre-commit")).then(() => true).catch(() => false),
      fs.stat(path.join(process.cwd(), "docs", "repo-safety-patch.md")).then(() => true).catch(() => false),
    ]);

    const privateBoundaryConfigured =
      gitignoreRaw.includes("private/*") &&
      gitignoreRaw.includes("!private/.gitkeep") &&
      gitignoreRaw.includes("!private/**/*.age");

    return {
      privateBoundaryConfigured,
      hookInstallerPresent: hookInstallerStats,
      preCommitHookPresent: preCommitStats,
      repoSafetyDocPresent: repoSafetyStats,
    };
  } catch {
    return null;
  }
}

function buildSourceHealthSection(snapshot: SourceHealthSnapshot | null): SystemCheckpointSnapshot["sourceHealth"] {
  if (!snapshot) {
    return {
      status: "unknown",
      label: "Source Health",
      summary: "No source-health snapshot has been recorded yet.",
      updatedAt: null,
      data: {
        totalSources: 0,
        ok: 0,
        degraded: 0,
        down: 0,
        unknown: 0,
        worstFailingSources: [],
      },
      actions: [{ label: "Open Settings", href: "/settings" }],
    };
  }

  const worstFailingSources = snapshot.results
    .filter((result) => result.status === "down" || result.status === "degraded")
    .slice(0, 3)
    .map((result) => ({
      sourceId: result.sourceId,
      sourceName: result.sourceName,
      status: result.status,
    }));

  const status =
    snapshot.down >= 2
      ? "critical"
      : snapshot.down >= 1 || snapshot.degraded >= 1
        ? "attention"
        : snapshot.ok > 0
          ? "healthy"
          : "unknown";

  return {
    status,
    label: "Source Health",
    summary:
      status === "healthy"
        ? `${snapshot.ok}/${snapshot.totalSources} sources healthy.`
        : status === "attention"
          ? `${snapshot.down} down and ${snapshot.degraded} degraded source(s) need review.`
          : `${snapshot.down} source failures could undermine job discovery trust.`,
    updatedAt: snapshot.checkedAt,
    data: {
      totalSources: snapshot.totalSources,
      ok: snapshot.ok,
      degraded: snapshot.degraded,
      down: snapshot.down,
      unknown: snapshot.unknown,
      worstFailingSources,
    },
    actions: [{ label: "Open Settings", href: "/settings" }],
  };
}

function buildAiTelemetrySection(summary: AITelemetrySummary): SystemCheckpointSnapshot["aiTelemetry"] {
  const totalCalls = summary.totalCalls;
  const failureRate = totalCalls > 0 ? summary.failureCount / totalCalls : 0;
  const fallbackRate = totalCalls > 0 ? summary.fallbackCount / totalCalls : 0;

  const status =
    totalCalls === 0
      ? "unknown"
      : totalCalls >= CHECKPOINT_AI_MIN_SAMPLE && failureRate >= CHECKPOINT_AI_FAILURE_RATE_CRITICAL
        ? "critical"
        : totalCalls >= CHECKPOINT_AI_MIN_SAMPLE && (failureRate >= CHECKPOINT_AI_FAILURE_RATE_ATTENTION || fallbackRate >= CHECKPOINT_AI_FAILURE_RATE_ATTENTION)
          ? "attention"
          : "healthy";

  return {
    status,
    label: "AI Telemetry",
    summary:
      status === "unknown"
        ? "No AI telemetry has been recorded yet."
        : status === "healthy"
          ? `${summary.totalCalls} calls recorded with ${summary.failureCount} failures.`
          : status === "attention"
            ? `AI fallback or failure pressure is elevated.`
            : `AI failure rate is high enough to reduce runtime trust.`,
    updatedAt: summary.generatedAt,
    data: {
      totalCalls: summary.totalCalls,
      todayCalls: summary.windows.today.totalCalls,
      weekCalls: summary.windows.week.totalCalls,
      monthCalls: summary.windows.month.totalCalls,
      failureCount: summary.failureCount,
      fallbackCount: summary.fallbackCount,
      averageLatencyMs: summary.averageLatencyMs,
      estimatedTotalCost: summary.estimatedTotalCost,
      recentFailures: summary.recentFailures.length,
      localCalls: summary.localVsCloud.local,
      cloudCalls: summary.localVsCloud.cloud,
      unknownCalls: summary.localVsCloud.unknown,
    },
    actions: [{ label: "Open Settings", href: "/settings" }],
  };
}

function buildBackupSection(metadata: BackupMetadata | null): SystemCheckpointSnapshot["encryptedBackup"] {
  if (!metadata) {
    return {
      status: "unknown",
      label: "Encrypted Backup",
      summary: "Backup metadata could not be inspected safely.",
      updatedAt: null,
      data: {
        latestBackupName: null,
        latestBackupModifiedAt: null,
        latestBackupSizeBytes: null,
        backupAgeDays: null,
        backupCount: 0,
      },
    };
  }

  const status =
    metadata.backupCount === 0
      ? "critical"
      : (metadata.backupAgeDays ?? Number.MAX_SAFE_INTEGER) > CHECKPOINT_BACKUP_STALE_DAYS
        ? "attention"
        : "healthy";

  return {
    status,
    label: "Encrypted Backup",
    summary:
      status === "critical"
        ? "No encrypted backup was found."
        : status === "attention"
          ? `Latest encrypted backup is ${metadata.backupAgeDays} day(s) old.`
          : `Latest encrypted backup is ${metadata.backupAgeDays} day(s) old.`,
    updatedAt: metadata.latestBackupModifiedAt,
    data: metadata,
  };
}

function buildRuntimeGuardrailsSection(
  data: Awaited<ReturnType<typeof inspectRuntimeGuardrails>>
): SystemCheckpointSnapshot["runtimeGuardrails"] {
  if (!data) {
    return {
      status: "unknown",
      label: "Runtime Guardrails",
      summary: "Guardrail files could not be inspected.",
      updatedAt: null,
      data: {
        privateBoundaryConfigured: false,
        hookInstallerPresent: false,
        preCommitHookPresent: false,
        repoSafetyDocPresent: false,
      },
    };
  }

  const allPresent =
    data.privateBoundaryConfigured &&
    data.hookInstallerPresent &&
    data.preCommitHookPresent &&
    data.repoSafetyDocPresent;

  return {
    status: allPresent ? "healthy" : "attention",
    label: "Runtime Guardrails",
    summary: allPresent
      ? "Private boundary, hooks, and safety docs are configured."
      : "One or more local guardrail files or boundaries are missing.",
    updatedAt: null,
    data,
  };
}

function buildApplicationOutcomesSection(input: {
  snapshot: ApplicationOutcomeSnapshot | null;
  hasAttempts: boolean;
}): SystemCheckpointSnapshot["applicationOutcomes"] {
  if (!input.snapshot) {
    return {
      status: input.hasAttempts ? "attention" : "unknown",
      label: "Application Outcomes",
      summary: input.hasAttempts
        ? "Application attempts exist, but the outcomes snapshot has not been built yet."
        : "No outcomes snapshot exists yet.",
      updatedAt: null,
      data: {
        totalRecords: 0,
        totalAttempts: 0,
        responses: 0,
        interviews: 0,
        offers: 0,
        ghosted: 0,
        followUpsDue: 0,
        bestSource: null,
        bestTrack: null,
        bestCvVersion: null,
      },
      actions: [{ label: "Open Career", href: "/career" }],
    };
  }

  const overall = input.snapshot.summaries.overall;
  const status =
    overall.ghosted > 0 || overall.followUpDue > 0
      ? "attention"
      : input.snapshot.records.length > 0
        ? "healthy"
        : "unknown";

  return {
    status,
    label: "Application Outcomes",
    summary:
      status === "attention"
        ? `${overall.followUpDue} follow-up(s) due and ${overall.ghosted} ghosted application(s).`
        : `${overall.attemptRecords} attempts recorded across ${overall.totalRecords} outcome rows.`,
    updatedAt: input.snapshot.generatedAt,
    data: {
      totalRecords: overall.totalRecords,
      totalAttempts: overall.attemptRecords,
      responses: overall.responded,
      interviews: overall.interviews,
      offers: overall.offers,
      ghosted: overall.ghosted,
      followUpsDue: overall.followUpDue,
      bestSource: pickBestSummary(input.snapshot.summaries.bySource),
      bestTrack: pickBestSummary(input.snapshot.summaries.byTrack),
      bestCvVersion: pickBestSummary(input.snapshot.summaries.byCvVersion),
    },
    actions: [{ label: "Open Career", href: "/career" }],
  };
}

function buildOperatorChecklist(snapshot: SystemCheckpointSnapshot): string[] {
  const checklist: string[] = [];

  if (snapshot.sourceHealth.status === "unknown") {
    checklist.push("Run a source health check.");
  }
  if (snapshot.encryptedBackup.status === "critical") {
    checklist.push("Create an encrypted backup.");
  } else if (snapshot.encryptedBackup.status === "attention") {
    checklist.push("Refresh the encrypted backup.");
  }
  if (snapshot.applicationOutcomes.status === "attention" && snapshot.applicationOutcomes.updatedAt == null) {
    checklist.push("Build the application outcomes snapshot.");
  }
  if ((snapshot.applicationOutcomes.data.followUpsDue || 0) > 0 || (snapshot.applicationOutcomes.data.ghosted || 0) > 0) {
    checklist.push("Review application follow-ups.");
  }

  return checklist;
}

export async function buildSystemCheckpointSnapshot(
  userId: string,
  options?: { now?: Date }
): Promise<SystemCheckpointSnapshot> {
  const now = options?.now || new Date();
  const [sourceHealth, aiTelemetrySummary, backupMetadata, runtimeGuardrails, latestOutcomes, applicationLogs] =
    await Promise.all([
      getLatestSourceHealthSnapshot(),
      getAiTelemetrySummary(),
      readEncryptedBackupMetadata(now),
      inspectRuntimeGuardrails(),
      getLatestApplicationOutcomeSnapshot(userId),
      getApplicationLogs(userId, 1000),
    ]);

  const snapshot: SystemCheckpointSnapshot = {
    generatedAt: now.toISOString(),
    overallStatus: "unknown",
    operatorChecklist: [],
    sourceHealth: buildSourceHealthSection(sourceHealth),
    aiTelemetry: buildAiTelemetrySection(aiTelemetrySummary),
    encryptedBackup: buildBackupSection(backupMetadata),
    runtimeGuardrails: buildRuntimeGuardrailsSection(runtimeGuardrails),
    applicationOutcomes: buildApplicationOutcomesSection({
      snapshot: latestOutcomes,
      hasAttempts: applicationLogs.length > 0,
    }),
  };

  snapshot.overallStatus = reduceOverallStatus([
    snapshot.sourceHealth.status,
    snapshot.aiTelemetry.status,
    snapshot.encryptedBackup.status,
    snapshot.runtimeGuardrails.status,
    snapshot.applicationOutcomes.status,
  ]);
  snapshot.operatorChecklist = buildOperatorChecklist(snapshot);

  return snapshot;
}
