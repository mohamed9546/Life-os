// ============================================================
// Greenhouse job board adapter.
// Uses the public Greenhouse Job Board API (no auth required).
// Each company has a board token — we fetch from configured companies.
// Docs: https://developers.greenhouse.io/job-board.html
// ============================================================

import { RawJobItem } from "@/types";
import { getAppConfig } from "@/lib/config/app-config";
import { AppConfig, GreenhouseCompanyConfig } from "@/types";
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

interface GreenhouseJob {
  id: number;
  title: string;
  updated_at: string;
  absolute_url: string;
  location: {
    name: string;
  };
  metadata: Array<{
    id: number;
    name: string;
    value: string | string[] | null;
    value_type: string;
  }> | null;
  departments: Array<{
    id: number;
    name: string;
  }>;
  offices: Array<{
    id: number;
    name: string;
    location: string | null;
  }>;
  content: string; // HTML job description
}

interface GreenhouseBoardResponse {
  jobs: GreenhouseJob[];
  meta: {
    total: number;
  };
}

export class GreenhouseAdapter implements JobSourceAdapter {
  readonly sourceId = "greenhouse";
  readonly displayName = "Greenhouse";

  private async getCompanies(): Promise<GreenhouseCompanyConfig[]> {
    const appConfig = await getAppConfig();
    if (!appConfig?.jobSources?.greenhouse?.enabled) return [];
    return appConfig.jobSources.greenhouse.companies.filter((c) => c.enabled);
  }

  async isConfigured(): Promise<boolean> {
    const companies = await this.getCompanies();
    return companies.length > 0;
  }

  async fetchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const now = new Date().toISOString();
    const companies = await this.getCompanies();

    if (companies.length === 0) {
      return {
        source: this.sourceId,
        jobs: [],
        totalAvailable: 0,
        fetchedAt: now,
        query,
        error:
          "No Greenhouse companies configured. Add company board tokens in Settings.",
      };
    }

    const allJobs: RawJobItem[] = [];
    let totalAvailable = 0;
    const errors: string[] = [];

    // Fetch from each configured company
    for (const company of companies) {
      try {
        const result = await this.fetchFromCompany(company, query, now);
        allJobs.push(...result.jobs);
        totalAvailable += result.total;
      } catch (err) {
        const msg = `${company.name}: ${err instanceof Error ? err.message : "Unknown error"}`;
        console.error(`[greenhouse] ${msg}`);
        errors.push(msg);
      }
    }

    console.log(
      `[greenhouse] Fetched ${allJobs.length} jobs from ${companies.length} companies`
    );

    return {
      source: this.sourceId,
      jobs: allJobs,
      totalAvailable,
      fetchedAt: now,
      query,
      error: errors.length > 0 ? errors.join("; ") : undefined,
    };
  }

  private async fetchFromCompany(
    company: GreenhouseCompanyConfig,
    query: JobSearchQuery,
    now: string
  ): Promise<{ jobs: RawJobItem[]; total: number }> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${company.boardToken}/jobs?content=true`;

    console.log(`[greenhouse] Fetching from ${company.name} (${company.boardToken})`);

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as GreenhouseBoardResponse;

    // Filter by keywords if provided
    const keywordLower = query.keywords.map((k) => k.toLowerCase());
    let filtered = data.jobs;

    if (keywordLower.length > 0) {
      filtered = data.jobs.filter((job) => {
        const searchText =
          `${job.title} ${job.content} ${job.departments.map((d) => d.name).join(" ")}`.toLowerCase();
        return keywordLower.some((kw) => searchText.includes(kw));
      });
    }

    // Filter by location if provided
    if (query.location) {
      const locationLower = query.location.toLowerCase();
      filtered = filtered.filter((job) => {
        const jobLocation = job.location?.name?.toLowerCase() || "";
        const offices = job.offices
          .map((o) => `${o.name} ${o.location || ""}`.toLowerCase())
          .join(" ");
        return (
          jobLocation.includes(locationLower) ||
          offices.includes(locationLower) ||
          locationLower.includes("uk") ||
          locationLower.includes("remote")
        );
      });
    }

    // Limit results
    const maxResults = query.maxResults || 25;
    const limited = filtered.slice(0, maxResults);

    const jobs: RawJobItem[] = limited.map((ghJob) => {
      // Strip HTML from description for AI processing
      const plainDescription = stripHtml(ghJob.content);

      return normalizeRawJob({
        source: this.sourceId,
        sourceJobId: `gh-${company.boardToken}-${ghJob.id}`,
        title: ghJob.title,
        company: company.name,
        location: ghJob.location?.name || "Unknown",
        link: ghJob.absolute_url,
        postedAt: ghJob.updated_at,
        employmentType: detectEmploymentType(ghJob.title, plainDescription),
        remoteType: detectRemoteType(
          ghJob.title,
          ghJob.location?.name || "",
          plainDescription
        ),
        description: plainDescription,
        raw: ghJob,
        fetchedAt: now,
      });
    });

    return { jobs, total: data.meta?.total || data.jobs.length };
  }
}

/**
 * Simple HTML tag stripper.
 * Good enough for job descriptions — we don't need a full parser.
 */
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