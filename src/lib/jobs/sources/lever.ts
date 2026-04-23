// ============================================================
// Lever job board adapter.
// Uses the public Lever Postings API (no auth required).
// Each company has a public endpoint at lever.co.
// Docs: https://github.com/lever/postings-api
// ============================================================

import { RawJobItem } from "@/types";
import { getAppConfig } from "@/lib/config/app-config";
import { AppConfig, LeverCompanyConfig } from "@/types";
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

interface LeverPosting {
  id: string;
  text: string; // job title
  createdAt: number; // unix timestamp ms
  updatedAt: number;
  hostedUrl: string;
  applyUrl: string;
  categories: {
    commitment?: string; // e.g. "Full-time"
    department?: string;
    location?: string;
    team?: string;
  };
  description: string; // HTML
  descriptionPlain?: string;
  lists: Array<{
    text: string;
    content: string; // HTML list items
  }>;
  additional?: string;
  additionalPlain?: string;
}

export class LeverAdapter implements JobSourceAdapter {
  readonly sourceId = "lever";
  readonly displayName = "Lever";

  private async getCompanies(): Promise<LeverCompanyConfig[]> {
    const appConfig = await getAppConfig();
    if (!appConfig?.jobSources?.lever?.enabled) return [];
    return appConfig.jobSources.lever.companies.filter((c) => c.enabled);
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
          "No Lever companies configured. Add company endpoints in Settings.",
      };
    }

    const allJobs: RawJobItem[] = [];
    let totalAvailable = 0;
    const errors: string[] = [];

    for (const company of companies) {
      try {
        const result = await this.fetchFromCompany(company, query, now);
        allJobs.push(...result.jobs);
        totalAvailable += result.total;
      } catch (err) {
        const msg = `${company.name}: ${err instanceof Error ? err.message : "Unknown error"}`;
        console.error(`[lever] ${msg}`);
        errors.push(msg);
      }
    }

    console.log(
      `[lever] Fetched ${allJobs.length} jobs from ${companies.length} companies`
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
    company: LeverCompanyConfig,
    query: JobSearchQuery,
    now: string
  ): Promise<{ jobs: RawJobItem[]; total: number }> {
    // Lever endpoint: https://api.lever.co/v0/postings/COMPANY_SLUG
    // or custom endpoint URL from config
    const baseEndpoint =
      company.endpointUrl ||
      `https://api.lever.co/v0/postings/${encodeURIComponent(company.name.toLowerCase().replace(/\s+/g, "-"))}`;

    const params = new URLSearchParams({ mode: "json" });

    const url = `${baseEndpoint}?${params.toString()}`;

    console.log(`[lever] Fetching from ${company.name}`);

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const postings = (await response.json()) as LeverPosting[];

    if (!Array.isArray(postings)) {
      throw new Error("Unexpected response format — expected array of postings");
    }

    // Filter by keywords
    const keywordLower = query.keywords.map((k) => k.toLowerCase());
    let filtered = postings;

    if (keywordLower.length > 0) {
      filtered = postings.filter((posting) => {
        const searchText = [
          posting.text,
          posting.descriptionPlain || posting.description,
          posting.categories.department || "",
          posting.categories.team || "",
        ]
          .join(" ")
          .toLowerCase();
        return keywordLower.some((kw) => searchText.includes(kw));
      });
    }

    // Filter by location
    if (query.location) {
      const locationLower = query.location.toLowerCase();
      filtered = filtered.filter((posting) => {
        const jobLocation = (posting.categories.location || "").toLowerCase();
        return (
          jobLocation.includes(locationLower) ||
          locationLower.includes("uk") ||
          locationLower.includes("remote")
        );
      });
    }

    // Limit results
    const maxResults = query.maxResults || 25;
    const limited = filtered.slice(0, maxResults);

    const jobs: RawJobItem[] = limited.map((posting) => {
      const plainDescription =
        posting.descriptionPlain || stripHtml(posting.description);

      // Combine lists into description
      const listsText = posting.lists
        .map((list) => `\n${list.text}:\n${stripHtml(list.content)}`)
        .join("\n");

      const fullDescription = `${plainDescription}\n${listsText}`.trim();

      return normalizeRawJob({
        source: this.sourceId,
        sourceJobId: `lever-${posting.id}`,
        title: posting.text,
        company: company.name,
        location: posting.categories.location || "Unknown",
        link: posting.hostedUrl,
        postedAt: new Date(posting.createdAt).toISOString(),
        employmentType: mapLeverCommitment(posting.categories.commitment),
        remoteType: detectRemoteType(
          posting.text,
          posting.categories.location || "",
          fullDescription
        ),
        description: fullDescription,
        raw: posting,
        fetchedAt: now,
      });
    });

    return { jobs, total: postings.length };
  }
}

function mapLeverCommitment(commitment?: string): string {
  if (!commitment) return "unknown";
  const lower = commitment.toLowerCase();
  if (lower.includes("full") || lower.includes("permanent")) return "permanent";
  if (lower.includes("contract") || lower.includes("freelance")) return "contract";
  if (lower.includes("temp") || lower.includes("intern")) return "temp";
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