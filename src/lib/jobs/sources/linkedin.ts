// ============================================================
// LinkedIn job source adapter.
//
// LinkedIn has NO public job search API. This adapter works via:
//
// 1. PUBLIC JOB LISTING PAGES: LinkedIn exposes individual job
//    pages publicly. We can fetch and parse those.
//
// 2. LINKEDIN JOB SEARCH RSS: LinkedIn's job search results
//    can be accessed in a semi-structured way.
//
// 3. PASTED ALERT PARSING: Users can paste LinkedIn job alert
//    emails and we extract structured job data with AI.
//
// 4. GOOGLE DORKING: Search Google for "site:linkedin.com/jobs"
//    to find listings. (Uses no API, just public search.)
//
// This adapter combines approaches 1 + 2 to get real results
// without violating ToS (we only access public pages).
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

export class LinkedInAdapter implements JobSourceAdapter {
  readonly sourceId = "linkedin";
  readonly displayName = "LinkedIn";

  private async getConfig() {
    const appConfig = await getAppConfig();
    return appConfig.jobSources.linkedin;
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enabled;
  }

  async fetchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const now = new Date().toISOString();
    const config = await this.getConfig();

    if (!config.enabled) {
      return {
        source: this.sourceId,
        jobs: [],
        totalAvailable: 0,
        fetchedAt: now,
        query,
        error: "LinkedIn public adapter is disabled in Settings.",
      };
    }

    try {
      // LinkedIn public job search endpoint
      // This returns HTML but with embedded structured data we can extract
      const jobs = await this.fetchFromPublicSearch(query, now);

      console.log(`[linkedin] Fetched ${jobs.length} jobs`);

      return {
        source: this.sourceId,
        jobs,
        totalAvailable: jobs.length,
        fetchedAt: now,
        query,
      };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown LinkedIn error";
      console.error(`[linkedin] Fetch error:`, errorMsg);

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

  /**
   * Fetch from LinkedIn's public guest job search API.
   * LinkedIn exposes a guest-accessible job search endpoint that
   * returns JSON when called with the right headers.
   */
  private async fetchFromPublicSearch(
    query: JobSearchQuery,
    now: string
  ): Promise<RawJobItem[]> {
    const keywords = query.keywords.join(" ");
    const location = query.location || "United Kingdom";

    // LinkedIn guest job search URL
    // This endpoint is publicly accessible (used by non-logged-in visitors)
    const params = new URLSearchParams({
      keywords,
      location,
      trk: "public_jobs_jobs-search-bar_search-submit",
      position: "1",
      pageNum: ((query.page || 1) - 1).toString(),
      start: (((query.page || 1) - 1) * 25).toString(),
      sortBy: "DD", // Date descending
    });

    // Try fetching the public job listings page
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params.toString()}`;

    console.log(`[linkedin] Fetching public search: ${keywords} in ${location}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-GB,en;q=0.9",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      // LinkedIn may rate-limit or block — degrade gracefully
      if (response.status === 429) {
        throw new Error(
          "LinkedIn rate limited. Wait a few minutes and try again."
        );
      }
      throw new Error(`LinkedIn returned ${response.status}`);
    }

    const html = await response.text();
    return this.parseJobListingsHtml(html, query, now);
  }

  /**
   * Parse LinkedIn's job listing HTML cards.
   * LinkedIn's guest API returns HTML fragments with structured
   * job card elements we can extract data from.
   */
  private parseJobListingsHtml(
    html: string,
    query: JobSearchQuery,
    now: string
  ): RawJobItem[] {
    const jobs: RawJobItem[] = [];

    // LinkedIn job cards follow this pattern in the guest HTML:
    // <div class="base-card ... job-search-card" data-entity-urn="...">
    //   <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/...">
    //   <h3 class="base-search-card__title">Job Title</h3>
    //   <h4 class="base-search-card__subtitle">Company Name</h4>
    //   <span class="job-search-card__location">Location</span>
    //   <time class="job-search-card__listdate" datetime="2024-01-15">
    //   <span class="job-search-card__salary-info">Salary</span>

    // Extract all job card blocks
    const cardRegex =
      /<div[^>]*class="[^"]*base-card[^"]*job-search-card[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*base-card[^"]*job-search-card|$)/gi;

    // Alternatively, split by job card boundaries
    const cards = html.split(
      /(?=<div[^>]*class="[^"]*base-card[^"]*job-search-card)/i
    );

    for (const card of cards) {
      if (card.trim().length < 50) continue;

      const title = extractHtmlContent(
        card,
        /class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\//i
      );
      const company = extractHtmlContent(
        card,
        /class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\//i
      );
      const location = extractHtmlContent(
        card,
        /class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\//i
      );
      const link = extractAttribute(
        card,
        /class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]+)"/i
      );
      const dateStr = extractAttribute(
        card,
        /class="[^"]*job-search-card__listdate[^"]*"[^>]*datetime="([^"]+)"/i
      );
      const salary = extractHtmlContent(
        card,
        /class="[^"]*job-search-card__salary-info[^"]*"[^>]*>([\s\S]*?)<\//i
      );
      const entityUrn = extractAttribute(
        card,
        /data-entity-urn="([^"]+)"/i
      );

      // Need at least title and either link or company
      if (!title) continue;

      const jobUrl =
        link || (entityUrn ? `https://www.linkedin.com/jobs/view/${entityUrn.split(":").pop()}` : "");

      if (!jobUrl) continue;

      jobs.push(
        normalizeRawJob({
          source: this.sourceId,
          sourceJobId: extractLinkedInJobId(jobUrl, entityUrn),
          title: cleanText(title),
          company: cleanText(company) || "Unknown Company",
          location: cleanText(location) || "",
          salaryText: salary ? cleanText(salary) : undefined,
          link: cleanLinkedInUrl(jobUrl),
          postedAt: dateStr || undefined,
          employmentType: detectEmploymentType(title, ""),
          remoteType: detectRemoteType(
            title,
            location || "",
            ""
          ),
          description: undefined, // Would need a second fetch per job to get descriptions
          raw: {
            _source: "linkedin-guest-search",
            _entityUrn: entityUrn,
          },
          fetchedAt: now,
        })
      );
    }

    // Limit results
    const maxResults = query.maxResults || 25;
    return jobs.slice(0, maxResults);
  }
}

// ---- Utility functions ----

function extractHtmlContent(
  html: string,
  regex: RegExp
): string | null {
  const match = html.match(regex);
  if (!match || !match[1]) return null;
  return match[1].trim();
}

function extractAttribute(
  html: string,
  regex: RegExp
): string | null {
  const match = html.match(regex);
  if (!match || !match[1]) return null;
  return match[1].trim();
}

function cleanText(text: string | null): string {
  if (!text) return "";
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinkedInJobId(
  url: string,
  entityUrn: string | null
): string {
  // From URN: urn:li:jobPosting:1234567890
  if (entityUrn) {
    const id = entityUrn.split(":").pop();
    if (id) return `li-${id}`;
  }

  // From URL: linkedin.com/jobs/view/1234567890
  const urlMatch = url.match(/\/jobs\/view\/(\d+)/);
  if (urlMatch) return `li-${urlMatch[1]}`;

  // Fallback
  return `li-${url.replace(/[^a-zA-Z0-9]/g, "").slice(-20)}`;
}

function cleanLinkedInUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove tracking params, keep clean job URL
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

// ---- LinkedIn Alert Parser (for manual paste) ----

export interface LinkedInAlertJob {
  title: string;
  company: string;
  location: string;
  link: string;
  postedAt?: string;
}

/**
 * Parse a pasted LinkedIn job alert email body.
 * Users can copy-paste the content of LinkedIn alert emails
 * and this function extracts individual job entries.
 *
 * LinkedIn alert emails have a repeating pattern:
 * - Job Title
 * - Company Name
 * - Location
 * - Link to job
 */
export function parseLinkedInAlertText(
  alertText: string
): LinkedInAlertJob[] {
  const jobs: LinkedInAlertJob[] = [];

  // LinkedIn alerts often have blocks like:
  // "Job Title\nCompany Name\nLocation\nhttps://www.linkedin.com/..."
  // Or HTML with structured sections

  // Try to find LinkedIn job URLs and work backwards
  const lines = alertText.split("\n").map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // If we find a LinkedIn job URL
    if (
      line.includes("linkedin.com/jobs") ||
      line.includes("linkedin.com/comm/jobs")
    ) {
      // Look backwards for title, company, location
      const link = extractUrlFromLine(line);
      if (!link) continue;

      // The 1-3 lines before a LinkedIn URL are usually title, company, location
      const contextLines: string[] = [];
      for (let j = Math.max(0, i - 4); j < i; j++) {
        const contextLine = lines[j];
        // Skip lines that are clearly not job info
        if (
          contextLine.length > 3 &&
          contextLine.length < 200 &&
          !contextLine.includes("http") &&
          !contextLine.includes("View job") &&
          !contextLine.includes("See all") &&
          !contextLine.includes("Unsubscribe")
        ) {
          contextLines.push(contextLine);
        }
      }

      if (contextLines.length >= 1) {
        jobs.push({
          title: contextLines[0],
          company: contextLines[1] || "Unknown Company",
          location: contextLines[2] || "",
          link,
          postedAt: undefined,
        });
      }
    }
  }

  return jobs;
}

/**
 * Convert parsed LinkedIn alert jobs into RawJobItems.
 */
export function linkedInAlertJobsToRaw(
  alertJobs: LinkedInAlertJob[]
): RawJobItem[] {
  const now = new Date().toISOString();
  return alertJobs.map((job) =>
    normalizeRawJob({
      source: "linkedin-alert",
      sourceJobId: extractLinkedInJobId(job.link, null),
      title: job.title,
      company: job.company,
      location: job.location,
      link: cleanLinkedInUrl(job.link),
      postedAt: job.postedAt,
      employmentType: detectEmploymentType(job.title, ""),
      remoteType: detectRemoteType(job.title, job.location, ""),
      description: undefined,
      fetchedAt: now,
    })
  );
}

function extractUrlFromLine(line: string): string | null {
  const urlMatch = line.match(/(https?:\/\/[^\s)<>"]+)/);
  return urlMatch ? urlMatch[1] : null;
}
