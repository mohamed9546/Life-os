// ============================================================
// Guardian Jobs adapter — UK-focused jobs board.
// Free RSS feed, no auth required.
// ============================================================

import { RawJobItem } from "@/types";
import { getAppConfig } from "@/lib/config/app-config";
import {
  JobSourceAdapter,
  JobSearchQuery,
  JobSourceResult,
} from "./types";
import { normalizeRawJob, detectEmploymentType, detectRemoteType } from "./normalize";

export class GuardianJobsAdapter implements JobSourceAdapter {
  readonly sourceId = "guardianjobs";
  readonly displayName = "Guardian Jobs (UK)";

  async isConfigured(): Promise<boolean> {
    const config = await getAppConfig();
    return Boolean(config.jobSources.guardianjobs?.enabled);
  }

  async fetchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const now = new Date().toISOString();

    try {
      const keywords = query.keywords.join(" ");
      const location = query.location || "United Kingdom";
      const params = new URLSearchParams({
        countrycode: "GB",
      });

      if (keywords.trim()) {
        params.set("keywords", keywords);
      }

      const url = `https://jobs.theguardian.com/jobsrss/?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          Accept: "application/rss+xml, text/xml",
          "User-Agent": "LifeOS/1.0 Job Aggregator",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`Guardian Jobs RSS returned ${response.status}`);
      }

      const xml = await response.text();
      const items = parseRSSItems(xml);
      const maxResults = query.maxResults || 30;
      const limited = items
        .filter((item) => matchesGuardianQuery(item, query))
        .slice(0, maxResults);

      const jobs: RawJobItem[] = limited.map((item) =>
        normalizeRawJob({
          source: this.sourceId,
          sourceJobId: `guardian-${item.guid.replace(/[^a-zA-Z0-9]/g, "").slice(-20)}`,
          title: item.jobTitle,
          company: item.company || "Unknown",
          location: item.location || location,
          link: item.link,
          postedAt: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
          salaryText: item.salary || undefined,
          employmentType: detectEmploymentType(item.jobTitle, item.description),
          remoteType: detectRemoteType(item.jobTitle, item.location, item.description),
          description: item.description,
          raw: item,
          fetchedAt: now,
        })
      );

      return { source: this.sourceId, jobs, totalAvailable: items.length, fetchedAt: now, query };
    } catch (err) {
      return {
        source: this.sourceId,
        jobs: [],
        totalAvailable: 0,
        fetchedAt: now,
        query,
        error: err instanceof Error ? err.message : "Guardian Jobs fetch failed",
      };
    }
  }
}

interface RSSItem {
  title: string;
  jobTitle: string;
  company: string;
  location: string;
  link: string;
  description: string;
  salary: string;
  pubDate: string;
  guid: string;
}

function parseRSSItems(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const chunk = m[1];
    const title = extractText(chunk, "title");
    const rawDescription = extractCDATA(chunk, "description") || extractText(chunk, "description");
    const summary = parseGuardianDescription(rawDescription);
    const description = stripHtml(rawDescription);
    const splitTitle = splitGuardianTitle(title);
    items.push({
      title,
      jobTitle: splitTitle.jobTitle,
      company: splitTitle.company || summary.company,
      location: summary.location,
      link: extractText(chunk, "link"),
      description,
      salary: summary.salary,
      pubDate: extractText(chunk, "pubDate"),
      guid: extractText(chunk, "guid"),
    });
  }
  return items.filter((i) => i.jobTitle && i.link);
}

function splitGuardianTitle(value: string): { company: string; jobTitle: string } {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex > 0 && separatorIndex < value.length - 1) {
    return {
      company: value.slice(0, separatorIndex).trim(),
      jobTitle: value.slice(separatorIndex + 1).trim(),
    };
  }

  return { company: "", jobTitle: value.trim() };
}

function parseGuardianDescription(value: string): {
  salary: string;
  company: string;
  location: string;
} {
  const lines = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    salary: lines[0] || "",
    company: lines[1]?.replace(/:$/, "") || "",
    location: lines[lines.length - 1] || "",
  };
}

function matchesGuardianQuery(item: RSSItem, query: JobSearchQuery): boolean {
  const haystack = [
    item.jobTitle,
    item.company,
    item.location,
    item.description,
  ]
    .join(" ")
    .toLowerCase();

  const keywords = query.keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean);
  if (keywords.length > 0 && !keywords.some((keyword) => haystack.includes(keyword))) {
    return false;
  }

  if (query.location) {
    const location = query.location.toLowerCase();
    const itemLocation = item.location.toLowerCase();
    if (itemLocation && !matchesGuardianLocation(itemLocation, location)) {
      return false;
    }
  }

  return true;
}

function matchesGuardianLocation(itemLocation: string, requestedLocation: string): boolean {
  if (["uk", "united kingdom", "great britain", "england"].includes(requestedLocation)) {
    return true;
  }

  if (requestedLocation === "scotland") {
    return /scotland|glasgow|edinburgh|aberdeen|dundee|stirling|perth\b/.test(itemLocation);
  }

  return (
    itemLocation.includes(requestedLocation) ||
    itemLocation.includes("uk") ||
    itemLocation.includes("united kingdom") ||
    itemLocation.includes("remote") ||
    itemLocation.includes("hybrid")
  );
}

function extractText(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, "i"));
  return m ? m[1].trim() : "";
}

function extractCDATA(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, "i"));
  return m ? m[1].trim() : "";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
