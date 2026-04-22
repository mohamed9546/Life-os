// ============================================================
// Unified scraper interface.
// Auto-selects the best backend based on configuration
// and the target URL.
// ============================================================

import {
  ScrapeRequest,
  ScrapeResult,
  ScrapedJobData,
  ScraperBackend,
} from "./types";
import { loadScraperConfig } from "./config";
import { scrapeWithCheerio, extractJobLinksFromPage } from "./cheerio-scraper";
import { scrapeWithFirecrawl, checkFirecrawlHealth, crawlJobSite } from "./firecrawl-client";
import { scrapeWithPlaywright } from "./playwright-scraper";
import {
  extractJobFromScrape,
  extractJobListFromScrape,
  scrapedJobToRawItem,
} from "./ai-extractor";
import {
  checkScrapeAllowed,
  recordScrape,
  incrementActive,
  decrementActive,
} from "./rate-limiter";
import { RawJobItem } from "@/types";

export type { ScrapeRequest, ScrapeResult, ScrapedJobData, ScraperBackend } from "./types";

// ---- Smart backend selection ----

/**
 * Determine which domains/patterns need JS rendering.
 */
const JS_HEAVY_DOMAINS = [
  "linkedin.com",
  "glassdoor.com",
  "workday.com",
  "lever.co",
  "greenhouse.io",
  "myworkdayjobs.com",
  "icims.com",
  "smartrecruiters.com",
  "ultipro.com",
];

function selectBackend(url: string, config: Awaited<ReturnType<typeof loadScraperConfig>>): ScraperBackend {
  const domain = new URL(url).hostname.replace("www.", "");

  // If Firecrawl is available, prefer it for JS-heavy sites
  if (
    config.firecrawl.enabled &&
    JS_HEAVY_DOMAINS.some((d) => domain.includes(d))
  ) {
    return "firecrawl";
  }

  // If Playwright is available and site needs JS
  if (
    config.playwright.enabled &&
    JS_HEAVY_DOMAINS.some((d) => domain.includes(d))
  ) {
    return "playwright";
  }

  // Default to cheerio (fastest, lightest)
  return "cheerio";
}

// ---- Main scrape function ----

/**
 * Scrape a URL using the best available backend.
 * Handles rate limiting, backend selection, and error recovery.
 */
export async function scrape(request: ScrapeRequest): Promise<ScrapeResult> {
  // Check rate limits
  const rateCheck = await checkScrapeAllowed(request.url);
  if (!rateCheck.allowed) {
    // If rate limited with a wait suggestion, wait and retry once
    if (rateCheck.waitMs && rateCheck.waitMs < 10_000) {
      await new Promise((r) => setTimeout(r, rateCheck.waitMs));
      const recheck = await checkScrapeAllowed(request.url);
      if (!recheck.allowed) {
        return {
          success: false,
          url: request.url,
          backend: "cheerio",
          durationMs: 0,
          error: recheck.reason || "Rate limited",
        };
      }
    } else {
      return {
        success: false,
        url: request.url,
        backend: "cheerio",
        durationMs: 0,
        error: rateCheck.reason || "Rate limited",
      };
    }
  }

  const config = await loadScraperConfig();
  const backend = request.backend || selectBackend(request.url, config);

  incrementActive();

  try {
    let result: ScrapeResult;

    switch (backend) {
      case "firecrawl":
        result = await scrapeWithFirecrawl(request);
        // Fall back to cheerio if firecrawl fails
        if (!result.success) {
          console.warn(
            `[scraper] Firecrawl failed, falling back to cheerio: ${result.error}`
          );
          result = await scrapeWithCheerio(request);
        }
        break;

      case "playwright":
        result = await scrapeWithPlaywright(request);
        // Fall back to cheerio if playwright fails
        if (!result.success) {
          if (!result.error?.includes("not enabled") && !result.error?.includes("not installed")) {
            console.warn(`[scraper] Playwright failed, falling back to cheerio: ${result.error}`);
          } else {
            console.debug(`[scraper] Playwright unavailable, using cheerio: ${result.error}`);
          }
          result = await scrapeWithCheerio(request);
        }
        break;

      case "cheerio":
      default:
        result = await scrapeWithCheerio(request);
        break;
    }

    recordScrape(request.url);
    return result;
  } finally {
    decrementActive();
  }
}

// ---- High-level job scraping functions ----

/**
 * Scrape a single job page URL and extract structured job data.
 * One URL → one structured job.
 */
export async function scrapeJobPage(
  url: string
): Promise<{ job: RawJobItem | null; scraped: ScrapedJobData | null; error?: string }> {
  const result = await scrape({ url });

  if (!result.success) {
    return { job: null, scraped: null, error: result.error };
  }

  const jobData = await extractJobFromScrape(result);

  if (!jobData) {
    return {
      job: null,
      scraped: null,
      error: "Could not extract job data from page",
    };
  }

  const rawJob = scrapedJobToRawItem(jobData);

  return { job: rawJob, scraped: jobData };
}

/**
 * Scrape a careers page / job board and extract all job listings.
 * One URL → many jobs.
 */
export async function scrapeJobBoard(
  url: string
): Promise<{
  jobs: RawJobItem[];
  total: number;
  error?: string;
}> {
  const result = await scrape({ url, extractLinks: true });

  if (!result.success) {
    return { jobs: [], total: 0, error: result.error };
  }

  // Method 1: Try AI extraction of job list from page content
  const aiJobs = await extractJobListFromScrape(result);

  if (aiJobs.length > 0) {
    const rawJobs = aiJobs.map((j) =>
      scrapedJobToRawItem({
        title: j.title,
        company: j.company,
        location: j.location,
        description: j.description,
        salaryText: j.salaryText,
        sourceUrl: j.link || url,
        confidence: j.confidence,
      })
    );
    return { jobs: rawJobs, total: rawJobs.length };
  }

  // Method 2: Extract job links and scrape individually
  const jobLinks = await extractJobLinksFromPage(url);
  if (jobLinks.length === 0) {
    return { jobs: [], total: 0, error: "No job listings found on page" };
  }

  // Scrape first 10 job links (to avoid overwhelming)
  const limitedLinks = jobLinks.slice(0, 10);
  const jobs: RawJobItem[] = [];

  for (const link of limitedLinks) {
    try {
      const { job } = await scrapeJobPage(link.href);
      if (job) jobs.push(job);
    } catch (err) {
      console.warn(`[scraper] Failed to scrape ${link.href}:`, err);
    }
  }

  return { jobs, total: jobLinks.length };
}

/**
 * Crawl an entire company career site using Firecrawl.
 * Discovers and extracts all job listings.
 */
export async function crawlCareerSite(
  baseUrl: string,
  maxPages?: number
): Promise<{
  jobs: RawJobItem[];
  pagesScraped: number;
  error?: string;
}> {
  const pages = await crawlJobSite(baseUrl, {
    maxPages: maxPages || 50,
    includePattern: "/(jobs|careers|positions|openings|vacancies)/",
  });

  if (!pages.success) {
    return { jobs: [], pagesScraped: 0, error: pages.error };
  }

  const allJobs: RawJobItem[] = [];

  for (const page of pages.pages) {
    const scrapeResult: ScrapeResult = {
      success: true,
      url: page.url,
      backend: "firecrawl",
      text: page.content,
      durationMs: 0,
    };

    const jobData = await extractJobFromScrape(scrapeResult);
    if (jobData) {
      allJobs.push(scrapedJobToRawItem(jobData));
    }
  }

  return {
    jobs: allJobs,
    pagesScraped: pages.pages.length,
  };
}

// Re-exports
export { checkFirecrawlHealth } from "./firecrawl-client";
export { extractJobLinksFromPage } from "./cheerio-scraper";
export { extractJobFromScrape, extractJobListFromScrape, scrapedJobToRawItem } from "./ai-extractor";