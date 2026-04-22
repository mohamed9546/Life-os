// ============================================================
// The Muse job source adapter.
//
// Requires a real API key as of 2024 — the legacy "test" key
// now returns 403 unconditionally. Disabled unless
// THEMUSE_API_KEY is set in the environment.
//
// Get a key: https://www.themuse.com/developers/api/v2
// ============================================================

import { RawJobItem } from "@/types";
import { getAppConfig } from "@/lib/config/app-config";
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

interface MuseJob {
  id: number;
  name: string;
  type: string;
  short_name: string;
  publication_date: string;
  locations: Array<{ name: string }>;
  categories: Array<{ name: string }>;
  levels: Array<{ name: string; short_name: string }>;
  tags: unknown[];
  refs: { landing_page: string };
  company: { id: number; name: string; short_name: string };
  contents: string;
  model_type: string;
}

interface MuseResponse {
  page: number;
  page_count: number;
  items_per_page: number;
  total: number;
  results: MuseJob[];
}

export class TheMuseAdapter implements JobSourceAdapter {
  readonly sourceId = "themuse";
  readonly displayName = "The Muse";

  private async getConfig() {
    const appConfig = await getAppConfig();
    return appConfig.jobSources.themuse;
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    return Boolean(config.enabled && config.apiKey);
  }

  async fetchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const now = new Date().toISOString();
    const config = await this.getConfig();
    const apiKey = config.apiKey;

    if (!config.enabled || !apiKey) {
      return {
        source: this.sourceId,
        jobs: [],
        totalAvailable: 0,
        fetchedAt: now,
        query,
        error: "The Muse is not configured. Set apiKey in Settings.",
      };
    }

    try {
      const page = query.page || 1;
      const musePageIndex = page - 1;

      const params = new URLSearchParams({
        page: musePageIndex.toString(),
        api_key: apiKey,
      });

      if (query.location) {
        const museLocation = mapToMuseLocation(query.location);
        if (museLocation) params.set("location", museLocation);
      }

      const category = mapToMuseCategory(query.keywords);
      if (category) params.set("category", category);

      params.append("level", "Entry Level");
      params.append("level", "Mid Level");

      const url = `https://www.themuse.com/api/public/jobs?${params.toString()}`;

      console.log(
        `[themuse] Fetching page ${page}: ${query.keywords.join(" ")}`
      );

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "LifeOS/1.0",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        // 403 specifically means bad/expired key — surface clearly
        if (response.status === 403 || response.status === 401) {
          throw new Error(
            `The Muse API returned ${response.status} — check your THEMUSE_API_KEY`
          );
        }
        throw new Error(`The Muse API returned ${response.status}`);
      }

      const data = (await response.json()) as MuseResponse;

      const keywordLower = query.keywords.map((k) => k.toLowerCase());
      let filtered = data.results;

      if (keywordLower.length > 0) {
        filtered = data.results.filter((job) => {
          const searchText = [
            job.name,
            job.contents,
            job.company?.name || "",
            ...(job.categories || []).map((c) => c.name),
          ]
            .join(" ")
            .toLowerCase();
          return keywordLower.some((kw) => searchText.includes(kw));
        });
      }

      const maxResults = query.maxResults || 25;
      const limited = filtered.slice(0, maxResults);

      const jobs: RawJobItem[] = limited.map((museJob) => {
        const locationStr =
          (museJob.locations || []).map((l) => l.name).join(", ") || "Unknown";
        const plainDescription = stripHtml(museJob.contents || "");
        const levelStr = (museJob.levels || [])
          .map((l) => l.name)
          .join(", ");

        return normalizeRawJob({
          source: this.sourceId,
          sourceJobId: museJob.id?.toString(),
          title: museJob.name,
          company: museJob.company?.name || "Unknown Company",
          location: locationStr,
          link:
            museJob.refs?.landing_page ||
            `https://www.themuse.com/jobs/${museJob.short_name}`,
          postedAt: museJob.publication_date,
          employmentType: detectEmploymentType(museJob.name, plainDescription),
          remoteType: detectRemoteType(
            museJob.name,
            locationStr,
            plainDescription
          ),
          description: plainDescription,
          raw: {
            ...museJob,
            _level: levelStr,
            _categories: (museJob.categories || []).map((c) => c.name),
          },
          fetchedAt: now,
        });
      });

      console.log(
        `[themuse] Fetched ${jobs.length} jobs (${data.total} total, page ${page}/${data.page_count})`
      );

      return {
        source: this.sourceId,
        jobs,
        totalAvailable: data.total,
        fetchedAt: now,
        query,
        pageInfo: {
          page,
          perPage: data.items_per_page,
          hasMore: page < data.page_count,
        },
      };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown Muse error";
      console.error(`[themuse] Fetch error:`, errorMsg);

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

function mapToMuseLocation(location: string): string | null {
  const lower = location.toLowerCase();
  if (lower.includes("london")) return "London, United Kingdom";
  if (lower.includes("glasgow") || lower.includes("scotland"))
    return "United Kingdom";
  if (lower.includes("uk") || lower.includes("united kingdom"))
    return "United Kingdom";
  if (lower.includes("remote")) return "Flexible / Remote";
  return null;
}

function mapToMuseCategory(keywords: string[]): string | null {
  const joined = keywords.join(" ").toLowerCase();
  if (joined.includes("qa") || joined.includes("quality"))
    return "Science and Engineering";
  if (joined.includes("regulatory") || joined.includes("pharma"))
    return "Science and Engineering";
  if (joined.includes("clinical") || joined.includes("medical"))
    return "Healthcare";
  if (joined.includes("data") || joined.includes("research"))
    return "Data and Analytics";
  return null;
}

function stripHtml(html: string): string {
  if (!html) return "";
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
