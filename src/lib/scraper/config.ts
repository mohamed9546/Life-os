// ============================================================
// Scraper configuration with sensible defaults.
// ============================================================

import { ScraperConfig } from "./types";
import { readObject, ConfigFiles } from "@/lib/storage";
import { AppConfig } from "@/types";

export const DEFAULT_SCRAPER_CONFIG: ScraperConfig = {
  defaultBackend: "cheerio",
  firecrawl: {
    enabled: false,
    baseUrl: process.env.FIRECRAWL_BASE_URL || (process.env.NODE_ENV === "production" ? "https://api.firecrawl.com" : "http://localhost:3002"),
    apiKey: "",
  },
  playwright: {
    enabled: false,
    headless: true,
    timeoutMs: 30_000,
  },
  rateLimit: {
    minDelayMs: 2000, // 2 seconds between scrapes
    maxConcurrent: 2,
    maxPerHour: 60,
  },
  // Domains we should not scrape aggressively
  blockedDomains: [
    "facebook.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "tiktok.com",
  ],
};

export async function loadScraperConfig(): Promise<ScraperConfig> {
  const appConfig = await readObject<AppConfig>(ConfigFiles.APP_CONFIG);
  
  // Scraper config is stored as an extra field not in the strict AppConfig type
  const scraperConf = appConfig 
    ? (appConfig as unknown as Record<string, unknown>)?.scraper 
    : undefined;

  if (!scraperConf || typeof scraperConf !== "object") {
    return { ...DEFAULT_SCRAPER_CONFIG };
  }

  const conf = scraperConf as Partial<ScraperConfig>;
  return {
    defaultBackend: conf.defaultBackend || DEFAULT_SCRAPER_CONFIG.defaultBackend,
    firecrawl: {
      ...DEFAULT_SCRAPER_CONFIG.firecrawl,
      ...(conf.firecrawl || {}),
    },
    playwright: {
      ...DEFAULT_SCRAPER_CONFIG.playwright,
      ...(conf.playwright || {}),
    },
    rateLimit: {
      ...DEFAULT_SCRAPER_CONFIG.rateLimit,
      ...(conf.rateLimit || {}),
    },
    blockedDomains:
      conf.blockedDomains || DEFAULT_SCRAPER_CONFIG.blockedDomains,
  };
}