import { RawJobItem } from "@/types";
import { getAppConfig } from "@/lib/config/app-config";
import { scrape } from "@/lib/scraper";
import {
  JobSourceAdapter,
  JobSearchQuery,
  JobSourceResult,
} from "./types";
import {
  normalizeRawJob,
  detectEmploymentType,
  detectRemoteType,
} from "./normalize";

const BRIGHT_NETWORK_URL = "https://www.brightnetwork.co.uk/browse/graduate-jobs/";
const BRIGHT_NETWORK_HOST = "brightnetwork.co.uk";

export class BrightNetworkAdapter implements JobSourceAdapter {
  readonly sourceId = "brightnetwork";
  readonly displayName = "Bright Network";

  private async getConfig() {
    const appConfig = await getAppConfig();
    return appConfig.jobSources.brightnetwork;
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
        error: "Bright Network adapter is disabled in Settings.",
      };
    }

    try {
      const scrapeResult = await scrape({
        url: BRIGHT_NETWORK_URL,
        backend: "playwright",
        waitForJs: true,
        extractLinks: true,
        timeoutMs: 45_000,
      });

      if (!scrapeResult.success) {
        return {
          source: this.sourceId,
          jobs: [],
          totalAvailable: 0,
          fetchedAt: now,
          query,
          error: scrapeResult.error || "Bright Network scrape failed",
        };
      }

      const challengeDetected = /just a moment|cloudflare/i.test(
        `${scrapeResult.title || ""} ${scrapeResult.text || ""}`
      );

      if (challengeDetected) {
        return {
          source: this.sourceId,
          jobs: [],
          totalAvailable: 0,
          fetchedAt: now,
          query,
          error:
            "Bright Network is returning a Cloudflare challenge to automated browsing right now, so this adapter is in guarded mode until that challenge can be solved locally.",
        };
      }

      const jobs = this.parseLinksToJobs(scrapeResult.links || [], query, now);

      return {
        source: this.sourceId,
        jobs,
        totalAvailable: jobs.length,
        fetchedAt: now,
        query,
        error:
          jobs.length === 0
            ? "Bright Network page loaded but no matching job links were extracted."
            : undefined,
      };
    } catch (err) {
      return {
        source: this.sourceId,
        jobs: [],
        totalAvailable: 0,
        fetchedAt: now,
        query,
        error: err instanceof Error ? err.message : "Bright Network scrape failed",
      };
    }
  }

  private parseLinksToJobs(
    links: Array<{ href: string; text: string }>,
    query: JobSearchQuery,
    fetchedAt: string
  ): RawJobItem[] {
    const keywords = query.keywords.map((keyword) => keyword.toLowerCase());
    const location = (query.location || "").toLowerCase();
    const seen = new Set<string>();
    const jobs: RawJobItem[] = [];

    for (const link of links) {
      const href = (link.href || "").trim();
      const text = (link.text || "").trim();

      if (!href || !href.includes(BRIGHT_NETWORK_HOST)) {
        continue;
      }

      if (!/graduate-jobs|experienced-hire-roles|immediate-start-roles/i.test(href)) {
        continue;
      }

      if (
        !/\/[a-z0-9-]+\/[a-z0-9-]+-\d{4}/i.test(href) &&
        !/graduate-jobs/i.test(href)
      ) {
        continue;
      }

      const normalizedHref = href.replace(/[?#].*$/, "").replace(/\/+$/, "");
      if (seen.has(normalizedHref)) {
        continue;
      }
      seen.add(normalizedHref);

      const slugText = decodeURIComponent(normalizedHref.split("/").pop() || "")
        .replace(/[-_]+/g, " ")
        .trim();
      const haystack = `${text} ${slugText}`.toLowerCase();

      if (keywords.length > 0 && !keywords.some((keyword) => haystack.includes(keyword))) {
        continue;
      }

      if (
        location &&
        !haystack.includes(location) &&
        !normalizedHref.toLowerCase().includes(location.replace(/\s+/g, "-")) &&
        location !== "united kingdom"
      ) {
        continue;
      }

      const parsed = inferTitleAndCompany(text || slugText);
      const inferredLocation = inferLocation(text, slugText, query.location);

      jobs.push(
        normalizeRawJob({
          source: this.sourceId,
          sourceJobId: `brightnetwork-${normalizedHref.split("/").pop()}`,
          title: parsed.title,
          company: parsed.company,
          location: inferredLocation,
          link: normalizedHref,
          employmentType: detectEmploymentType(parsed.title),
          remoteType: detectRemoteType(parsed.title, inferredLocation, text),
          description: text || slugText,
          raw: {
            href: normalizedHref,
            text,
            sourceUrl: BRIGHT_NETWORK_URL,
          },
          fetchedAt,
        })
      );

      if (jobs.length >= (query.maxResults || 20)) {
        break;
      }
    }

    return jobs;
  }
}

function inferTitleAndCompany(label: string): { title: string; company: string } {
  const cleaned = label.replace(/\s+/g, " ").trim();
  const parts = cleaned
    .split(/\s+[|@-]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      title: parts[0],
      company: parts[1],
    };
  }

  return {
    title: cleaned || "Bright Network role",
    company: "Bright Network employer",
  };
}

function inferLocation(label: string, slugText: string, fallback?: string): string {
  const combined = `${label} ${slugText}`.toLowerCase();
  const knownLocations = [
    "glasgow",
    "edinburgh",
    "london",
    "manchester",
    "cambridge",
    "oxford",
    "scotland",
    "united kingdom",
    "remote",
  ];

  const match = knownLocations.find((item) => combined.includes(item));
  if (!match) {
    return fallback || "United Kingdom";
  }

  if (match === "remote") {
    return "United Kingdom (Remote)";
  }

  return match
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
