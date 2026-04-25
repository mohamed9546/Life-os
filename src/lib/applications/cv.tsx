import { promises as fs } from "fs";
import path from "path";
import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { CvLibraryEntry, EnrichedJob } from "@/types";
import { callPythonAI, isPythonAIEnabled } from "@/lib/ai/python-sidecar";
import { CandidateProfileSeed, loadCandidateProfile } from "@/lib/profile/candidate-profile";
import { getCvLibrary } from "./storage";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 50,
    color: "#1f2937",
  },
  name: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  headline: { fontSize: 11, marginBottom: 2, color: "#374151" },
  location: { fontSize: 10, color: "#6b7280", marginBottom: 14 },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  paragraph: { fontSize: 10, lineHeight: 1.45, marginBottom: 6 },
  item: { fontSize: 10, lineHeight: 1.35, marginBottom: 3 },
  note: { fontSize: 8, color: "#6b7280", marginTop: 8 },
});

export interface CvSelection {
  selected: CvLibraryEntry | null;
  confidence: number;
  reason: string;
}

export interface CvPacket {
  selectedCv: CvLibraryEntry | null;
  selectedCvPath?: string;
  tailoredCvPath?: string | null;
  confidence: number;
  reason: string;
  keywords: string[];
}

export async function selectCvForJob(job: EnrichedJob): Promise<CvSelection> {
  const library = (await getCvLibrary()).filter((entry) => entry.active);
  if (library.length === 0) {
    return { selected: null, confidence: 0, reason: "No active CVs configured" };
  }

  const parsed = job.parsed?.data;
  const track = parsed?.roleTrack;
  const text = [
    job.raw.title,
    job.raw.company,
    job.raw.description,
    parsed?.title,
    parsed?.roleFamily,
    parsed?.keywords?.join(" "),
    parsed?.mustHaves?.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (isPythonAIEnabled()) {
    const pythonChoice = await selectCvViaPython(job, library);
    if (pythonChoice) {
      return pythonChoice;
    }
  }

  const scored = library.map((entry) => {
    let score = 0;
    if (track && entry.roleTracks.includes(track)) score += 6;
    for (const keyword of entry.keywords) {
      if (text.includes(keyword.toLowerCase())) score += 2;
    }
    return { entry, score };
  });

  scored.sort((left, right) => right.score - left.score);
  const best = scored[0];
  if (!best) {
    return { selected: null, confidence: 0, reason: "No CV library entry available" };
  }

  const confidence = Math.min(0.95, Math.max(0.35, best.score / 12));
  return {
    selected: best.entry,
    confidence,
    reason:
      track && best.entry.roleTracks.includes(track)
        ? `Matched ${track} role track`
        : "Matched by job keywords",
  };
}

export async function buildCvPacket(job: EnrichedJob): Promise<CvPacket> {
  const selection = await selectCvForJob(job);
  const profile = await loadCandidateProfile();
  const localKeywords = buildTruthfulKeywordSet(job, profile);
  const keywords = await planKeywordsViaPython(job, localKeywords);
  let tailoredCvPath: string | null = null;

  if (selection.selected && profile && selection.confidence >= 0.7 && keywords.length >= 4) {
    tailoredCvPath = await renderKeywordTailoredCv(job, profile, keywords, selection.selected);
  }

  return {
    selectedCv: selection.selected,
    selectedCvPath: selection.selected?.path,
    tailoredCvPath,
    confidence: selection.confidence,
    reason: selection.reason,
    keywords,
  };
}

function buildTruthfulKeywordSet(
  job: EnrichedJob,
  profile: CandidateProfileSeed | null
): string[] {
  const allowed = new Set<string>();
  for (const entry of [
    ...(profile?.strengths || []),
    ...(profile?.experienceHighlights || []),
    ...(profile?.education || []),
    ...(profile?.targetTitles || []),
  ]) {
    for (const part of entry.split(/[;,.|/]/)) {
      const cleaned = part.trim();
      if (cleaned.length >= 3 && cleaned.length <= 80) {
        allowed.add(cleaned);
      }
    }
  }

  const parsed = job.parsed?.data;
  const wanted = [
    ...(parsed?.mustHaves || []),
    ...(parsed?.niceToHaves || []),
    ...(parsed?.keywords || []),
    parsed?.roleFamily,
    parsed?.title,
  ]
    .filter((item): item is string => Boolean(item))
    .map((item) => item.trim());

  const chosen: string[] = [];
  const allowedLower = Array.from(allowed).map((item) => ({
    original: item,
    lower: item.toLowerCase(),
  }));

  for (const item of wanted) {
    const lower = item.toLowerCase();
    const match = allowedLower.find(
      (candidate) =>
        candidate.lower.includes(lower) ||
        lower.includes(candidate.lower) ||
        tokenOverlap(candidate.lower, lower) >= 0.5
    );
    if (match) chosen.push(match.original);
  }

  return unique([
    ...chosen,
    ...(profile?.strengths || []),
    ...(parsed?.keywords || []),
  ]).slice(0, 12);
}

async function selectCvViaPython(
  job: EnrichedJob,
  library: CvLibraryEntry[]
): Promise<CvSelection | null> {
  try {
    const result = await callPythonAI<
      { job: Record<string, unknown> },
      {
        success: boolean;
        data?: {
          cvId?: string;
          label?: string;
          confidence?: number;
          reason?: string;
        };
      }
    >(
      "/select-cv-for-job",
      {
        job: {
          title: job.raw.title,
          company: job.raw.company,
          description: job.raw.description,
          parsed: job.parsed?.data,
          fit: job.fit?.data,
        },
      },
      45_000
    );
    const selected = library.find((entry) => entry.id === result.data?.cvId);
    if (!result.success || !selected) return null;
    return {
      selected,
      confidence: Math.max(0, Math.min(1, result.data?.confidence || 0.5)),
      reason: result.data?.reason || "Selected by Python application planner",
    };
  } catch {
    return null;
  }
}

async function planKeywordsViaPython(
  job: EnrichedJob,
  allowedKeywords: string[]
): Promise<string[]> {
  if (!isPythonAIEnabled() || allowedKeywords.length === 0) {
    return allowedKeywords;
  }

  try {
    const result = await callPythonAI<
      { job: Record<string, unknown>; allowedKeywords: string[] },
      { success: boolean; data?: { keywords?: string[] } }
    >(
      "/plan-cv-keywords",
      {
        job: {
          title: job.raw.title,
          company: job.raw.company,
          description: job.raw.description,
          parsed: job.parsed?.data,
        },
        allowedKeywords,
      },
      45_000
    );
    const planned = result.data?.keywords?.filter((keyword) =>
      allowedKeywords.some((allowed) => allowed.toLowerCase() === keyword.toLowerCase())
    );
    return result.success && planned?.length ? planned.slice(0, 12) : allowedKeywords;
  } catch {
    return allowedKeywords;
  }
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(left.split(/\W+/).filter((token) => token.length > 2));
  const rightTokens = right.split(/\W+/).filter((token) => token.length > 2);
  if (leftTokens.size === 0 || rightTokens.length === 0) return 0;
  const hits = rightTokens.filter((token) => leftTokens.has(token)).length;
  return hits / Math.max(leftTokens.size, rightTokens.length);
}

async function renderKeywordTailoredCv(
  job: EnrichedJob,
  profile: CandidateProfileSeed,
  keywords: string[],
  baseCv: CvLibraryEntry
): Promise<string> {
  const parsed = job.parsed?.data;
  const dir = path.join(process.cwd(), "data", "generated-cvs");
  await fs.mkdir(dir, { recursive: true });
  const filename = `${safeFilePart(job.raw.company)}-${safeFilePart(job.raw.title)}-${Date.now()}.pdf`;
  const outputPath = path.join(dir, filename);

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.name }, profile.fullName || "Mohamed Abdalla"),
      React.createElement(Text, { style: styles.headline }, profile.headline || ""),
      React.createElement(Text, { style: styles.location }, profile.location || ""),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Professional Summary"),
        React.createElement(Text, { style: styles.paragraph }, profile.summary || "")
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Skills & Keywords"),
        ...keywords.map((keyword, index) =>
          React.createElement(Text, { key: index, style: styles.item }, `- ${keyword}`)
        )
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Experience Highlights"),
        ...(profile.experienceHighlights || []).slice(0, 8).map((item, index) =>
          React.createElement(Text, { key: index, style: styles.item }, `- ${item}`)
        )
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Education"),
        ...(profile.education || []).slice(0, 6).map((item, index) =>
          React.createElement(Text, { key: index, style: styles.item }, `- ${item}`)
        )
      ),
      React.createElement(
        Text,
        { style: styles.note },
        `Skills/keywords tailored for ${parsed?.title || job.raw.title} at ${job.raw.company}. Base CV: ${baseCv.label}.`
      )
    )
  );

  const buffer = await renderToBuffer(doc as any);
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function safeFilePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "cv";
}
