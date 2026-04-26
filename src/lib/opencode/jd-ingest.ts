import * as cheerio from "cheerio";
import { parseJobPosting } from "@/lib/ai/tasks/parse-job";
import { triageTrackText, TrackTriageResult } from "./track-triage";
import { writeOpenCodeJson, writeOpenCodeText } from "./storage";

export interface JobDocumentIngestResult {
  slug: string;
  markdownPath: string;
  jsonPath: string;
  parsed: Awaited<ReturnType<typeof parseJobPosting>>;
  triage: TrackTriageResult;
  sourceUrl?: string;
}

export async function ingestJobDocument(input: {
  sourceUrl?: string;
  rawText?: string;
}): Promise<JobDocumentIngestResult> {
  const sourceUrl = input.sourceUrl?.trim() || undefined;
  const rawText = input.rawText?.trim() || "";
  const { text, pageTitle } = sourceUrl ? await fetchJobSource(sourceUrl) : { text: rawText, pageTitle: "" };
  const parseResult = await parseJobPosting(text, {
    ...(pageTitle ? { title: pageTitle } : {}),
    source: sourceUrl || "manual-jd",
  });

  if ("error" in parseResult) {
    throw new Error(parseResult.error);
  }

  const parsed = parseResult.data;
  const triage = triageTrackText(text);
  const slug = slugify(`${parsed.company}-${parsed.title}`);
  const markdownPath = `jds/${slug}.md`;
  const jsonPath = `jds/${slug}.json`;

  await writeOpenCodeJson(jsonPath, {
    sourceUrl,
    parsed,
    triage,
    savedAt: new Date().toISOString(),
  });
  await writeOpenCodeText(
    markdownPath,
    [
      `# ${parsed.title}`,
      ``,
      sourceUrl ? `Source: ${sourceUrl}` : `Source: manual`,
      `Company: ${parsed.company}`,
      `Location: ${parsed.location}`,
      `Employment type: ${parsed.employmentType}`,
      `Remote type: ${parsed.remoteType}`,
      `Role track: ${parsed.roleTrack}`,
      `Triage: ${triage.recommendedTrack.label} (${triage.recommendedTrack.score})`,
      parsed.salaryText ? `Salary: ${parsed.salaryText}` : null,
      ``,
      `## Summary`,
      parsed.summary,
      ``,
      `## Must Haves`,
      ...(parsed.mustHaves.length > 0 ? parsed.mustHaves.map((item) => `- ${item}`) : ["- None extracted"]),
      ``,
      `## Nice To Haves`,
      ...(parsed.niceToHaves.length > 0 ? parsed.niceToHaves.map((item) => `- ${item}`) : ["- None extracted"]),
      ``,
      `## Keywords`,
      ...(parsed.keywords.length > 0 ? parsed.keywords.map((item) => `- ${item}`) : ["- None extracted"]),
      ``,
    ].filter(Boolean).join("\n")
  );

  return {
    slug,
    markdownPath,
    jsonPath,
    parsed: parseResult,
    triage,
    sourceUrl,
  };
}

async function fetchJobSource(url: string): Promise<{ text: string; pageTitle: string }> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "LifeOS/1.0 JD Ingest",
    },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`JD fetch returned ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, header, svg").remove();
  const text = $("main").text().trim() || $("body").text().trim();
  return {
    text: text.replace(/\s+/g, " ").trim(),
    pageTitle: $("title").text().replace(/\s+/g, " ").trim(),
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "job-document";
}
