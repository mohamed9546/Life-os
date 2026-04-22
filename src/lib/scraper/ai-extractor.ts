// ============================================================
// AI-powered job data extractor.
// Takes scraped HTML/text and uses Ollama to extract
// structured job data. This is the magic layer — it can
// turn ANY page content into structured job information.
// ============================================================

import { callAI } from "@/lib/ai/client";
import { validateAIOutput } from "@/lib/ai/schemas";
import { ScrapedJobData, ScrapeResult } from "./types";
import { RawJobItem } from "@/types";
import { normalizeRawJob, detectRemoteType, detectEmploymentType } from "@/lib/jobs/sources/normalize";
import { z } from "zod";

// Schema for AI extraction
const ScrapedJobSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  description: z.string(),
  salaryText: z.string().nullable().optional(),
  employmentType: z.string().nullable().optional(),
  remoteType: z.string().nullable().optional(),
  postedAt: z.string().nullable().optional(),
  applyUrl: z.string().nullable().optional(),
  requirements: z.array(z.string()).optional(),
  benefits: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
});

const ScrapedJobListSchema = z.object({
  jobs: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      location: z.string(),
      description: z.string(),
      salaryText: z.string().optional(),
      link: z.string().optional(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

const SYSTEM_PROMPT = `You are a job listing data extractor. You analyze web page content and extract structured job information.
Always respond with valid JSON only. Be precise and extract exactly what is present — do not invent information.
If something is not clearly stated, use null or omit it.`;

/**
 * Extract a single job posting from scraped page content.
 * Best for individual job detail pages.
 */
export async function extractJobFromScrape(
  scrapeResult: ScrapeResult
): Promise<ScrapedJobData | null> {
  if (!scrapeResult.success || (!scrapeResult.text && !scrapeResult.html)) {
    return null;
  }

  // Use text content, truncated to avoid overwhelming the model
  const content = (scrapeResult.text || scrapeResult.html || "").slice(
    0,
    8000
  );

  const prompt = `Extract job posting information from this web page content and return a JSON object:

PAGE URL: ${scrapeResult.url}
PAGE TITLE: ${scrapeResult.title || "Unknown"}

PAGE CONTENT:
---
${content}
---

Return exactly this JSON structure:
{
  "title": "job title",
  "company": "company name",
  "location": "job location",
  "description": "full job description (keep it detailed)",
  "salaryText": "salary info or null",
  "employmentType": "permanent/contract/temp/unknown or null",
  "remoteType": "remote/hybrid/onsite/unknown or null",
  "postedAt": "date posted (ISO format if possible) or null",
  "applyUrl": "application URL or null",
  "requirements": ["list of requirements"],
  "benefits": ["list of benefits"],
  "confidence": 0.0 to 1.0
}

If this page does NOT contain a job posting, return: {"title": "", "company": "", "location": "", "description": "", "confidence": 0}

Respond with ONLY the JSON object.`;

  const result = await callAI<ScrapedJobData>({
    taskType: "extract-job-from-scrape",
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    rawInput: scrapeResult.url,
    temperature: 0.1,
  });

  if (!result.success || !result.data) return null;

  const validation = validateAIOutput(ScrapedJobSchema, result.data);
  if (!validation.valid) return null;

  // Check if the AI actually found a job
  if (
    !validation.data.title ||
    validation.data.confidence < 0.3
  ) {
    return null;
  }

  return {
    ...validation.data,
    sourceUrl: scrapeResult.url,
    salaryText: validation.data.salaryText || undefined,
    employmentType: validation.data.employmentType || undefined,
    remoteType: validation.data.remoteType || undefined,
    postedAt: validation.data.postedAt || undefined,
    applyUrl: validation.data.applyUrl || undefined,
    requirements: validation.data.requirements || [],
    benefits: validation.data.benefits || [],
  } as ScrapedJobData;
}

/**
 * Extract multiple job listings from a careers page or search results.
 * Best for pages that list many jobs.
 */
export async function extractJobListFromScrape(
  scrapeResult: ScrapeResult
): Promise<
  Array<{
    title: string;
    company: string;
    location: string;
    description: string;
    salaryText?: string;
    link?: string;
    confidence: number;
  }>
> {
  if (!scrapeResult.success || (!scrapeResult.text && !scrapeResult.html)) {
    return [];
  }

  const content = (scrapeResult.text || scrapeResult.html || "").slice(
    0,
    12000
  );

  const prompt = `This web page contains a list of job postings. Extract each job and return them as a JSON array.

PAGE URL: ${scrapeResult.url}
PAGE TITLE: ${scrapeResult.title || "Unknown"}

PAGE CONTENT:
---
${content}
---

Return exactly this JSON structure:
{
  "jobs": [
    {
      "title": "job title",
      "company": "company name",
      "location": "location",
      "description": "brief description",
      "salaryText": "salary or null",
      "link": "direct link to job or null",
      "confidence": 0.0 to 1.0
    }
  ]
}

If no jobs are found, return: {"jobs": []}

Respond with ONLY the JSON object.`;

  const result = await callAI<{ jobs: Array<Record<string, unknown>> }>({
    taskType: "extract-job-list-from-scrape",
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    rawInput: scrapeResult.url,
    temperature: 0.1,
  });

  if (!result.success || !result.data) return [];

  const validation = validateAIOutput(ScrapedJobListSchema, result.data);
  if (!validation.valid) return [];

  return validation.data.jobs
    .filter((j) => j.title && j.confidence > 0.3)
    .map((j) => ({
      title: j.title,
      company: j.company,
      location: j.location,
      description: j.description,
      salaryText: j.salaryText,
      link: j.link,
      confidence: j.confidence,
    }));
}

/**
 * Convert AI-extracted job data into a RawJobItem for the pipeline.
 */
export function scrapedJobToRawItem(
  job: ScrapedJobData
): RawJobItem {
  return normalizeRawJob({
    source: "scraper",
    sourceJobId: `scrape-${hashString(job.sourceUrl + job.title)}`,
    title: job.title,
    company: job.company,
    location: job.location,
    salaryText: job.salaryText,
    link: job.applyUrl || job.sourceUrl,
    postedAt: job.postedAt,
    employmentType:
      job.employmentType ||
      detectEmploymentType(job.title, job.description),
    remoteType:
      job.remoteType ||
      detectRemoteType(job.title, job.location, job.description),
    description: job.description,
    raw: job,
    fetchedAt: new Date().toISOString(),
  });
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}