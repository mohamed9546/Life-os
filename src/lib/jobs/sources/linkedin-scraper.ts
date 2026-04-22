// ============================================================
// LinkedIn individual job page scraper.
// Fetches a single public LinkedIn job page and extracts
// the full description and metadata.
// Used as a secondary step after finding jobs via search/alerts.
//
// This ONLY accesses publicly-visible job pages that anyone
// can view without logging in.
// ============================================================

import { RawJobItem } from "@/types";
import { normalizeRawJob, detectRemoteType, detectEmploymentType } from "./normalize";

export interface LinkedInJobDetail {
  title: string;
  company: string;
  location: string;
  description: string;
  employmentType: string;
  seniority: string;
  industry: string;
  salary?: string;
  postedAt?: string;
  applicants?: string;
}

/**
 * Fetch and parse a single LinkedIn job page.
 * Works on public/guest-accessible job listings.
 */
export async function fetchLinkedInJobDetail(
  jobUrl: string
): Promise<LinkedInJobDetail | null> {
  try {
    // Clean the URL to the base job view
    const cleanUrl = jobUrl.replace(/\?.*$/, "");

    console.log(`[linkedin-scraper] Fetching job detail: ${cleanUrl}`);

    const response = await fetch(cleanUrl, {
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
      console.warn(
        `[linkedin-scraper] Job page returned ${response.status}`
      );
      return null;
    }

    const html = await response.text();
    return parseLinkedInJobPage(html);
  } catch (err) {
    console.error(
      `[linkedin-scraper] Error:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Parse a LinkedIn job page HTML to extract structured data.
 * LinkedIn embeds JSON-LD structured data in public job pages.
 */
function parseLinkedInJobPage(html: string): LinkedInJobDetail | null {
  // Method 1: Extract JSON-LD structured data (most reliable)
  const jsonLd = extractJsonLd(html);
  if (jsonLd) {
    return {
      title: jsonLd.title || "",
      company: jsonLd.hiringOrganization?.name || "",
      location:
        jsonLd.jobLocation?.address?.addressLocality ||
        jsonLd.jobLocation?.address?.addressRegion ||
        "",
      description: stripHtml(jsonLd.description || ""),
      employmentType: jsonLd.employmentType || "",
      seniority: extractFromHtml(
        html,
        /Seniority level[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i
      ),
      industry: extractFromHtml(
        html,
        /Industries[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i
      ),
      salary: jsonLd.baseSalary
        ? formatJsonLdSalary(jsonLd.baseSalary)
        : undefined,
      postedAt: jsonLd.datePosted,
      applicants: extractFromHtml(
        html,
        /(\d+\s*applicants?)/i
      ),
    };
  }

  // Method 2: Fall back to HTML parsing
  const title = extractFromHtml(
    html,
    /class="[^"]*top-card-layout__title[^"]*"[^>]*>([\s\S]*?)<\//i
  );
  const company = extractFromHtml(
    html,
    /class="[^"]*topcard__org-name-link[^"]*"[^>]*>([\s\S]*?)<\//i
  );
  const location = extractFromHtml(
    html,
    /class="[^"]*topcard__flavor--bullet[^"]*"[^>]*>([\s\S]*?)<\//i
  );
  const description = extractFromHtml(
    html,
    /class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/i
  );

  if (!title) return null;

  return {
    title: cleanText(title),
    company: cleanText(company),
    location: cleanText(location),
    description: stripHtml(description || ""),
    employmentType: "",
    seniority: "",
    industry: "",
  };
}

// ---- JSON-LD extraction ----

interface JobPostingJsonLd {
  title?: string;
  description?: string;
  datePosted?: string;
  employmentType?: string;
  hiringOrganization?: {
    name?: string;
  };
  jobLocation?: {
    address?: {
      addressLocality?: string;
      addressRegion?: string;
      addressCountry?: string;
    };
  };
  baseSalary?: {
    value?: {
      minValue?: number;
      maxValue?: number;
      unitText?: string;
    };
    currency?: string;
  };
}

function extractJsonLd(html: string): JobPostingJsonLd | null {
  // Find all JSON-LD script blocks
  const jsonLdRegex =
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);

      // Handle both direct objects and arrays
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (
          item["@type"] === "JobPosting" ||
          item.title ||
          item.hiringOrganization
        ) {
          return item as JobPostingJsonLd;
        }
      }
    } catch {
      // Skip invalid JSON-LD
    }
  }

  return null;
}

function formatJsonLdSalary(baseSalary: JobPostingJsonLd["baseSalary"]): string | undefined {
  if (!baseSalary?.value) return undefined;
  const { minValue, maxValue, unitText } = baseSalary.value;
  const currency = baseSalary.currency || "GBP";
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
  const period = unitText ? `/${unitText.toLowerCase()}` : "";

  if (minValue && maxValue) {
    return `${symbol}${minValue.toLocaleString()} - ${symbol}${maxValue.toLocaleString()}${period}`;
  }
  if (minValue) return `From ${symbol}${minValue.toLocaleString()}${period}`;
  if (maxValue) return `Up to ${symbol}${maxValue.toLocaleString()}${period}`;
  return undefined;
}

// ---- Helpers ----

function extractFromHtml(html: string, regex: RegExp): string {
  const match = html.match(regex);
  return match ? match[1].trim() : "";
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

/**
 * Convert a fetched LinkedIn job detail into a RawJobItem.
 */
export function linkedInDetailToRawJob(
  detail: LinkedInJobDetail,
  jobUrl: string
): RawJobItem {
  return normalizeRawJob({
    source: "linkedin",
    sourceJobId: extractJobIdFromUrl(jobUrl),
    title: detail.title,
    company: detail.company,
    location: detail.location,
    salaryText: detail.salary,
    link: jobUrl,
    postedAt: detail.postedAt,
    employmentType: detectEmploymentType(detail.title, detail.description),
    remoteType: detectRemoteType(
      detail.title,
      detail.location,
      detail.description
    ),
    description: detail.description,
    raw: detail,
    fetchedAt: new Date().toISOString(),
  });
}

function extractJobIdFromUrl(url: string): string {
  const match = url.match(/\/jobs\/view\/(\d+)/);
  return match ? `li-${match[1]}` : `li-${Date.now()}`;
}