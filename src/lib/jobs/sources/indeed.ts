// ============================================================
// Indeed job source adapter.
//
// ⚠️ DEPRECATED by the upstream: Indeed killed public RSS
// and actively blocks requests with 403/404/429 responses.
// There is no free path back. The adapter remains as a stub
// for completeness. Enable with INDEED_ENABLED=true at your
// own risk — you'll likely just get rate-limited errors.
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

interface RSSJobItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  guid: string;
}

export class IndeedAdapter implements JobSourceAdapter {
  readonly sourceId = "indeed";
  readonly displayName = "Indeed (guarded RSS)";

  private async getConfig() {
    const appConfig = await getAppConfig();
    return appConfig.jobSources.indeed;
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
        error: "Indeed adapter is disabled (RSS endpoint is blocked upstream)",
      };
    }

    try {
      const keywords = query.keywords.join("+");
      const params = new URLSearchParams({
        q: keywords,
        l: query.location || "United Kingdom",
        sort: "date",
        fromage: "14",
      });

      if (query.radius) params.set("radius", query.radius.toString());
      if (query.salaryMin) {
        params.set("q", `${keywords} £${query.salaryMin}+`);
      }

      const url = `https://uk.indeed.com/rss?${params.toString()}`;

      console.log(
        `[indeed] Fetching RSS: ${query.keywords.join(" ")} in ${query.location || "UK"}`
      );

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/rss+xml, application/xml, text/xml",
          "User-Agent": "LifeOS/1.0 Job Search Aggregator",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`Indeed RSS returned ${response.status}`);
      }

      const xmlText = await response.text();
      if (/Security Check|INDEED_CLOUDFLARE_STATIC_PAGE|Additional Verification Required/i.test(xmlText)) {
        throw new Error(
          "Indeed returned an anti-bot/security-check page, so direct free fetching is unavailable for this run."
        );
      }

      const rssItems = parseRSSItems(xmlText);

      const maxResults = query.maxResults || 25;
      const limited = rssItems.slice(0, maxResults);

      const jobs: RawJobItem[] = [];
      for (const item of limited) {
        const parsed = parseIndeedTitle(item.title);
        const plainDescription = stripHtml(item.description || "");
        const link = cleanIndeedUrl(item.link || "");
        if (!link || !parsed.title) continue;

        jobs.push(
          normalizeRawJob({
            source: this.sourceId,
            sourceJobId: extractIndeedJobId(link || item.guid),
            title: parsed.title,
            company: parsed.company || "Unknown Company",
            location: parsed.location || query.location || "",
            link,
            postedAt: parseRSSDate(item.pubDate),
            employmentType: detectEmploymentType(parsed.title, plainDescription),
            remoteType: detectRemoteType(
              parsed.title,
              parsed.location || "",
              plainDescription
            ),
            description: plainDescription,
            raw: item,
            fetchedAt: now,
          })
        );
      }

      console.log(`[indeed] Parsed ${jobs.length} jobs from RSS feed`);

      return {
        source: this.sourceId,
        jobs,
        totalAvailable: rssItems.length,
        fetchedAt: now,
        query,
      };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown Indeed error";
      console.error(`[indeed] Fetch error:`, errorMsg);

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

function parseRSSItems(xml: string): RSSJobItem[] {
  const items: RSSJobItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    items.push({
      title: extractTag(itemXml, "title"),
      link: extractTag(itemXml, "link"),
      description: extractTag(itemXml, "description"),
      pubDate: extractTag(itemXml, "pubDate"),
      source: extractTag(itemXml, "source"),
      guid: extractTag(itemXml, "guid"),
    });
  }
  return items;
}

function extractTag(xml: string, tag: string): string {
  const cdataRegex = new RegExp(
    `<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`,
    "i"
  );
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const tagMatch = xml.match(regex);
  if (tagMatch) return decodeXmlEntities(tagMatch[1].trim());

  if (tag === "link") {
    const linkRegex = /<link[^>]*?(?:href=["']([^"']+)["'])?[^>]*\/?>/i;
    const linkMatch = xml.match(linkRegex);
    if (linkMatch && linkMatch[1]) return linkMatch[1].trim();

    const bareLinkRegex = /<link\s*\/?>\s*(https?:\/\/[^\s<]+)/i;
    const bareMatch = xml.match(bareLinkRegex);
    if (bareMatch) return bareMatch[1].trim();
  }
  return "";
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

function parseIndeedTitle(rawTitle: string): {
  title: string;
  company: string;
  location: string;
} {
  const parts = (rawTitle || "").split(" - ");
  if (parts.length >= 3) {
    return {
      title: parts[0].trim(),
      company: parts[1].trim(),
      location: parts.slice(2).join(" - ").trim(),
    };
  }
  if (parts.length === 2) {
    return { title: parts[0].trim(), company: parts[1].trim(), location: "" };
  }
  return { title: (rawTitle || "").trim(), company: "", location: "" };
}

function extractIndeedJobId(urlOrGuid: string): string {
  const jkMatch = urlOrGuid.match(/jk=([a-f0-9]+)/i);
  if (jkMatch) return `indeed-${jkMatch[1]}`;
  return `indeed-${urlOrGuid.replace(/[^a-zA-Z0-9]/g, "").slice(-30)}`;
}

function cleanIndeedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const jk = parsed.searchParams.get("jk");
    if (jk) return `${parsed.origin}${parsed.pathname}?jk=${jk}`;
    return url;
  } catch {
    return url;
  }
}

function parseRSSDate(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {
    // ignore
  }
  return undefined;
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
