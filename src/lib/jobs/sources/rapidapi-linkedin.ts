// ============================================================
// RapidAPI LinkedIn Jobs adapter.
// Uses the "linkedin-jobs-search" API on RapidAPI.
// This gives STRUCTURED JSON back — far better than scraping.
//
// Sign up: https://rapidapi.com/jaypat87/api/linkedin-jobs-search
// Free tier: 5 requests/month (limited but structured)
// Pro tier: 100 requests/month (~\$10/mo)
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
} from "./normalize";

interface RapidAPILinkedInJob {
  id: string;
  title: string;
  url: string;
  referenceId: string;
  posterId: string;
  company: {
    name: string;
    logo: string;
    url: string;
  };
  location: string;
  type: string; // "Full-time", "Contract", etc.
  postDate: string;
  benefits: string;
  formattedExperienceLevel: string;
  description: string;
  descriptionHtml: string;
  salary: string;
  applicationsCount: string;
  expireAt: string;
}

interface RapidAPIResponse {
  data: RapidAPILinkedInJob[];
  success: boolean;
  message: string;
}

export class RapidAPILinkedInAdapter implements JobSourceAdapter {
  readonly sourceId = "rapidapi-linkedin";
  readonly displayName = "LinkedIn (RapidAPI)";

  private async getConfig(): Promise<{
    apiKey: string;
    enabled: boolean;
  } | null> {
    const appConfig = await readObject<AppConfig>(ConfigFiles.APP_CONFIG);
    if (!appConfig?.jobSources?.rapidApiLinkedin) return null;
    return appConfig.jobSources.rapidApiLinkedin;
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
        error:
          "RapidAPI LinkedIn not configured. Get a free API key at rapidapi.com/jaypat87/api/linkedin-jobs-search",
      };
    }

    try {
      const keywords = query.keywords.join(" ");

      // Map location to LinkedIn's location format
      const locationId = mapToLinkedInLocationId(query.location);

      const params: Record<string, string> = {
        keywords,
        locationId: locationId || "101165590", // UK default
        datePosted: "pastWeek",
        sort: "mostRecent",
      };

      if (query.page && query.page > 1) {
        params.start = ((query.page - 1) * 25).toString();
      }

      if (query.remoteOnly) {
        params.onsiteRemote = "remote";
      }

      // Map employment type
      const jobType = mapEmploymentTypeToLinkedIn(query);
      if (jobType) {
        params.jobType = jobType;
      }

      const searchParams = new URLSearchParams(params);
      const url = `https://linkedin-jobs-search.p.rapidapi.com/?${searchParams.toString()}`;

      console.log(
        `[rapidapi-linkedin] Fetching: ${keywords} in ${query.location || "UK"}`
      );

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": config.apiKey,
          "X-RapidAPI-Host": "linkedin-jobs-search.p.rapidapi.com",
        },
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            "RapidAPI rate limit reached. Free tier: 5 req/month."
          );
        }
        throw new Error(`RapidAPI returned ${response.status}`);
      }

      const data = (await response.json()) as RapidAPIResponse | RapidAPILinkedInJob[];

      // Handle both response formats (API sometimes returns array directly)
      const jobList = Array.isArray(data)
        ? data
        : data.data || [];

      const maxResults = query.maxResults || 25;
      const limited = jobList.slice(0, maxResults);

      const jobs: RawJobItem[] = limited.map((liJob) => {
        return normalizeRawJob({
          source: this.sourceId,
          sourceJobId: `li-rapid-${liJob.id || liJob.referenceId}`,
          title: liJob.title,
          company: liJob.company?.name || "Unknown Company",
          location: liJob.location || "",
          salaryText: liJob.salary || undefined,
          link: liJob.url || `https://www.linkedin.com/jobs/view/${liJob.id}`,
          postedAt: liJob.postDate || undefined,
          employmentType: mapLinkedInJobType(liJob.type),
          remoteType: detectRemoteType(
            liJob.title,
            liJob.location || "",
            liJob.description
          ),
          description: liJob.description || stripHtml(liJob.descriptionHtml || ""),
          raw: liJob,
          fetchedAt: now,
        });
      });

      console.log(
        `[rapidapi-linkedin] Fetched ${jobs.length} structured LinkedIn jobs`
      );

      return {
        source: this.sourceId,
        jobs,
        totalAvailable: jobList.length,
        fetchedAt: now,
        query,
      };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown RapidAPI error";
      console.error(`[rapidapi-linkedin] Fetch error:`, errorMsg);

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

// ---- Location mapping ----

function mapToLinkedInLocationId(location?: string): string | null {
  if (!location) return null;
  const lower = location.toLowerCase();

  const locationMap: Record<string, string> = {
    glasgow: "100842583",
    edinburgh: "101164345",
    scotland: "105088498",
    london: "102257491",
    manchester: "100694774",
    "united kingdom": "101165590",
    uk: "101165590",
  };

  for (const [key, id] of Object.entries(locationMap)) {
    if (lower.includes(key)) return id;
  }

  return "101165590"; // Default to UK
}

function mapLinkedInJobType(type?: string): string {
  if (!type) return "unknown";
  const lower = type.toLowerCase();
  if (lower.includes("full")) return "permanent";
  if (lower.includes("contract")) return "contract";
  if (lower.includes("part")) return "permanent";
  if (lower.includes("temp") || lower.includes("intern")) return "temp";
  return "unknown";
}

function mapEmploymentTypeToLinkedIn(
  query: JobSearchQuery
): string | null {
  // LinkedIn job type codes: F=Full-time, P=Part-time, C=Contract, T=Temporary, I=Internship
  return null; // Don't filter by default — get all types
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