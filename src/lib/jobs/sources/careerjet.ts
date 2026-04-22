// ============================================================
// CareerJet job source adapter.
//
// Public API at public-api.careerjet.net. Requires an
// affiliate ID — register for free at:
//   https://www.careerjet.co.uk/partners/api/
//
// Disabled unless CAREERJET_AFFID is set in the environment.
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

interface CareerJetJob {
  url: string;
  title: string;
  description: string;
  company: string;
  salary: string;
  date: string;
  locations: string;
  site: string;
}

interface CareerJetResponse {
  type: string;
  hits: number;
  pages: number;
  response_time: number;
  jobs: CareerJetJob[];
  error?: string;
}

export class CareerJetAdapter implements JobSourceAdapter {
  readonly sourceId = "careerjet";
  readonly displayName = "CareerJet";

  private async getConfig() {
    const appConfig = await getAppConfig();
    return appConfig.jobSources.careerjet;
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    return Boolean(config.enabled && config.affid);
  }

  async fetchJobs(query: JobSearchQuery): Promise<JobSourceResult> {
    const now = new Date().toISOString();
    const config = await this.getConfig();
    const affid = config.affid;

    if (!config.enabled || !affid) {
      return {
        source: this.sourceId,
        jobs: [],
        totalAvailable: 0,
        fetchedAt: now,
        query,
        error: "CareerJet is not configured. Set affiliate ID in Settings.",
      };
    }

    try {
      const page = query.page || 1;

      const params = new URLSearchParams({
        keywords: query.keywords.join(" "),
        location: query.location || "United Kingdom",
        page: page.toString(),
        pagesize: Math.min(query.maxResults || 25, 99).toString(),
        sort: "date",
        contracttype: "",
        affid,
        user_ip: "127.0.0.1",
        user_agent: "LifeOS/1.0",
        locale_code: "en_GB",
      });

      if (query.radius) {
        params.set("radius", query.radius.toString());
      }

      // Correct hostname: hyphen, not dot.
      const url = `https://public-api.careerjet.net/search?${params.toString()}`;

      console.log(
        `[careerjet] Fetching: ${query.keywords.join(" ")} in ${query.location || "UK"}`
      );

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "LifeOS/1.0",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`CareerJet API returned ${response.status}`);
      }

      const data = (await response.json()) as CareerJetResponse;

      if (data.type && data.type !== "JOBS") {
        return {
          source: this.sourceId,
          jobs: [],
          totalAvailable: 0,
          fetchedAt: now,
          query,
          error: data.error || `CareerJet returned type: ${data.type}`,
        };
      }

      if (!Array.isArray(data.jobs)) {
        return {
          source: this.sourceId,
          jobs: [],
          totalAvailable: 0,
          fetchedAt: now,
          query,
          error: "CareerJet returned no jobs array",
        };
      }

      const jobs: RawJobItem[] = [];
      for (const cjJob of data.jobs) {
        const link = (cjJob.url || "").trim();
        const title = (cjJob.title || "").trim();
        if (!link || !title) continue;

        jobs.push(
          normalizeRawJob({
            source: this.sourceId,
            sourceJobId: generateCareerJetId(link),
            title,
            company: cjJob.company || "Unknown Company",
            location: cjJob.locations || "",
            salaryText: cjJob.salary || undefined,
            link,
            postedAt: parseCareerJetDate(cjJob.date),
            employmentType: detectEmploymentType(title, cjJob.description || ""),
            remoteType: detectRemoteType(
              title,
              cjJob.locations || "",
              cjJob.description || ""
            ),
            description: cjJob.description,
            raw: cjJob,
            fetchedAt: now,
          })
        );
      }

      console.log(
        `[careerjet] Fetched ${jobs.length} jobs (${data.hits} total hits)`
      );

      return {
        source: this.sourceId,
        jobs,
        totalAvailable: data.hits || jobs.length,
        fetchedAt: now,
        query,
        pageInfo: {
          page,
          perPage: jobs.length,
          hasMore: page < (data.pages || 1),
        },
      };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown CareerJet error";
      console.error(`[careerjet] Fetch error:`, errorMsg);

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

function generateCareerJetId(url: string): string {
  return url
    .replace(/https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-40);
}

function parseCareerJetDate(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {
    // ignore
  }
  return undefined;
}
