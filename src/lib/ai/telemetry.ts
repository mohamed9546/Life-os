import { subDays } from "date-fns";
import { AIFailureKind, AITelemetryEntry, AITelemetrySummary, AISensitivityLevel } from "@/types";
import {
  Collections,
  readCollection,
  writeCollection,
  writeCollectionLocalMirror,
} from "@/lib/storage";

const AI_TELEMETRY_RETENTION = 1000;
const AI_TELEMETRY_METADATA_VERSION = 1;
const AI_TELEMETRY_ERROR_SUMMARY_MAX = 200;

let writeLock: Promise<void> = Promise.resolve();

export interface RecordAiTelemetryInput {
  taskName: string;
  taskType: string;
  callingModule?: string | null;
  provider?: string | null;
  model?: string | null;
  runtimeRoute?: string | null;
  localOrCloud?: AITelemetryEntry["localOrCloud"];
  sensitivityLevel?: string | null;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  success: boolean;
  errorType?: string | null;
  errorSummary?: string | null;
  fallbackUsed: boolean;
  fallbackReason?: string | null;
  inputTokenEstimate?: number | null;
  outputTokenEstimate?: number | null;
  totalTokenEstimate?: number | null;
  estimatedCost?: number | null;
}

function generateId(): string {
  return `ai-telemetry-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function trimString(value: string | null | undefined, max = 240): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

export function sanitizeTelemetryErrorSummary(input: {
  errorType?: string | null;
  errorSummary?: string | null;
}): string | null {
  const raw = trimString(input.errorSummary, AI_TELEMETRY_ERROR_SUMMARY_MAX);
  if (!raw) {
    return null;
  }

  const normalized = raw.toLowerCase();

  if (
    input.errorType === "timeout" ||
    /timed out|timeout|aborterror|airequesttimeouterror/.test(normalized)
  ) {
    return "AI runtime timed out.";
  }

  if (/429|rate.?limit|too many requests|free-models-per-day|x-ratelimit/i.test(raw)) {
    return "Rate limit exceeded for AI provider route.";
  }

  if (/401|403|unauthori[sz]ed|forbidden|authentication|access denied/i.test(normalized)) {
    return "Provider authentication or access error.";
  }

  // Keep concise local/runtime errors, but strip noisy provider payloads.
  if (
    /disabled in settings|no ai runtime is available|secondary ai runtime is not available|monthly ai budget reached|daily ai call limit reached/i.test(
      normalized
    )
  ) {
    return trimString(raw, AI_TELEMETRY_ERROR_SUMMARY_MAX);
  }

  return "AI runtime error.";
}

function toNullableNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeSensitivityLevel(
  taskType: string,
  sensitivityLevel?: string | null
): AISensitivityLevel {
  const normalized = (sensitivityLevel || "").trim().toLowerCase();
  if (
    [
      "public",
      "internal",
      "sensitive",
      "clinical-adjacent",
      "recruiter-private",
      "finance-private",
      "cv-private",
      "unknown",
    ].includes(normalized)
  ) {
    return normalized as AISensitivityLevel;
  }

  switch (taskType) {
    case "parse-job":
    case "evaluate-job":
    case "salary-lookup":
    case "extract-job-from-scrape":
    case "extract-job-list-from-scrape":
      return "public";
    case "categorize-transaction":
    case "summarize-money":
      return "finance-private";
    case "extract-candidate-profile":
    case "tailor-cv":
    case "cv-optimize":
      return "cv-private";
    case "generate-followup":
    case "generate-outreach":
    case "linkedin-intro":
    case "cover-letter":
    case "interview-prep":
      return "recruiter-private";
    case "chat":
    case "summarize-week":
    case "summarize-decision":
    case "summarize-decision-patterns":
    case "suggest-routine-focus":
      return "sensitive";
    default:
      return "internal";
  }
}

function sanitizeTelemetryEntry(input: RecordAiTelemetryInput): AITelemetryEntry {
  const inputTokens = toNullableNumber(input.inputTokenEstimate);
  const outputTokens = toNullableNumber(input.outputTokenEstimate);
  const totalTokens =
    toNullableNumber(input.totalTokenEstimate) ??
    (inputTokens != null || outputTokens != null
      ? (inputTokens || 0) + (outputTokens || 0)
      : null);

  return {
    id: generateId(),
    taskName: trimString(input.taskName, 120) || input.taskType,
    taskType: trimString(input.taskType, 120) || "unknown-task",
    callingModule: trimString(input.callingModule, 120),
    provider: trimString(input.provider, 80),
    model: trimString(input.model, 140),
    runtimeRoute: trimString(input.runtimeRoute, 80),
    localOrCloud: input.localOrCloud || "unknown",
    sensitivityLevel: normalizeSensitivityLevel(input.taskType, input.sensitivityLevel),
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    latencyMs: Math.max(0, Math.round(input.latencyMs || 0)),
    success: Boolean(input.success),
    errorType: trimString(input.errorType, 80),
    errorSummary: sanitizeTelemetryErrorSummary({
      errorType: input.errorType,
      errorSummary: input.errorSummary,
    }),
    fallbackUsed: Boolean(input.fallbackUsed),
    fallbackReason: trimString(input.fallbackReason, 160),
    inputTokenEstimate: inputTokens,
    outputTokenEstimate: outputTokens,
    totalTokenEstimate: totalTokens,
    estimatedCost: toNullableNumber(input.estimatedCost),
    metadataVersion: AI_TELEMETRY_METADATA_VERSION,
  };
}

export async function recordAiTelemetryEvent(input: RecordAiTelemetryInput): Promise<void> {
  const entry = sanitizeTelemetryEntry(input);
  const previous = writeLock;
  const next = previous.then(async () => {
    const existing = await readCollection<AITelemetryEntry>(Collections.AI_TELEMETRY);
    const bounded = [entry, ...existing].slice(0, AI_TELEMETRY_RETENTION);
    await writeCollection(Collections.AI_TELEMETRY, bounded);
    await writeCollectionLocalMirror(Collections.AI_TELEMETRY, bounded);
  });
  writeLock = next.catch(() => undefined);
  await next;
}

export async function getAiTelemetryEvents(options?: {
  limit?: number;
}): Promise<AITelemetryEntry[]> {
  const entries = await readCollection<AITelemetryEntry>(Collections.AI_TELEMETRY);
  const sorted = [...entries].sort(
    (left, right) =>
      new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime()
  );
  return typeof options?.limit === "number" && options.limit > 0
    ? sorted.slice(0, options.limit)
    : sorted;
}

export async function clearAiTelemetryEvents(): Promise<void> {
  await writeCollection(Collections.AI_TELEMETRY, [] as AITelemetryEntry[]);
  await writeCollectionLocalMirror(Collections.AI_TELEMETRY, [] as AITelemetryEntry[]);
}

function buildWindow(entries: AITelemetryEntry[]): AITelemetrySummary["windows"]["today"] {
  const totalCalls = entries.length;
  const successCount = entries.filter((entry) => entry.success).length;
  const failureCount = totalCalls - successCount;
  const fallbackCount = entries.filter((entry) => entry.fallbackUsed).length;
  const averageLatencyMs =
    totalCalls > 0
      ? Math.round(entries.reduce((sum, entry) => sum + entry.latencyMs, 0) / totalCalls)
      : 0;
  const estimatedCost = Number(
    entries.reduce((sum, entry) => sum + (entry.estimatedCost || 0), 0).toFixed(6)
  );

  return {
    totalCalls,
    successCount,
    failureCount,
    fallbackCount,
    averageLatencyMs,
    estimatedCost,
  };
}

function buildCountMap(entries: AITelemetryEntry[], selector: (entry: AITelemetryEntry) => string | null) {
  const map = new Map<string, number>();
  for (const entry of entries) {
    const key = selector(entry) || "unknown";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export async function getAiTelemetrySummary(): Promise<AITelemetrySummary> {
  const entries = await getAiTelemetryEvents();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekCutoff = subDays(now, 7);
  const monthCutoff = subDays(now, 30);

  const todayEntries = entries.filter((entry) => new Date(entry.completedAt) >= todayStart);
  const weekEntries = entries.filter((entry) => new Date(entry.completedAt) >= weekCutoff);
  const monthEntries = entries.filter((entry) => new Date(entry.completedAt) >= monthCutoff);

  const totalCalls = entries.length;
  const successCount = entries.filter((entry) => entry.success).length;
  const failureCount = totalCalls - successCount;
  const fallbackCount = entries.filter((entry) => entry.fallbackUsed).length;
  const averageLatencyMs =
    totalCalls > 0
      ? Math.round(entries.reduce((sum, entry) => sum + entry.latencyMs, 0) / totalCalls)
      : 0;
  const estimatedTotalCost = Number(
    entries.reduce((sum, entry) => sum + (entry.estimatedCost || 0), 0).toFixed(6)
  );

  const providerUsage = buildCountMap(entries, (entry) => entry.provider).map((item) => ({
    provider: item.key,
    count: item.count,
  }));
  const modelUsage = buildCountMap(entries, (entry) => entry.model).map((item) => ({
    model: item.key,
    count: item.count,
  }));

  const localVsCloud = entries.reduce(
    (acc, entry) => {
      acc[entry.localOrCloud] += 1;
      return acc;
    },
    { local: 0, cloud: 0, unknown: 0 } as AITelemetrySummary["localVsCloud"]
  );

  const slowestTasks = Array.from(
    entries.reduce((map, entry) => {
      const current = map.get(entry.taskType) || {
        taskType: entry.taskType,
        taskName: entry.taskName,
        totalLatencyMs: 0,
        maxLatencyMs: 0,
        count: 0,
      };
      current.totalLatencyMs += entry.latencyMs;
      current.maxLatencyMs = Math.max(current.maxLatencyMs, entry.latencyMs);
      current.count += 1;
      map.set(entry.taskType, current);
      return map;
    }, new Map<string, { taskType: string; taskName: string; totalLatencyMs: number; maxLatencyMs: number; count: number }>())
      .values()
  )
    .map((item) => ({
      taskType: item.taskType,
      taskName: item.taskName,
      averageLatencyMs: Math.round(item.totalLatencyMs / item.count),
      maxLatencyMs: item.maxLatencyMs,
      count: item.count,
    }))
    .sort((left, right) => right.averageLatencyMs - left.averageLatencyMs)
    .slice(0, 5);

  const recentFailures = entries
    .filter((entry) => !entry.success)
    .slice(0, 10)
    .map((entry) => ({
      taskType: entry.taskType,
      taskName: entry.taskName,
      provider: entry.provider,
      model: entry.model,
      errorType: entry.errorType,
      errorSummary: entry.errorSummary,
      completedAt: entry.completedAt,
    }));

  const sensitivityRouting = Array.from(
    entries.reduce((map, entry) => {
      const current = map.get(entry.sensitivityLevel) || {
        sensitivityLevel: entry.sensitivityLevel,
        count: 0,
        local: 0,
        cloud: 0,
        unknown: 0,
      };
      current.count += 1;
      current[entry.localOrCloud] += 1;
      map.set(entry.sensitivityLevel, current);
      return map;
    }, new Map<AISensitivityLevel, AITelemetrySummary["sensitivityRouting"][number]>())
      .values()
  ).sort((left, right) => right.count - left.count);

  return {
    generatedAt: new Date().toISOString(),
    totalCalls,
    successCount,
    failureCount,
    fallbackCount,
    averageLatencyMs,
    estimatedTotalCost,
    windows: {
      today: buildWindow(todayEntries),
      week: buildWindow(weekEntries),
      month: buildWindow(monthEntries),
    },
    providerUsage,
    modelUsage,
    localVsCloud,
    slowestTasks,
    recentFailures,
    sensitivityRouting,
  };
}

export function classifyTelemetryErrorType(input: {
  failureKind?: AIFailureKind | null;
  errorSummary?: string | null;
}): string | null {
  if (input.failureKind) {
    return input.failureKind;
  }
  const message = (input.errorSummary || "").toLowerCase();
  if (!message) return null;
  if (message.includes("timed out") || message.includes("timeout")) return "timeout";
  if (message.includes("json")) return "invalid_json";
  if (message.includes("rate limit") || message.includes("429")) return "rate_limited";
  return "runtime_error";
}
