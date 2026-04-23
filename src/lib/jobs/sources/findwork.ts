// ============================================================
// FindWork job source adapter.
// Free API with key (register at https://findwork.dev).
// Good quality developer/tech listings.
// Docs: https://findwork.dev/developers/
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

interface FindWorkJob {
  id: string;
  role: string;
  company_name: string;
  company_num_employees: string | null;
  employment_type: string | null; // "full time", "contract", etc.
  location: string;
  remote: boolean;
  logo: string | null;
  url: string;
  text: string; // description (plain text or HTML)
  date_posted: string; // ISO date
  keywords: string[];
  source: string;
}

interface FindWorkResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: FindWorkJob[];
}

export class FindWorkAdapter implements JobSourceAdapter {
  readonly sourceId = "findwork";
  readonly displayName = "FindWork";

  private async getConfig(): Promise<{
    apiKey: string;
    enabled: boolean;
  } | null> {
    const appConfig = await getAppConfig();
    if (!appConfig?.jobSources?.findwork) return null;
    return appConfig.jobSources.findwork;
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
        error: "FindWork is not configured. Set apiKey in Settings.",
      };
    }

    try {
      const params = new URLSearchParams({
        search: query.keywords.join(" "),
        sort_by: "relevance",
      });

      if (query.location) params.set("location", query.location);
      if (query.remoteOnly) params.set("remote", "true");
      if (query.page && query.page > 1) {
        params.set("page", query.page.toString());
      }

      const url = `https://findwork.dev/api/jobs/?${params.toString()}`;

      console.log(
        `[findwork] Fetching: ${query.keywords.join(" ")} in ${query.location || "any"}`
      );

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Token ${config.apiKey}`,
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        throw new Error(`FindWork API returned ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as FindWorkResponse;

      const maxResults = query.maxResults || 25;
      const limited = data.results.slice(0, maxResults);

      const jobs: RawJobItem[] = limited.map((fwJob) => {
        return normalizeRawJob({
          source: this.sourceId,
          sourceJobId: fwJob.id,
          title: fwJob.role,
          company: fwJob.company_name || "Unknown Company",
          location: fwJob.location || (fwJob.remote ? "Remote" : "Unknown"),
          link: fwJob.url,
          postedAt: fwJob.date_posted,
          employmentType: mapFindWorkEmployment(fwJob.employment_type),
          remoteType: fwJob.remote
            ? "remote"
            : detectRemoteType(fwJob.role, fwJob.location, fwJob.text),
          description: stripHtml(fwJob.text),
          raw: fwJob,
          fetchedAt: now,
        });
      });

      console.log(
        `[findwork] Fetched ${jobs.length} jobs (${data.count} total available)`
      );

      return {
        source: this.sourceId,
        jobs,
        totalAvailable: data.count,
        fetchedAt: now,
        query,
        pageInfo: {
          page: query.page || 1,
          perPage: maxResults,
          hasMore: data.next !== null,
        },
      };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown FindWork error";
      console.error(`[findwork] Fetch error:`, errorMsg);

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

function mapFindWorkEmployment(type: string | null): string {
  if (!type) return "unknown";
  const lower = type.toLowerCase();
  if (lower.includes("full")) return "permanent";
  if (lower.includes("contract") || lower.includes("freelance")) return "contract";
  if (lower.includes("part") || lower.includes("intern")) return "temp";
  return "unknown";
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}