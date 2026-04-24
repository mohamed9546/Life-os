// ============================================================
// Adzuna job source adapter.
// Uses the Adzuna API v1 to fetch UK job listings.
// Docs: https://developer.adzuna.com/docs/search
// ============================================================

import { RawJobItem } from "@/types";
import { getAppConfig } from "@/lib/config/app-config";
import { AppConfig } from "@/types";
import {
  JobSourceAdapter,
  JobSearchQuery,
  JobSourceResult,
} from "./types";
import {
  normalizeRawJob,
  detectRemoteType,
  detectEmploymentType,
} from "./normalize";

interface AdzunaJobResult {
  id: string;
  title: string;
  description: string;
  redirect_url: string;
  created: string; // ISO date
  company: {
    display_name: string;
  };
  location: {
    display_name: string;
    area: string[];
  };
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
  contract_type?: string;
  contract_time?: string;
  category?: {
    label: string;
    tag: string;
  };
}

interface AdzunaAPIResponse {
  results: AdzunaJobResult[];
  count: number;
  mean: number;
  __class__: string;
}

export class AdzunaAdapter implements JobSourceAdapter {
  readonly sourceId = "adzuna";
  readonly displayName = "Adzuna";

  private async getConfig(): Promise<{
    appId: string;
    appKey: string;
    country: string;
    enabled: boolean;
  } | null> {
    const appConfig = await getAppConfig();
    if (!appConfig?.jobSources?.adzuna) return null;
    return appConfig.jobSources.adzuna;
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    if (!config) return false;
    return config.enabled && !!config.appId && !!config.appKey;
  }

  async fetchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const now = new Date().toISOString();
    const config = await this.getConfig();

    if (!config || !config.enabled || !config.appId || !config.appKey) {
      return {
        source: this.sourceId,
        jobs: [],
        totalAvailable: 0,
        fetchedAt: now,
        query,
        error: "Adzuna is not configured. Set appId and appKey in Settings.",
      };
    }

    // Adzuna's `what` parameter AND-joins terms. A saved search like
    // `["clinical trial assistant", "trial coordinator", ...]` is the user's
    // intent to OR across those phrases, so we fan out one request per
    // keyword entry and merge/dedupe by sourceJobId.
    const keywordPhrases = query.keywords.length > 0 ? query.keywords : [""];
    const perPhraseCap = Math.min(query.maxResults || 25, 50);
    const totalCap = Math.min((query.maxResults || 25) * 2, 100);
    const seenIds = new Set<string>();
    const merged: RawJobItem[] = [];
    let totalAvailable = 0;
    let lastError: string | undefined;

    for (const phrase of keywordPhrases) {
      if (merged.length >= totalCap) break;
      try {
        const page = await this.fetchSinglePhrase(
          config,
          query,
          phrase,
          perPhraseCap,
          now
        );
        totalAvailable += page.totalAvailable;
        for (const job of page.jobs) {
          const id = job.sourceJobId || job.link;
          if (id && seenIds.has(id)) continue;
          if (id) seenIds.add(id);
          merged.push(job);
          if (merged.length >= totalCap) break;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Unknown Adzuna error";
        console.error(`[adzuna] Phrase "${phrase}" failed:`, lastError);
      }
    }

    console.log(
      `[adzuna] Merged ${merged.length} jobs across ${keywordPhrases.length} phrase(s)`
    );

    return {
      source: this.sourceId,
      jobs: merged,
      totalAvailable,
      fetchedAt: now,
      query,
      error: merged.length === 0 ? lastError : undefined,
    };
  }

  private async fetchSinglePhrase(
    config: { appId: string; appKey: string; country: string },
    query: JobSearchQuery,
    phrase: string,
    perPage: number,
    now: string
  ): Promise<{ jobs: RawJobItem[]; totalAvailable: number }> {
    const page = query.page || 1;
    const country = config.country || "gb";
    const where = query.location || "";

    const params = new URLSearchParams({
      app_id: config.appId,
      app_key: config.appKey,
      results_per_page: perPage.toString(),
      what: phrase,
      "content-type": "application/json",
    });

    if (where) params.set("where", where);
    if (query.negativeKeywords?.length) {
      params.set("what_exclude", query.negativeKeywords.join(" "));
    }
    if (query.radius) params.set("distance", query.radius.toString());
    if (query.salaryMin) params.set("salary_min", query.salaryMin.toString());
    if (query.salaryMax) params.set("salary_max", query.salaryMax.toString());
    params.set("sort_by", "date");

    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params.toString()}`;

    console.log(`[adzuna] Fetching: "${phrase}" in ${where || "any location"}`);

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      throw new Error(`Adzuna API returned ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as AdzunaAPIResponse;

    const jobs: RawJobItem[] = (data.results || []).map((result) => {
      const salaryText = formatAdzunaSalary(
        result.salary_min,
        result.salary_max,
        result.salary_is_predicted
      );

      return normalizeRawJob({
        source: this.sourceId,
        sourceJobId: result.id,
        title: result.title,
        company: result.company?.display_name || "Unknown Company",
        location: result.location?.display_name || "",
        salaryText,
        link: result.redirect_url,
        postedAt: result.created,
        employmentType: mapAdzunaContractType(result.contract_type, result.contract_time),
        remoteType: detectRemoteType(
          result.title,
          result.location?.display_name || "",
          result.description
        ),
        description: result.description,
        raw: result,
        fetchedAt: now,
      });
    });

    console.log(
      `[adzuna] "${phrase}" -> ${jobs.length} jobs (${data.count ?? 0} total available)`
    );

    return { jobs, totalAvailable: data.count ?? 0 };
  }
}

function formatAdzunaSalary(
  min?: number,
  max?: number,
  predicted?: string
): string | undefined {
  if (!min && !max) return undefined;

  const prefix = predicted === "1" ? "~" : "";

  if (min && max && min !== max) {
    return `${prefix}£${min.toLocaleString()} - £${max.toLocaleString()}`;
  }
  if (min) {
    return `${prefix}£${min.toLocaleString()}`;
  }
  if (max) {
    return `${prefix}Up to £${max.toLocaleString()}`;
  }

  return undefined;
}

function mapAdzunaContractType(type?: string, time?: string): string {
  if (type === "permanent" || time === "full_time") return "permanent";
  if (type === "contract") return "contract";
  if (time === "part_time") return "permanent"; // still permanent, just part time
  return "unknown";
}