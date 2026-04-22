// ============================================================
// Arbeitnow job source adapter.
// Free API, NO auth required.
// European focus — good for UK roles.
// Docs: https://www.arbeitnow.com/api
// ============================================================

import { RawJobItem } from "@/types";
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

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string; // HTML
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[]; // e.g. ["full-time"]
  location: string;
  created_at: number; // unix timestamp
}

interface ArbeitnowResponse {
  data: ArbeitnowJob[];
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number;
    last_page: number;
    per_page: number;
    to: number;
    total: number;
    terms: string;
    info: string;
  };
}

export class ArbeitnowAdapter implements JobSourceAdapter {
  readonly sourceId = "arbeitnow";
  readonly displayName = "Arbeitnow (EU/UK Jobs)";

  // No configuration needed — free public API
  async isConfigured(): Promise<boolean> {
    return true;
  }

  async fetchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const now = new Date().toISOString();

    try {
      const page = query.page || 1;

      // Build URL — Arbeitnow has simple pagination
      const url = `https://www.arbeitnow.com/api/job-board-api?page=${page}`;

      console.log(`[arbeitnow] Fetching page ${page}`);

      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`Arbeitnow API returned ${response.status}`);
      }

      const data = (await response.json()) as ArbeitnowResponse;

      // Filter by keywords
      const keywordLower = query.keywords.map((k) => k.toLowerCase());
      let filtered = data.data;

      if (keywordLower.length > 0) {
        filtered = data.data.filter((job) => {
          const searchText = [
            job.title,
            job.description,
            job.company_name,
            ...job.tags,
          ]
            .join(" ")
            .toLowerCase();
          return keywordLower.some((kw) => searchText.includes(kw));
        });
      }

      // Filter by location — accept UK, Europe, Worldwide, or explicitly remote
      if (query.location && !query.remoteOnly) {
        const locationLower = query.location.toLowerCase();
        filtered = filtered.filter((job) => {
          const jobLocationLower = job.location.toLowerCase();
          return (
            job.remote ||
            jobLocationLower.includes(locationLower) ||
            jobLocationLower.includes("uk") ||
            jobLocationLower.includes("united kingdom") ||
            jobLocationLower.includes("scotland") ||
            jobLocationLower.includes("glasgow") ||
            jobLocationLower.includes("edinburgh") ||
            jobLocationLower.includes("london") ||
            jobLocationLower.includes("europe") ||
            jobLocationLower.includes("worldwide") ||
            jobLocationLower.includes("anywhere") ||
            jobLocationLower.includes("remote")
          );
        });
      }

      // Limit
      const maxResults = query.maxResults || 25;
      const limited = filtered.slice(0, maxResults);

      const jobs: RawJobItem[] = limited.map((aJob) => {
        const plainDescription = stripHtml(aJob.description);

        return normalizeRawJob({
          source: this.sourceId,
          sourceJobId: aJob.slug,
          title: aJob.title,
          company: aJob.company_name || "Unknown Company",
          location: aJob.location || (aJob.remote ? "Remote" : "Unknown"),
          link: aJob.url,
          postedAt: new Date(aJob.created_at * 1000).toISOString(),
          employmentType: mapArbeitnowJobType(aJob.job_types),
          remoteType: aJob.remote ? "remote" : detectRemoteType(
            aJob.title,
            aJob.location,
            plainDescription
          ),
          description: plainDescription,
          raw: aJob,
          fetchedAt: now,
        });
      });

      console.log(
        `[arbeitnow] Fetched ${jobs.length} jobs (${data.meta?.total ?? 'unknown'} total, filtered from ${data.data?.length ?? 0} on page)`
      );

      return {
        source: this.sourceId,
        jobs,
        totalAvailable: data.meta?.total ?? 0,
        fetchedAt: now,
        query,
        pageInfo: {
          page: data.meta?.current_page ?? page,
          perPage: data.meta?.per_page ?? 100,
          hasMore: data.links?.next != null,
        },
      };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown Arbeitnow error";
      console.error(`[arbeitnow] Fetch error:`, errorMsg);

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

function mapArbeitnowJobType(types: string[]): string {
  if (!types || types.length === 0) return "unknown";
  const joined = types.join(" ").toLowerCase();
  if (joined.includes("full")) return "permanent";
  if (joined.includes("contract") || joined.includes("freelance"))
    return "contract";
  if (joined.includes("part") || joined.includes("intern")) return "temp";
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