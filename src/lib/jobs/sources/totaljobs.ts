// ============================================================
// Totaljobs adapter.
// Free public result-page fetcher. Totaljobs embeds the first page
// of results in window.__PRELOADED_STATE__, so we parse that state
// rather than driving a browser.
// ============================================================

import { RawJobItem } from "@/types";
import { getAppConfig } from "@/lib/config/app-config";
import {
  JobSearchQuery,
  JobSourceAdapter,
  JobSourceResult,
} from "./types";
import {
  detectEmploymentType,
  detectRemoteType,
  normalizeRawJob,
} from "./normalize";

interface TotaljobsListing {
  id?: string | number;
  title?: string;
  url?: string;
  companyName?: string;
  location?: string;
  salary?: string;
  datePosted?: string;
  periodPostedDate?: string;
  textSnippet?: string;
  workFromHome?: string;
}

export class TotaljobsAdapter implements JobSourceAdapter {
  readonly sourceId = "totaljobs";
  readonly displayName = "Totaljobs";

  async isConfigured(): Promise<boolean> {
    const config = await getAppConfig();
    return Boolean(config.jobSources.totaljobs?.enabled);
  }

  async fetchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const now = new Date().toISOString();

    try {
      const url = buildSearchUrl(query);
      const response = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "LifeOS/1.0 Job Aggregator",
        },
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        throw new Error(`Totaljobs returned ${response.status}`);
      }

      const html = await response.text();
      const state = extractPreloadedState(html);
      const listings = findListings(state).slice(0, query.maxResults || 25);

      const jobs = listings
        .map((listing) => toRawJob(listing, now))
        .filter((job): job is RawJobItem => Boolean(job));

      return {
        source: this.sourceId,
        jobs,
        totalAvailable: jobs.length,
        fetchedAt: now,
        query,
      };
    } catch (err) {
      return {
        source: this.sourceId,
        jobs: [],
        totalAvailable: 0,
        fetchedAt: now,
        query,
        error: err instanceof Error ? err.message : "Totaljobs fetch failed",
      };
    }
  }
}

function buildSearchUrl(query: JobSearchQuery): string {
  const keywords = slug(query.keywords.join(" "));
  const location = slug(query.location || "United Kingdom");
  return `https://www.totaljobs.com/jobs/${keywords}/in-${location}?sort=2`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "all";
}

function extractPreloadedState(html: string): unknown {
  const marker = 'window.__PRELOADED_STATE__["app-unifiedResultlist"] = ';
  const start = html.indexOf(marker);
  if (start < 0) {
    throw new Error("Totaljobs result state not found");
  }

  const jsonStart = html.indexOf("{", start + marker.length);
  if (jsonStart < 0) {
    throw new Error("Totaljobs result JSON not found");
  }

  const jsonText = readBalancedJson(html, jsonStart);
  return JSON.parse(jsonText);
}

function readBalancedJson(text: string, start: number): string {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  throw new Error("Totaljobs result JSON was incomplete");
}

function findListings(value: unknown): TotaljobsListing[] {
  const results: TotaljobsListing[] = [];
  const seen = new Set<string>();

  function visit(node: unknown) {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      const candidateListings = node.filter(isListing);
      if (candidateListings.length >= 3) {
        for (const listing of candidateListings) {
          const key = String(listing.id || listing.url || listing.title);
          if (!seen.has(key)) {
            seen.add(key);
            results.push(listing);
          }
        }
      }
      node.forEach(visit);
      return;
    }

    Object.values(node).forEach(visit);
  }

  visit(value);
  return results;
}

function isListing(value: unknown): value is TotaljobsListing {
  if (!value || typeof value !== "object") return false;
  const item = value as TotaljobsListing;
  return Boolean(item.title && item.url && (item.companyName || item.location));
}

function toRawJob(listing: TotaljobsListing, fetchedAt: string): RawJobItem | null {
  if (!listing.title || !listing.url) return null;
  const description = stripHtml(listing.textSnippet || "");
  const link = listing.url.startsWith("http")
    ? listing.url
    : `https://www.totaljobs.com${listing.url}`;

  return normalizeRawJob({
    source: "totaljobs",
    sourceJobId: `totaljobs-${listing.id || listing.url}`,
    title: listing.title,
    company: listing.companyName || "Unknown company",
    location: listing.location || "",
    salaryText: listing.salary || undefined,
    link,
    postedAt: parseDate(listing.datePosted || listing.periodPostedDate),
    employmentType: detectEmploymentType(listing.title, description),
    remoteType: detectRemoteType(
      listing.title,
      listing.location || "",
      `${description} ${listing.workFromHome || ""}`
    ),
    description,
    raw: listing,
    fetchedAt,
  });
}

function parseDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function stripHtml(value: string): string {
  return value
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
