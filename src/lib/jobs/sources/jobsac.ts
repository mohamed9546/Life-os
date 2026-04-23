// ============================================================
// jobs.ac.uk adapter.
// Free public search-result page fetcher focused on UK academic,
// NHS, research governance, trial support, and university roles.
// ============================================================

import * as cheerio from "cheerio";
import { RawJobItem } from "@/types";
import { getAppConfig } from "@/lib/config/app-config";
import {
  JobSearchQuery,
  JobSourceAdapter,
  JobSourceResult,
} from "./types";
import {
  detectEmploymentType,
  detectRemoteType,
  normalizeRawJob,
} from "./normalize";

export class JobsAcAdapter implements JobSourceAdapter {
  readonly sourceId = "jobsac";
  readonly displayName = "jobs.ac.uk";

  async isConfigured(): Promise<boolean> {
    const config = await getAppConfig();
    return Boolean(config.jobSources.jobsac?.enabled);
  }

  async fetchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const now = new Date().toISOString();

    try {
      const params = new URLSearchParams({
        keywords: query.keywords.join(" "),
        location: query.location || "United Kingdom",
        pageSize: String(Math.min(query.maxResults || 25, 25)),
      });

      const url = `https://www.jobs.ac.uk/search/?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "LifeOS/1.0 Job Aggregator",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`jobs.ac.uk returned ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const jobs: RawJobItem[] = [];
      const maxResults = query.maxResults || 25;

      $(".j-search-result__result").each((_, element) => {
        if (jobs.length >= maxResults) return;
        const card = $(element);
        const titleLink = card.find(".j-search-result__text > a").first();
        const title = titleLink.text().replace(/\s+/g, " ").trim();
        const href = titleLink.attr("href") || "";
        const company = card.find(".j-search-result__employer").text().replace(/\s+/g, " ").trim();
        const department = card.find(".j-search-result__department").text().replace(/\s+/g, " ").trim();
        const location = extractLabelValue(card.text(), "Location") || query.location || "";
        const salaryText = extractLabelValue(card.text(), "Salary") || undefined;
        const placed = extractLabelValue(card.text(), "Date Placed");
        const description = [title, department, card.find(".j-search-result__info").text()]
          .join("\n")
          .replace(/\s+/g, " ")
          .trim();

        if (!title || !href) return;

        jobs.push(
          normalizeRawJob({
            source: this.sourceId,
            sourceJobId: `jobsac-${card.attr("data-advert-id") || href}`,
            title,
            company: company || department || "Unknown employer",
            location,
            salaryText,
            link: href.startsWith("http") ? href : `https://www.jobs.ac.uk${href}`,
            postedAt: parseJobsAcDate(placed),
            employmentType: detectEmploymentType(title, description),
            remoteType: detectRemoteType(title, location, description),
            description,
            raw: { href, department, placed },
            fetchedAt: now,
          })
        );
      });

      return {
        source: this.sourceId,
        jobs,
        totalAvailable: jobs.length,
        fetchedAt: now,
        query,
      };
    } catch (err) {
      return {
        source: this.sourceId,
        jobs: [],
        totalAvailable: 0,
        fetchedAt: now,
        query,
        error: err instanceof Error ? err.message : "jobs.ac.uk fetch failed",
      };
    }
  }
}

function extractLabelValue(text: string, label: string): string {
  const normalized = text.replace(/\s+/g, " ");
  const pattern = new RegExp(`${label}:\\s*(.*?)(?:Salary:|Date Placed:|Closes|Save|$)`, "i");
  return normalized.match(pattern)?.[1]?.trim() || "";
}

function parseJobsAcDate(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value} ${new Date().getFullYear()}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
