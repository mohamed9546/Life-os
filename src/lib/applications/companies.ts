import * as cheerio from "cheerio";
import { RawJobItem, TargetCompany } from "@/types";
import { getTargetCompanies } from "./storage";

const JOB_TERMS =
  /clinical|trial|research|regulatory|quality|qa|pharmacovigilance|drug safety|medical information|gcp|cra|cta|tmf|compliance|document control/i;
const LOCATION_TERMS = /united kingdom|uk|ireland|dublin|glasgow|edinburgh|scotland|egypt|cairo|remote|hybrid/i;

export async function fetchTargetCompanyJobs(
  options?: { maxCompanies?: number; maxJobsPerCompany?: number }
): Promise<{ jobs: RawJobItem[]; companiesChecked: number; errors: string[] }> {
  const companies = (await getTargetCompanies()).filter((company) => company.enabled);
  const maxCompanies = options?.maxCompanies || 12;
  const maxJobsPerCompany = options?.maxJobsPerCompany || 15;
  const jobs: RawJobItem[] = [];
  const errors: string[] = [];

  for (const company of companies.slice(0, maxCompanies)) {
    try {
      const fetched = await fetchCompanyCareerPage(company, maxJobsPerCompany);
      jobs.push(...fetched);
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (err) {
      errors.push(
        `${company.name}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  return { jobs, companiesChecked: Math.min(companies.length, maxCompanies), errors };
}

async function fetchCompanyCareerPage(
  company: TargetCompany,
  maxJobs: number
): Promise<RawJobItem[]> {
  const response = await fetch(company.careersUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ApplyPilot/1.0",
    },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`career page returned ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const now = new Date().toISOString();
  const jobs: RawJobItem[] = [];
  const seen = new Set<string>();

  $("a").each((_, element) => {
    if (jobs.length >= maxJobs) return;
    const anchor = $(element);
    const text = clean(anchor.text());
    const href = anchor.attr("href") || "";
    if (!text || text.length < 4 || !JOB_TERMS.test(text)) return;
    const link = resolveUrl(company.careersUrl, href);
    if (!link || seen.has(link)) return;
    if (!looksLikeJobUrl(link, text)) return;

    seen.add(link);
    jobs.push({
      source: `company-${company.atsType}`,
      sourceJobId: `${company.id}-${stableId(link)}`,
      company: company.name,
      title: text,
      location: inferLocationFromText(text, company),
      link,
      description: buildCompanyDescription(company, text, link),
      raw: {
        targetCompanyId: company.id,
        atsType: company.atsType,
        careersUrl: company.careersUrl,
      },
      fetchedAt: now,
    });
  });

  const jsonLdJobs = extractJsonLdJobs(html, company, now);
  for (const job of jsonLdJobs) {
    if (jobs.length >= maxJobs) break;
    if (seen.has(job.link)) continue;
    seen.add(job.link);
    jobs.push(job);
  }

  return jobs;
}

function extractJsonLdJobs(
  html: string,
  company: TargetCompany,
  now: string
): RawJobItem[] {
  const $ = cheerio.load(html);
  const jobs: RawJobItem[] = [];
  $("script[type='application/ld+json']").each((_, element) => {
    try {
      const parsed = JSON.parse($(element).text()) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const record = item as {
          "@type"?: string;
          title?: string;
          url?: string;
          description?: string;
          jobLocation?: unknown;
          datePosted?: string;
        };
        if (record["@type"] !== "JobPosting" || !record.title) continue;
        if (!JOB_TERMS.test(record.title) && !JOB_TERMS.test(record.description || "")) continue;
        const link = resolveUrl(company.careersUrl, record.url || company.careersUrl);
        jobs.push({
          source: `company-${company.atsType}`,
          sourceJobId: `${company.id}-${stableId(link || record.title)}`,
          company: company.name,
          title: clean(record.title),
          location: inferLocationFromText(
            JSON.stringify(record.jobLocation || ""),
            company
          ),
          link,
          postedAt: record.datePosted,
          description: clean(record.description || buildCompanyDescription(company, record.title, link)),
          raw: { targetCompanyId: company.id, atsType: company.atsType },
          fetchedAt: now,
        });
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  });
  return jobs;
}

function looksLikeJobUrl(link: string, text: string): boolean {
  return /job|career|apply|vacanc|position|opening/i.test(link) || JOB_TERMS.test(text);
}

function buildCompanyDescription(company: TargetCompany, title: string, link: string): string {
  return [
    `${title} at ${company.name}.`,
    `Target company category: ${company.category}.`,
    `Target countries: ${company.countries.join(", ")}.`,
    `Apply URL: ${link}`,
  ].join("\n");
}

function inferLocationFromText(text: string, company: TargetCompany): string {
  const match = text.match(LOCATION_TERMS);
  if (match) return match[0];
  return company.countries[0] || "United Kingdom";
}

function resolveUrl(base: string, href: string): string {
  try {
    return new URL(href || base, base).toString();
  } catch {
    return "";
  }
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stableId(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}
