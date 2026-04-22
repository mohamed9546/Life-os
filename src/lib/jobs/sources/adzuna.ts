// ============================================================
// Adzuna job source adapter.
// Uses the Adzuna API v1 to fetch UK job listings.
// Docs: https://developer.adzuna.com/docs/search
// ============================================================

import { RawJobItem } from "@/types";
import { readObject, ConfigFiles } from "@/lib/storage";
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
    const appConfig = await readObject<AppConfig>(ConfigFiles.APP_CONFIG);
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

    try {
      const page = query.page || 1;
      const perPage = Math.min(query.maxResults || 25, 50);
      const country = config.country || "gb";

      // Build the search query string
      const what = query.keywords.join(" ");
      const where = query.location || "";

      const params = new URLSearchParams({
        app_id: config.appId,
        app_key: config.appKey,
        results_per_page: perPage.toString(),
        page: page.toString(),
        what,
        content_type: "application/json",
      });

      if (where) params.set("where", where);
      if (query.negativeKeywords?.length) {
        params.set("what_exclude", query.negativeKeywords.join(" "));
      }
      if (query.radius) params.set("distance", query.radius.toString());
      if (query.salaryMin) params.set("salary_min", query.salaryMin.toString());
      if (query.salaryMax) params.set("salary_max", query.salaryMax.toString());

      // Sort by date to get newest first
      params.set("sort_by", "date");

      const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params.toString()}`;

      console.log(`[adzuna] Fetching: ${what} in ${where || "any location"}`);

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

      const jobs: RawJobItem[] = data.results.map((result) => {
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

      console.log(`[adzuna] Fetched ${jobs.length} jobs (${data.count} total available)`);

      return {
        source: this.sourceId,
        jobs,
        totalAvailable: data.count,
        fetchedAt: now,
        query,
        pageInfo: {
          page,
          perPage,
          hasMore: page * perPage < data.count,
        },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown Adzuna error";
      console.error(`[adzuna] Fetch error:`, errorMsg);

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