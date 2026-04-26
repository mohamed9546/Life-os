// ============================================================
// WeWorkRemotely job source adapter.
// Free RSS API, NO auth required.
// Great for remote tech roles worldwide.
// ============================================================

import { RawJobItem } from "@/types";
import { getAppConfig } from "@/lib/config/app-config";
import {
  JobSourceAdapter,
  JobSearchQuery,
  JobSourceResult,
} from "./types";
import { normalizeRawJob, detectEmploymentType } from "./normalize";

export class WeWorkRemotelyAdapter implements JobSourceAdapter {
  readonly sourceId = "weworkremotely";
  readonly displayName = "We Work Remotely";

  async isConfigured(): Promise<boolean> {
    const config = await getAppConfig();
    return Boolean(config.jobSources.weworkremotely?.enabled);
  }

  async fetchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const now = new Date().toISOString();

    try {
      // WWR has category RSS feeds — pick the best match
      const category = mapCategory(query.keywords);
      const url = `https://weworkremotely.com/categories/remote-${category}-jobs.rss`;

      const response = await fetch(url, {
        headers: {
          Accept: "application/rss+xml, text/xml",
          "User-Agent": "LifeOS/1.0 Job Aggregator",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`WWR RSS returned ${response.status}`);
      }

      const xml = await response.text();
      const items = parseRSSItems(xml);
      const maxResults = query.maxResults || 30;

      const keywords = query.keywords.map((k) => k.toLowerCase());
      const filtered = items
        .filter((item) => {
          if (keywords.length === 0) return true;
          const hay = `${item.title} ${item.company} ${item.description}`.toLowerCase();
          return keywords.some((k) => hay.includes(k));
        })
        .slice(0, maxResults);

      const jobs: RawJobItem[] = filtered.map((item) =>
        normalizeRawJob({
          source: this.sourceId,
          sourceJobId: `wwr-${item.guid.replace(/[^a-zA-Z0-9]/g, "").slice(-20)}`,
          title: item.title,
          company: item.company,
          location: item.region || "Remote (Worldwide)",
          link: item.link,
          postedAt: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
          employmentType: detectEmploymentType(item.title, item.description),
          remoteType: "remote",
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
        error: err instanceof Error ? err.message : "WWR fetch failed",
      };
    }
  }
}

function mapCategory(keywords: string[]): string {
  const kw = keywords.join(" ").toLowerCase();
  if (/design|ux|ui|figma/.test(kw)) return "design";
  if (/devops|sre|cloud|infra|kubernetes|docker/.test(kw)) return "devops-sysadmin";
  if (/data|ml|machine learning|ai/.test(kw)) return "data-science";
  if (/marketing|growth|seo|content/.test(kw)) return "marketing";
  if (/product|pm|product manager/.test(kw)) return "product";
  if (/sales/.test(kw)) return "sales-and-marketing";
  return "programming";
}

interface RSSItem {
  title: string;
  company: string;
  region: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

function parseRSSItems(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const chunk = m[1];
    const raw = extractTag(chunk, "title");
    const { company, title } = splitCompanyAndTitle(raw);

    items.push({
      title,
      company,
      region: extractTag(chunk, "region"),
      link: extractTag(chunk, "link") || extractCDATA(chunk, "link"),
      description: stripHtml(extractCDATA(chunk, "description") || extractTag(chunk, "description")),
      pubDate: extractTag(chunk, "pubDate"),
      guid: extractTag(chunk, "guid"),
    });
  }
  return items;
}

function splitCompanyAndTitle(value: string): { company: string; title: string } {
  const trimmed = value.trim();
  for (const separator of [":", "|"]) {
    const index = trimmed.indexOf(separator);
    if (index > 0 && index < trimmed.length - 1) {
      return {
        company: trimmed.slice(0, index).trim(),
        title: trimmed.slice(index + 1).trim(),
      };
    }
  }

  return { company: "Unknown", title: trimmed };
}

function extractTag(xml: string, tag: string): string {
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
