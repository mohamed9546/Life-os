import { ConfigFiles, readObject, writeObject } from "@/lib/storage";
import { RawJobItem, SourceHealthResult, SourceHealthSnapshot, SourceHealthStatus } from "@/types";
import { getAllAdapters } from "./sources";
import { JobSearchQuery, JobSourceResult } from "./sources/types";

const SOURCE_HEALTH_PROBE_QUERY: JobSearchQuery = {
  keywords: ["clinical trial assistant"],
  maxResults: 1,
};

function isLikelyOutageError(error: string): boolean {
  return /(timeout|timed out|rate.?limit|429|401|403|credential|unauthori[sz]ed|forbidden|invalid|failed|down)/i.test(
    error
  );
}

function validateRawJobShape(job: unknown): boolean {
  if (!job || typeof job !== "object") return false;
  const item = job as Partial<RawJobItem>;
  const hasTitle = typeof item.title === "string" && item.title.trim().length > 0;
  const hasSource = typeof item.source === "string" && item.source.trim().length > 0;
  const hasLocator =
    (typeof item.link === "string" && item.link.trim().length > 0) ||
    (typeof item.sourceJobId === "string" && item.sourceJobId.trim().length > 0);
  return hasTitle && hasSource && hasLocator;
}

function inspectSourceResult(
  adapterSourceId: string,
  result: JobSourceResult
): { resultCount: number | null; warning: string | null; malformed: boolean } {
  if (!Array.isArray(result.jobs)) {
    return {
      resultCount: null,
      warning: "Adapter returned a non-array jobs payload.",
      malformed: true,
    };
  }

  const sample = result.jobs.slice(0, 3);
  if (sample.some((item) => !validateRawJobShape(item))) {
    return {
      resultCount: result.jobs.length,
      warning: "Adapter returned partial or malformed job items.",
      malformed: true,
    };
  }

  if (typeof result.source !== "string" || result.source.trim() !== adapterSourceId) {
    return {
      resultCount: result.jobs.length,
      warning: `Adapter reported source="${result.source}" instead of "${adapterSourceId}".`,
      malformed: false,
    };
  }

  return {
    resultCount: result.jobs.length,
    warning: null,
    malformed: false,
  };
}

export function classifySourceHealthResult(args: {
  resultCount: number | null;
  error: string | null;
  warning: string | null;
  malformed?: boolean;
}): SourceHealthStatus {
  if (args.error) {
    return "down";
  }

  if (args.malformed || args.warning) {
    return "degraded";
  }

  if (args.resultCount === null) {
    return "unknown";
  }

  return "ok";
}

async function probeSource(adapter: ReturnType<typeof getAllAdapters>[number]): Promise<SourceHealthResult> {
  const checkedAt = new Date().toISOString();

  try {
    const configured = await adapter.isConfigured();
    if (!configured) {
      return {
        sourceId: adapter.sourceId,
        sourceName: adapter.displayName,
        status: "unknown",
        checkedAt,
        latencyMs: null,
        resultCount: null,
        error: null,
        warning: "Source is not configured for this workspace.",
      };
    }

    const startedAt = Date.now();
    const result = await adapter.fetchJobs(SOURCE_HEALTH_PROBE_QUERY);
    const latencyMs = Date.now() - startedAt;

    const inspection = inspectSourceResult(adapter.sourceId, result);
    const runtimeError = result.error?.trim() ? result.error.trim() : null;
    const error = runtimeError && isLikelyOutageError(runtimeError) ? runtimeError : null;
    const warning = runtimeError && !error
      ? inspection.warning
        ? `${inspection.warning} ${runtimeError}`
        : runtimeError
      : inspection.warning;

    return {
      sourceId: adapter.sourceId,
      sourceName: adapter.displayName,
      status: classifySourceHealthResult({
        resultCount: inspection.resultCount,
        error,
        warning,
        malformed: inspection.malformed,
      }),
      checkedAt,
      latencyMs,
      resultCount: inspection.resultCount,
      error,
      warning,
    };
  } catch (err) {
    return {
      sourceId: adapter.sourceId,
      sourceName: adapter.displayName,
      status: "down",
      checkedAt,
      latencyMs: null,
      resultCount: null,
      error: err instanceof Error ? err.message : "Source probe failed",
      warning: null,
    };
  }
}

export async function getLatestSourceHealthSnapshot(): Promise<SourceHealthSnapshot | null> {
  return readObject<SourceHealthSnapshot>(ConfigFiles.SOURCE_HEALTH);
}

export async function runSourceHealthCheck(): Promise<SourceHealthSnapshot> {
  const startedAt = Date.now();
  const adapters = getAllAdapters();
  const results: SourceHealthResult[] = [];

  for (const adapter of adapters) {
    results.push(await probeSource(adapter));
  }

  const snapshot: SourceHealthSnapshot = {
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    totalSources: results.length,
    ok: results.filter((result) => result.status === "ok").length,
    degraded: results.filter((result) => result.status === "degraded").length,
    down: results.filter((result) => result.status === "down").length,
    unknown: results.filter((result) => result.status === "unknown").length,
    results,
  };

  await writeObject(ConfigFiles.SOURCE_HEALTH, snapshot);
  return snapshot;
}
