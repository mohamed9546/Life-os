// ============================================================
// Jooble job source adapter.
// Jooble is a job aggregator with a free API.
// Register at: https://jooble.org/api/about
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

interface JoobleJob {
  title: string;
  location: string;
  snippet: string;
  salary: string;
  source: string;
  type: string;
  link: string;
  company: string;
  updated: string; // date string
  id: string;
}

interface JoobleResponse {
  totalCount: number;
  jobs: JoobleJob[];
}

export class JoobleAdapter implements JobSourceAdapter {
  readonly sourceId = "jooble";
  readonly displayName = "Jooble";

  private async getConfig(): Promise<{
    apiKey: string;
    enabled: boolean;
  } | null> {
    const appConfig = await readObject<AppConfig>(ConfigFiles.APP_CONFIG);
    if (!appConfig?.jobSources?.jooble) return null;
    return appConfig.jobSources.jooble;
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    if (!config) return false;
    return config.enabled && !!config.apiKey;
  }

  async fetchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const now = new Date().toISOString();
    const config = await this.getConfig();

    if (!config || !config.enabled || !config.apiKey) {
      return {
        source: this.sourceId,
        jobs: [],
        totalAvailable: 0,
        fetchedAt: now,
        query,
        error: "Jooble is not configured. Set apiKey in Settings.",
      };
    }

    try {
      const url = `https://jooble.org/api/${config.apiKey}`;

      const requestBody = {
        keywords: query.keywords.join(" "),
        location: query.location || "United Kingdom",
        radius: query.radius ? String(query.radius) : undefined,
        salary: query.salaryMin ? String(query.salaryMin) : undefined,
        page: String(query.page || 1),
      };

      console.log(
        `[jooble] Fetching: ${requestBody.keywords} in ${requestBody.location}`
      );

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        throw new Error(`Jooble API returned ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as JoobleResponse;

      if (!data.jobs || !Array.isArray(data.jobs)) {
        return {
          source: this.sourceId,
          jobs: [],
          totalAvailable: 0,
          fetchedAt: now,
          query,
          error: "Jooble returned unexpected response format",
        };
      }

      // Limit results
      const maxResults = query.maxResults || 25;
      const limited = data.jobs.slice(0, maxResults);

      const jobs: RawJobItem[] = limited.map((joobleJob) => {
        return normalizeRawJob({
          source: this.sourceId,
          sourceJobId: joobleJob.id || undefined,
          title: joobleJob.title,
          company: joobleJob.company || "Unknown Company",
          location: joobleJob.location || "",
          salaryText: joobleJob.salary || undefined,
          link: joobleJob.link,
          postedAt: joobleJob.updated || undefined,
          employmentType: mapJoobleType(joobleJob.type),
          remoteType: detectRemoteType(
            joobleJob.title,
            joobleJob.location,
            joobleJob.snippet
          ),
          description: joobleJob.snippet || undefined,
          raw: joobleJob,
          fetchedAt: now,
        });
      });

      console.log(
        `[jooble] Fetched ${jobs.length} jobs (${data.totalCount} total available)`
      );

      return {
        source: this.sourceId,
        jobs,
        totalAvailable: data.totalCount,
        fetchedAt: now,
        query,
        pageInfo: {
          page: query.page || 1,
          perPage: maxResults,
          hasMore: (query.page || 1) * maxResults < data.totalCount,
        },
      };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown Jooble error";
      console.error(`[jooble] Fetch error:`, errorMsg);

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

function mapJoobleType(type?: string): string {
  if (!type) return "unknown";
  const lower = type.toLowerCase();
  if (lower.includes("permanent") || lower.includes("full-time") || lower.includes("full time"))
    return "permanent";
  if (lower.includes("contract")) return "contract";
  if (lower.includes("temp") || lower.includes("part-time")) return "temp";
  return "unknown";
}