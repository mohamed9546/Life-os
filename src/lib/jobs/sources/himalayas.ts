// ============================================================
// Himalayas job source adapter.
// Free remote-first job board API.
//
// Himalayas has shipped at least three response shapes over
// time ({jobs}, {results}, {data}). This adapter resolves
// fields defensively and skips malformed entries.
// ============================================================

import { RawJobItem } from "@/types";
import {
  JobSourceAdapter,
  JobSearchQuery,
  JobSourceResult,
} from "./types";
import {
  normalizeRawJob,
  detectEmploymentType,
} from "./normalize";

// Every field optional — resolved at runtime.
interface HimalayasJob {
  id?: string;
  guid?: string;
  title?: string;
  name?: string;
  excerpt?: string;
  description?: string;
  body?: string;
  url?: string;
  applicationUrl?: string;
  applicationLink?: string;
  jobUrl?: string;
  jobSlug?: string;
  slug?: string;
  publishedDate?: string;
  postedDate?: string;
  createdAt?: string;
  updatedDate?: string;
  companyName?: string;
  company?: string | { name?: string };
  categories?: string[];
  tags?: string[];
  locationRestrictions?: string[];
  countries?: string[];
  seniority?: string[];
  salary?: {
    min?: number | null;
    max?: number | null;
    currency?: string | null;
    period?: string | null;
  } | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  jobType?: string;
  employmentType?: string;
}

interface HimalayasResponse {
  jobs?: HimalayasJob[];
  data?: HimalayasJob[];
  results?: HimalayasJob[];
  total_count?: number;
  total?: number;
  offset?: number;
  limit?: number;
}

export class HimalayasAdapter implements JobSourceAdapter {
  readonly sourceId = "himalayas";
  readonly displayName = "Himalayas (Remote)";

  async isConfigured(): Promise<boolean> {
    return true;
  }

  async fetchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const now = new Date().toISOString();

    try {
      const limit = Math.min(query.maxResults || 50, 50);
      const offset =
        query.page && query.page > 1 ? (query.page - 1) * limit : 0;

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (query.keywords.length > 0) {
        params.set("q", query.keywords.join(" "));
      }

      const url = `https://himalayas.app/jobs/api?${params.toString()}`;

      console.log(
        `[himalayas] Fetching: ${query.keywords.join(" ")} (offset ${offset})`
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
        throw new Error(`Himalayas API returned ${response.status}`);
      }

      const data = (await response.json()) as HimalayasResponse;

      // Resolve the list defensively — Himalayas has used {jobs},
      // {results}, and {data} at different times.
      const items: HimalayasJob[] =
        (Array.isArray(data.jobs) && data.jobs) ||
        (Array.isArray(data.results) && data.results) ||
        (Array.isArray(data.data) && data.data) ||
        [];

      const totalAvailable =
        (typeof data.total_count === "number" && data.total_count) ||
        (typeof data.total === "number" && data.total) ||
        items.length;

      if (items.length === 0) {
        return {
          source: this.sourceId,
          jobs: [],
          totalAvailable,
          fetchedAt: now,
          query,
        };
      }

      // Optional location filter — only applied when restrictions are readable.
      let filtered = items;
      if (query.location) {
        filtered = items.filter((job) => {
          const r = job.locationRestrictions || job.countries;
          if (!r || r.length === 0) return true; // worldwide
          const joined = r
            .map((x) => (typeof x === "string" ? x : ""))
            .join(" ")
            .toLowerCase();
          return (
            joined.includes("worldwide") ||
            joined.includes("anywhere") ||
            joined.includes("europe") ||
            joined.includes("uk") ||
            joined.includes("united kingdom") ||
            joined.includes("emea") ||
            joined.includes("britain")
          );
        });
      }

      const jobs: RawJobItem[] = [];
      let skippedNoLink = 0;
      let skippedNoTitle = 0;

      for (const hJob of filtered) {
        const title = safeString(hJob.title) || safeString(hJob.name);
        if (!title) {
          skippedNoTitle++;
          continue;
        }

        const link = resolveHimalayasLink(hJob);
        if (!link) {
          skippedNoLink++;
          continue;
        }

        const company = resolveHimalayasCompany(hJob);
        const rawDescription =
          safeString(hJob.body) ||
          safeString(hJob.description) ||
          safeString(hJob.excerpt);
        const plainDescription = stripHtml(rawDescription);

        const salaryText = formatHimalayasSalary(hJob);
        const locationStr = formatHimalayasLocation(
          hJob.locationRestrictions || hJob.countries
        );
        const postedAt =
          hJob.publishedDate || hJob.postedDate || hJob.createdAt;

        jobs.push(
          normalizeRawJob({
            source: this.sourceId,
            sourceJobId: hJob.id || hJob.guid || hJob.jobSlug || hJob.slug,
            title,
            company,
            location: locationStr,
            salaryText,
            link,
            postedAt,
            employmentType:
              mapHimalayasJobType(hJob.jobType || hJob.employmentType) ||
              detectEmploymentType(title, plainDescription),
            remoteType: "remote",
            description: plainDescription,
            raw: hJob,
            fetchedAt: now,
          })
        );
      }

      const skipped = skippedNoLink + skippedNoTitle;
      const skipNote =
        skipped > 0
          ? ` (skipped ${skipped}: ${skippedNoTitle} no-title, ${skippedNoLink} no-link)`
          : "";

      console.log(
        `[himalayas] Fetched ${jobs.length} jobs (${totalAvailable} total)${skipNote}`
      );

      return {
        source: this.sourceId,
        jobs,
        totalAvailable,
        fetchedAt: now,
        query,
        pageInfo: {
          page: query.page || 1,
          perPage: limit,
          hasMore: offset + limit < totalAvailable,
        },
      };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown Himalayas error";
      console.error(`[himalayas] Fetch error:`, errorMsg);

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

function safeString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function resolveHimalayasLink(hJob: HimalayasJob): string {
  const direct =
    safeString(hJob.url) ||
    safeString(hJob.applicationUrl) ||
    safeString(hJob.applicationLink) ||
    safeString(hJob.jobUrl);
  if (direct) return direct;

  const slug = safeString(hJob.jobSlug) || safeString(hJob.slug);
  if (slug) return `https://himalayas.app/jobs/${slug}`;

  return "";
}

function resolveHimalayasCompany(hJob: HimalayasJob): string {
  const named = safeString(hJob.companyName);
  if (named) return named;

  const c = hJob.company;
  if (typeof c === "string") return c.trim() || "Unknown Company";
  if (c && typeof c === "object" && typeof c.name === "string") {
    return c.name.trim() || "Unknown Company";
  }
  return "Unknown Company";
}

function formatHimalayasSalary(hJob: HimalayasJob): string | undefined {
  const minVal = hJob.salary?.min ?? hJob.salaryMin ?? null;
  const maxVal = hJob.salary?.max ?? hJob.salaryMax ?? null;
  if (minVal == null && maxVal == null) return undefined;

  const currency = hJob.salary?.currency || "USD";
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
  const p = hJob.salary?.period;
  const period = p === "yearly" ? "/yr" : p ? `/${p}` : "";

  if (minVal != null && maxVal != null && minVal !== maxVal) {
    return `${symbol}${minVal.toLocaleString()} - ${symbol}${maxVal.toLocaleString()}${period}`;
  }
  if (minVal != null) return `From ${symbol}${minVal.toLocaleString()}${period}`;
  if (maxVal != null) return `Up to ${symbol}${maxVal.toLocaleString()}${period}`;
  return undefined;
}

function formatHimalayasLocation(restrictions?: string[]): string {
  if (!restrictions || restrictions.length === 0) return "Remote (Worldwide)";
  const cleaned = restrictions.filter(
    (r): r is string => typeof r === "string" && r.length > 0
  );
  if (cleaned.length === 0) return "Remote (Worldwide)";
  if (cleaned.length <= 3) return `Remote (${cleaned.join(", ")})`;
  return `Remote (${cleaned.slice(0, 3).join(", ")}+)`;
}

function mapHimalayasJobType(type?: string): string | undefined {
  if (!type) return undefined;
  switch (type.toLowerCase()) {
    case "full_time":
    case "full-time":
    case "fulltime":
    case "part_time":
    case "part-time":
    case "parttime":
      return "permanent";
    case "contract":
    case "freelance":
      return "contract";
    case "internship":
      return "temp";
    default:
      return undefined;
  }
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