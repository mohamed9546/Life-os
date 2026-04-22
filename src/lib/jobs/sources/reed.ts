// ============================================================
// Reed job source adapter.
// Uses the Reed API to fetch UK job listings.
// Docs: https://www.reed.co.uk/developers/jobseeker
// Auth: Basic auth with API key as username, empty password.
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

interface ReedJobResult {
  jobId: number;
  employerId: number;
  employerName: string;
  employerProfileId: number | null;
  employerProfileName: string | null;
  jobTitle: string;
  locationName: string;
  minimumSalary: number | null;
  maximumSalary: number | null;
  currency: string | null;
  expirationDate: string;
  date: string; // posted date
  jobDescription: string;
  applications: number;
  jobUrl: string;
}

interface ReedSearchResponse {
  results: ReedJobResult[];
  ambiguousLocations: unknown[];
  totalResults: number;
}

export class ReedAdapter implements JobSourceAdapter {
  readonly sourceId = "reed";
  readonly displayName = "Reed";

  private async getConfig(): Promise<{
    apiKey: string;
    enabled: boolean;
  } | null> {
    const appConfig = await readObject<AppConfig>(ConfigFiles.APP_CONFIG);
    if (!appConfig?.jobSources?.reed) return null;
    return appConfig.jobSources.reed;
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
        error: "Reed is not configured. Set apiKey in Settings.",
      };
    }

    try {
      const resultsToTake = Math.min(query.maxResults || 25, 100);

      // Build query params — Reed supports -keyword exclusion syntax in the keywords field
      const positiveTerms = query.keywords.join(" ");
      const negativeTerms = (query.negativeKeywords ?? []).map((k) => `-${k}`).join(" ");
      const keywords = negativeTerms ? `${positiveTerms} ${negativeTerms}` : positiveTerms;
      const params = new URLSearchParams({
        keywords,
        resultsToTake: resultsToTake.toString(),
      });

      if (query.location) params.set("locationName", query.location);
      if (query.radius) params.set("distanceFromLocation", query.radius.toString());
      if (query.salaryMin) params.set("minimumSalary", query.salaryMin.toString());
      if (query.salaryMax) params.set("maximumSalary", query.salaryMax.toString());

      // Reed uses skip/take pagination
      if (query.page && query.page > 1) {
        params.set("resultsToSkip", ((query.page - 1) * resultsToTake).toString());
      }

      const url = `https://www.reed.co.uk/api/1.0/search?${params.toString()}`;

      // Reed uses Basic Auth: API key as username, empty password
      const authHeader = "Basic " + Buffer.from(`${config.apiKey}:`).toString("base64");

      console.log(
        `[reed] Fetching: ${query.keywords.join(" ")} in ${query.location || "any location"}`
      );

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: authHeader,
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        throw new Error(`Reed API returned ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as ReedSearchResponse;

      const jobs: RawJobItem[] = data.results.map((result) => {
        const salaryText = formatReedSalary(
          result.minimumSalary,
          result.maximumSalary,
          result.currency
        );

        return normalizeRawJob({
          source: this.sourceId,
          sourceJobId: result.jobId.toString(),
          title: result.jobTitle,
          company: result.employerName || "Unknown Company",
          location: result.locationName || "",
          salaryText,
          link: result.jobUrl || `https://www.reed.co.uk/jobs/${result.jobId}`,
          postedAt: result.date,
          employmentType: detectEmploymentType(
            result.jobTitle,
            result.jobDescription
          ),
          remoteType: detectRemoteType(
            result.jobTitle,
            result.locationName || "",
            result.jobDescription
          ),
          description: result.jobDescription,
          raw: result,
          fetchedAt: now,
        });
      });

      console.log(
        `[reed] Fetched ${jobs.length} jobs (${data.totalResults} total available)`
      );

      return {
        source: this.sourceId,
        jobs,
        totalAvailable: data.totalResults,
        fetchedAt: now,
        query,
        pageInfo: {
          page: query.page || 1,
          perPage: resultsToTake,
          hasMore: (query.page || 1) * resultsToTake < data.totalResults,
        },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown Reed error";
      console.error(`[reed] Fetch error:`, errorMsg);

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

function formatReedSalary(
  min: number | null,
  max: number | null,
  currency: string | null
): string | undefined {
  const symbol = currency === "GBP" || !currency ? "£" : currency;

  if (min && max && min !== max) {
    return `${symbol}${min.toLocaleString()} - ${symbol}${max.toLocaleString()}`;
  }
  if (min) {
    return `${symbol}${min.toLocaleString()}`;
  }
  if (max) {
    return `Up to ${symbol}${max.toLocaleString()}`;
  }

  return undefined;
}