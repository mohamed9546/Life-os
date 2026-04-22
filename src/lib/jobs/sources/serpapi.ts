// ============================================================
// SerpAPI Google Jobs adapter.
// Uses SerpAPI's official google_jobs engine to retrieve
// structured Google Jobs results.
// Docs: https://serpapi.com/google-jobs-api
// ============================================================

import { RawJobItem } from "@/types";
import { AppConfig } from "@/types";
import { readObject, ConfigFiles } from "@/lib/storage";
import {
  JobSearchQuery,
  JobSourceAdapter,
  JobSourceResult,
} from "./types";
import {
  detectEmploymentType,
  detectRemoteType,
  normalizeRawJob,
} from "./normalize";

interface SerpApiJobResult {
  job_id?: string;
  title?: string;
  company_name?: string;
  company?: string;
  location?: string;
  description?: string;
  link?: string;
  thumbnail?: string;
  via?: string;
  extensions?: string[];
  detected_extensions?: {
    posted_at?: string;
    schedule_type?: string;
    salary?: string;
  };
}

interface SerpApiResponse {
  jobs_results?:
    | SerpApiJobResult[]
    | {
        jobs?: SerpApiJobResult[];
      };
  error?: string;
  serpapi_pagination?: {
    next_page_token?: string;
  };
}

export class SerpApiAdapter implements JobSourceAdapter {
  readonly sourceId = "serpapi";
  readonly displayName = "SerpAPI Google Jobs";

  private async getConfig(): Promise<AppConfig["jobSources"]["serpApi"] | null> {
    const appConfig = await readObject<AppConfig>(ConfigFiles.APP_CONFIG);
    return appConfig?.jobSources?.serpApi ?? null;
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    return Boolean(config?.enabled && config.apiKey);
  }

  async fetchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const now = new Date().toISOString();
    const config = await this.getConfig();

    if (!config?.enabled || !config.apiKey) {
      return {
        source: this.sourceId,
        jobs: [],
        totalAvailable: 0,
        fetchedAt: now,
        query,
        error: "SerpAPI is not configured. Add an API key in Settings.",
      };
    }

    try {
      const params = new URLSearchParams({
        engine: "google_jobs",
        api_key: config.apiKey,
        q: buildQuery(query),
        hl: config.hl || "en",
        gl: config.gl || "uk",
        google_domain: config.googleDomain || "google.co.uk",
      });

      if (query.location) {
        params.set("location", query.location);
      }

      if (query.radius) {
        params.set("lrad", String(Math.max(1, Math.round(query.radius * 1.60934))));
      }

      const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        throw new Error(`SerpAPI returned ${response.status}: ${errorText}`);
      }

      const payload = (await response.json()) as SerpApiResponse;

      if (payload.error) {
        throw new Error(payload.error);
      }

      const resultList = Array.isArray(payload.jobs_results)
        ? payload.jobs_results
        : payload.jobs_results?.jobs || [];

      const jobs: RawJobItem[] = resultList
        .map((result) => {
          const title = result.title?.trim();
          const company = result.company_name?.trim() || result.company?.trim() || "Unknown Company";
          const link = result.link?.trim();

          if (!title || !link) {
            return null;
          }

          const description = result.description?.trim() || undefined;
          const schedule = result.detected_extensions?.schedule_type || result.extensions?.join(" ");
          const location = result.location?.trim() || query.location || "United Kingdom";

          return normalizeRawJob({
            source: this.sourceId,
            sourceJobId: result.job_id || link,
            title,
            company,
            location,
            salaryText: result.detected_extensions?.salary,
            link,
            postedAt: parseRelativePostedAt(result.detected_extensions?.posted_at),
            employmentType: detectEmploymentType(`${title} ${schedule || ""}`, description),
            remoteType: detectRemoteType(title, location, description),
            description,
            raw: result,
            fetchedAt: now,
          });
        })
        .filter((job): job is RawJobItem => Boolean(job));

      return {
        source: this.sourceId,
        jobs,
        totalAvailable: jobs.length,
        fetchedAt: now,
        query,
        pageInfo: {
          page: query.page || 1,
          perPage: jobs.length,
          hasMore: Boolean(payload.serpapi_pagination?.next_page_token),
        },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown SerpAPI error";

      return {
        source: this.sourceId,
        jobs: [],
        totalAvailable: 0,
        fetchedAt: now,
        query,
        error: errorMsg,
      };
    }
  }
}

function buildQuery(query: JobSearchQuery): string {
  const keywords = query.keywords.join(" ").trim();
  const remote = query.remoteOnly ? " remote" : "";
  return `${keywords}${remote}`.trim();
}

function parseRelativePostedAt(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const lower = value.toLowerCase().trim();
  const match = lower.match(/(\d+)\s+(minute|hour|day|week|month)s?\s+ago/);

  if (!match) {
    return undefined;
  }

  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const now = new Date();
  const unitToMs: Record<string, number> = {
    minute: 60_000,
    hour: 60 * 60_000,
    day: 24 * 60 * 60_000,
    week: 7 * 24 * 60 * 60_000,
    month: 30 * 24 * 60 * 60_000,
  };

  return new Date(now.getTime() - amount * unitToMs[unit]).toISOString();
}
