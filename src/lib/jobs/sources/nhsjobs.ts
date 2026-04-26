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

export class NhsJobsAdapter implements JobSourceAdapter {
  readonly sourceId = "nhsjobs";
  readonly displayName = "NHS Jobs";

  async isConfigured(): Promise<boolean> {
    const config = await getAppConfig();
    return Boolean(config.jobSources.nhsjobs?.enabled);
  }

  async fetchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const now = new Date().toISOString();

    try {
      const params = new URLSearchParams({
        keyword: query.keywords.join(" "),
        skipPhraseSuggester: "true",
      });

      if (query.location && !query.remoteOnly) {
        params.set("location", query.location);
      }

      const response = await fetch(
        `https://www.jobs.nhs.uk/candidate/search/results?${params.toString()}`,
        {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "LifeOS/1.0 CTA Source Adapter",
          },
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(`NHS Jobs returned ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const maxResults = Math.min(query.maxResults || 25, 25);
      const jobs: RawJobItem[] = [];

      $("li[data-test='search-result']").each((_, element) => {
        if (jobs.length >= maxResults) {
          return;
        }

        const card = $(element);
        const titleLink = card.find("a[data-test='search-result-job-title']").first();
        const title = titleLink.text().replace(/\s+/g, " ").trim();
        const href = titleLink.attr("href") || "";
        if (!title || !href) {
          return;
        }

        const locationHeading = card.find("[data-test='search-result-location'] h3").first();
        const company = locationHeading.clone().children().remove().end().text().replace(/\s+/g, " ").trim();
        const location = locationHeading.find(".location-font-size").text().replace(/\s+/g, " ").trim();
        const salaryText = card.find("[data-test='search-result-salary'] strong").first().text().replace(/\s+/g, " ").trim() || undefined;
        const contractType = card.find("[data-test='search-result-jobType'] strong").first().text().replace(/\s+/g, " ").trim();
        const workingPattern = card.find("[data-test='search-result-workingPattern'] strong").first().text().replace(/\s+/g, " ").trim();
        const postedAtText = card.find("[data-test='search-result-publicationDate'] strong").first().text().replace(/\s+/g, " ").trim();
        const description = [
          `${title} at ${company || "NHS"}.`,
          location || query.location || "United Kingdom",
          contractType ? `Contract type: ${contractType}.` : "",
          workingPattern ? `Working pattern: ${workingPattern}.` : "",
        ].filter(Boolean).join(" ");

        jobs.push(
          normalizeRawJob({
            source: this.sourceId,
            sourceJobId: extractAdvertId(href) || href,
            title,
            company: company || "NHS employer",
            location: location || query.location || "United Kingdom",
            salaryText,
            link: resolveNhsUrl(href),
            postedAt: parseUkDate(postedAtText),
            employmentType: detectEmploymentType(title, `${contractType} ${workingPattern}`),
            remoteType: detectRemoteType(title, location, workingPattern),
            description,
            raw: {
              href,
              contractType,
              workingPattern,
              postedAtText,
            },
            fetchedAt: now,
          })
        );
      });

      return {
        source: this.sourceId,
        jobs,
        totalAvailable: extractResultsCount($("#search-results-heading").text()) || jobs.length,
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
        error: err instanceof Error ? err.message : "NHS Jobs fetch failed",
      };
    }
  }
}

function resolveNhsUrl(href: string): string {
  try {
    return new URL(href, "https://www.jobs.nhs.uk").toString();
  } catch {
    return href;
  }
}

function extractAdvertId(href: string): string {
  const match = href.match(/\/candidate\/jobadvert\/([^?]+)/i);
  return match?.[1] || href;
}

function parseUkDate(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function extractResultsCount(value: string): number | null {
  const match = value.replace(/,/g, "").match(/(\d+)\s+jobs?\s+found/i);
  if (!match) return null;
  const count = parseInt(match[1], 10);
  return Number.isFinite(count) ? count : null;
}
