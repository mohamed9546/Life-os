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
    return config.jobSources.guardianjobs?.enabled ?? true;
  }

  async fetchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const now = new Date().toISOString();

    try {
      const keywords = query.keywords.join(" ");
      const location = query.location || "uk";
      const params = new URLSearchParams({
        q: keywords,
        location,
        format: "rss",
      });

      const url = `https://jobs.guardian.co.uk/results/rss/?${params.toString()}`;

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
      const limited = items.slice(0, maxResults);

      const jobs: RawJobItem[] = limited.map((item) =>
        normalizeRawJob({
          source: this.sourceId,
          sourceJobId: `guardian-${item.guid.replace(/[^a-zA-Z0-9]/g, "").slice(-20)}`,
          title: item.title,
          company: item.company || "Unknown",
          location: item.location || location,
          link: item.link,
          postedAt: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
          employmentType: detectEmploymentType(item.title, item.description),
          remoteType: detectRemoteType(item.title, item.location, item.description),
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
  company: string;
  location: string;
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
    items.push({
      title: extractText(chunk, "title"),
      company: extractText(chunk, "guardian:company") || extractText(chunk, "dc:creator"),
      location: extractText(chunk, "guardian:location"),
      link: extractText(chunk, "link"),
      description: stripHtml(extractCDATA(chunk, "description") || extractText(chunk, "description")),
      pubDate: extractText(chunk, "pubDate"),
      guid: extractText(chunk, "guid"),
    });
  }
  return items.filter((i) => i.title && i.link);
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
