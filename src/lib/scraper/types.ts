// ============================================================
// Scraper type definitions.
// Unified interface for all scraping backends.
// ============================================================

export type ScraperBackend = "cheerio" | "firecrawl" | "playwright";

export interface ScrapeRequest {
  url: string;
  /** Which backend to use. Auto-selects if not specified. */
  backend?: ScraperBackend;
  /** Wait for JS rendering (only applies to playwright) */
  waitForJs?: boolean;
  /** CSS selector to wait for before extracting (playwright only) */
  waitForSelector?: string;
  /** Max time to wait for page load in ms */
  timeoutMs?: number;
  /** Extract only content within this CSS selector */
  contentSelector?: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** If true, also extract all links */
  extractLinks?: boolean;
}

export interface ScrapeResult {
  success: boolean;
  url: string;
  backend: ScraperBackend;
  /** Raw HTML of the page */
  html?: string;
  /** Cleaned plain text content */
  text?: string;
  /** Page title */
  title?: string;
  /** Extracted metadata */
  metadata?: {
    description?: string;
    ogTitle?: string;
    ogDescription?: string;
    canonical?: string;
    [key: string]: string | undefined;
  };
  /** Extracted links */
  links?: Array<{ href: string; text: string }>;
  /** Duration of the scrape */
  durationMs: number;
  /** Error message if failed */
  error?: string;
}

export interface ScrapedJobData {
  title: string;
  company: string;
  location: string;
  description: string;
  salaryText?: string;
  employmentType?: string;
  remoteType?: string;
  postedAt?: string;
  applyUrl?: string;
  requirements?: string[];
  benefits?: string[];
  sourceUrl: string;
  confidence: number;
}

export interface ScraperConfig {
  /** Default backend to use */
  defaultBackend: ScraperBackend;
  /** Firecrawl configuration */
  firecrawl: {
    enabled: boolean;
    /** URL of self-hosted Firecrawl or cloud API */
    baseUrl: string;
    /** API key (for cloud Firecrawl, empty for self-hosted) */
    apiKey: string;
  };
  /** Playwright configuration */
  playwright: {
    enabled: boolean;
    /** Headless mode */
    headless: boolean;
    /** Default timeout ms */
    timeoutMs: number;
  };
  /** Rate limiting */
  rateLimit: {
    /** Min delay between scrapes in ms */
    minDelayMs: number;
    /** Max concurrent scrapes */
    maxConcurrent: number;
    /** Max scrapes per hour */
    maxPerHour: number;
  };
  /** Domains to never scrape (respect robots.txt spirit) */
  blockedDomains: string[];
}