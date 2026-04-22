// ============================================================
// Remotive job source adapter.
// Free API, NO auth required.
// Great for remote-friendly roles.
// Docs: https://remotive.com/api-documentation
// ============================================================

import { RawJobItem } from "@/types";
import {
  JobSourceAdapter,
  JobSearchQuery,
  JobSourceResult,
} from "./types";
import { normalizeRawJob, detectEmploymentType } from "./normalize";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo: string | null;
  category: string;
  job_type: string; // e.g. "full_time", "contract"
  publication_date: string; // ISO date
  candidate_required_location: string;
  salary: string;
  description: string; // HTML
  tags: string[];
}

interface RemotiveResponse {
  "job-count": number;
  jobs: RemotiveJob[];
}

export class RemotiveAdapter implements JobSourceAdapter {
  readonly sourceId = "remotive";
  readonly displayName = "Remotive (Remote Jobs)";

  // No configuration needed — free public API
  async isConfigured(): Promise<boolean> {
    return true;
  }

  async fetchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const now = new Date().toISOString();

    try {
      // Remotive API params
      const params = new URLSearchParams();

      // Remotive uses 'search' param for keywords
      if (query.keywords.length > 0) {
        params.set("search", query.keywords.join(" "));
      }

      // Category filter — map our tracks to Remotive categories
      // Available: software-dev, customer-support, design, marketing,
      // sales, product, business, data, devops, finance-legal, hr,
      // qa, writing, medical-health, teaching, all-others
      const category = mapToRemotiveCategory(query.keywords);
      if (category) {
        params.set("category", category);
      }

      // Limit
      const limit = Math.min(query.maxResults || 25, 100);
      params.set("limit", limit.toString());

      const url = `https://remotive.com/api/remote-jobs?${params.toString()}`;

      console.log(`[remotive] Fetching: ${query.keywords.join(" ")}`);

      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`Remotive API returned ${response.status}`);
      }

      const data = (await response.json()) as RemotiveResponse;

      // Filter for UK-compatible jobs if location is specified
      let filteredJobs = data.jobs;
      if (query.location) {
        const locationLower = query.location.toLowerCase();
        filteredJobs = data.jobs.filter((job) => {
          const requiredLocation = (
            job.candidate_required_location || ""
          ).toLowerCase();
          // Keep if: worldwide, europe, UK, or matches location
          return (
            requiredLocation.includes("worldwide") ||
            requiredLocation.includes("anywhere") ||
            requiredLocation.includes("europe") ||
            requiredLocation.includes("uk") ||
            requiredLocation.includes("united kingdom") ||
            requiredLocation.includes("britain") ||
            requiredLocation.includes(locationLower)
          );
        });
      }

      const limited = filteredJobs.slice(0, limit);

      const jobs: RawJobItem[] = limited.map((rJob) => {
        return normalizeRawJob({
          source: this.sourceId,
          sourceJobId: rJob.id.toString(),
          title: rJob.title,
          company: rJob.company_name || "Unknown Company",
          location: rJob.candidate_required_location || "Remote",
          salaryText: rJob.salary || undefined,
          link: rJob.url,
          postedAt: rJob.publication_date,
          employmentType: mapRemotiveJobType(rJob.job_type),
          remoteType: "remote", // All Remotive jobs are remote
          description: stripHtml(rJob.description),
          raw: rJob,
          fetchedAt: now,
        });
      });

      console.log(
        `[remotive] Fetched ${jobs.length} jobs (${data["job-count"]} total)`
      );

      return {
        source: this.sourceId,
        jobs,
        totalAvailable: data["job-count"],
        fetchedAt: now,
        query,
      };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown Remotive error";
      console.error(`[remotive] Fetch error:`, errorMsg);

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

function mapToRemotiveCategory(keywords: string[]): string | null {
  const joined = keywords.join(" ").toLowerCase();
  if (joined.includes("qa") || joined.includes("quality")) return "qa";
  if (joined.includes("medical") || joined.includes("pharma") || joined.includes("health"))
    return "medical-health";
  if (joined.includes("data") || joined.includes("clinical research"))
    return "data";
  if (joined.includes("writing") || joined.includes("medical information"))
    return "writing";
  return null; // search all categories
}

function mapRemotiveJobType(type: string): string {
  switch (type) {
    case "full_time":
      return "permanent";
    case "contract":
      return "contract";
    case "part_time":
      return "permanent";
    case "freelance":
      return "contract";
    case "internship":
      return "temp";
    default:
      return "unknown";
  }
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