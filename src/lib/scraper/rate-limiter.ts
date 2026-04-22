// ============================================================
// Scraper rate limiter.
// Tracks scrape history and enforces polite crawling.
// ============================================================

import { loadScraperConfig } from "./config";

interface ScrapeRecord {
  url: string;
  domain: string;
  timestamp: number;
}

// In-memory scrape history (resets on server restart — fine for local)
const scrapeHistory: ScrapeRecord[] = [];
let activeScrapes = 0;

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export async function checkScrapeAllowed(
  url: string
): Promise<{ allowed: boolean; reason?: string; waitMs?: number }> {
  const config = await loadScraperConfig();
  const domain = getDomain(url);

  // Check blocked domains
  if (config.blockedDomains.some((d) => domain.includes(d))) {
    return { allowed: false, reason: `Domain ${domain} is blocked` };
  }

  // Check concurrent limit
  if (activeScrapes >= config.rateLimit.maxConcurrent) {
    return {
      allowed: false,
      reason: `Max concurrent scrapes reached (${config.rateLimit.maxConcurrent})`,
      waitMs: 2000,
    };
  }

  // Check hourly limit
  const oneHourAgo = Date.now() - 3600_000;
  const recentCount = scrapeHistory.filter(
    (r) => r.timestamp > oneHourAgo
  ).length;
  if (recentCount >= config.rateLimit.maxPerHour) {
    return {
      allowed: false,
      reason: `Hourly scrape limit reached (${config.rateLimit.maxPerHour})`,
    };
  }

  // Check min delay for same domain
  const lastSameDomain = scrapeHistory
    .filter((r) => r.domain === domain)
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  if (lastSameDomain) {
    const elapsed = Date.now() - lastSameDomain.timestamp;
    if (elapsed < config.rateLimit.minDelayMs) {
      const waitMs = config.rateLimit.minDelayMs - elapsed;
      return {
        allowed: false,
        reason: `Rate limit: wait ${waitMs}ms for ${domain}`,
        waitMs,
      };
    }
  }

  return { allowed: true };
}

export function recordScrape(url: string): void {
  scrapeHistory.push({
    url,
    domain: getDomain(url),
    timestamp: Date.now(),
  });

  // Prune old entries (keep last 2 hours)
  const twoHoursAgo = Date.now() - 7200_000;
  const pruneIndex = scrapeHistory.findIndex(
    (r) => r.timestamp > twoHoursAgo
  );
  if (pruneIndex > 0) {
    scrapeHistory.splice(0, pruneIndex);
  }
}

export function incrementActive(): void {
  activeScrapes++;
}

export function decrementActive(): void {
  activeScrapes = Math.max(0, activeScrapes - 1);
}