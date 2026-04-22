// ============================================================
// Normalization utilities for raw job data.
// Cleans, trims, and standardizes fields from any source
// before they enter the pipeline.
//
// Hardened: no field can crash the normalizer. Adapters are
// still expected to skip jobs with missing essentials (link,
// title), but if they don't, we degrade gracefully.
// ============================================================

import { RawJobItem, RemoteType, EmploymentType } from "@/types";

/**
 * Clean and normalize a raw job item from any source.
 * Never throws. Fields default to safe empty values.
 */
export function normalizeRawJob(
  raw: Partial<RawJobItem> & {
    source: string;
    title: string;
    company: string;
    link: string;
  }
): RawJobItem {
  return {
    source: raw.source,
    sourceJobId: safeTrim(raw.sourceJobId) || undefined,
    company: cleanCompanyName(raw.company),
    title: cleanTitle(raw.title),
    location: normalizeLocation(raw.location || ""),
    salaryText: safeTrim(raw.salaryText) || undefined,
    link: safeTrim(raw.link),
    postedAt: raw.postedAt || undefined,
    employmentType: safeTrim(raw.employmentType) || undefined,
    remoteType: safeTrim(raw.remoteType) || undefined,
    description: safeTrim(raw.description) || undefined,
    raw: raw.raw || undefined,
    fetchedAt: raw.fetchedAt || new Date().toISOString(),
  };
}

/**
 * Returns true if the normalized job has the bare minimum to be useful.
 * Adapters can use this to filter before emitting.
 */
export function isUsableRawJob(raw: RawJobItem): boolean {
  return Boolean(raw.title && raw.company && raw.link);
}

function safeTrim(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim();
}

function cleanCompanyName(name: unknown): string {
  const s = safeTrim(name);
  if (!s) return "Unknown Company";
  return s
    .replace(/\s+/g, " ")
    .replace(/\s*(Ltd\.?|Limited|PLC|plc|Inc\.?|LLC|LLP)\s*$/i, "")
    .trim();
}

function cleanTitle(title: unknown): string {
  return safeTrim(title)
    .replace(/\s+/g, " ")
    .replace(/^-\s*/, "")
    .replace(/\s*-\s*$/, "")
    .trim();
}

function normalizeLocation(location: unknown): string {
  const cleaned = safeTrim(location).replace(/\s+/g, " ");
  if (!cleaned) return "";

  const mappings: Record<string, string> = {
    "glasgow, scotland": "Glasgow, Scotland",
    "glasgow, uk": "Glasgow, Scotland",
    "edinburgh, scotland": "Edinburgh, Scotland",
    "edinburgh, uk": "Edinburgh, Scotland",
    "london, england": "London, England",
    "london, uk": "London, England",
    "remote, uk": "United Kingdom (Remote)",
    "uk remote": "United Kingdom (Remote)",
    "united kingdom": "United Kingdom",
    "uk": "United Kingdom",
  };

  const lower = cleaned.toLowerCase();
  if (mappings[lower]) return mappings[lower];
  return cleaned;
}

export function detectRemoteType(
  title: string,
  location: string,
  description?: string
): RemoteType {
  const combined = `${title} ${location} ${description || ""}`.toLowerCase();

  if (
    combined.includes("fully remote") ||
    combined.includes("100% remote") ||
    combined.includes("work from home") ||
    combined.includes("wfh")
  ) {
    return "remote";
  }
  if (
    combined.includes("hybrid") ||
    combined.includes("remote/office") ||
    combined.includes("office/remote")
  ) {
    return "hybrid";
  }
  if (
    combined.includes("on-site") ||
    combined.includes("onsite") ||
    combined.includes("office based") ||
    combined.includes("office-based")
  ) {
    return "onsite";
  }
  if (
    location.toLowerCase().includes("remote") ||
    title.toLowerCase().includes("remote")
  ) {
    return "remote";
  }
  return "unknown";
}

export function detectEmploymentType(
  title: string,
  description?: string
): EmploymentType {
  const combined = `${title} ${description || ""}`.toLowerCase();

  if (
    combined.includes("contract") ||
    combined.includes("fixed term") ||
    combined.includes("fixed-term")
  ) {
    return "contract";
  }
  if (combined.includes("temp") || combined.includes("temporary")) {
    return "temp";
  }
  if (
    combined.includes("permanent") ||
    combined.includes("full-time") ||
    combined.includes("full time")
  ) {
    return "permanent";
  }
  return "unknown";
}

export function generateDedupeKey(job: RawJobItem): string {
  const titleNorm = (job.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const companyNorm = (job.company || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  if (job.link) {
    const linkNorm = job.link
      .toLowerCase()
      .replace(/https?:\/\//, "")
      .replace(/www\./, "")
      .replace(/[?#].*$/, "")
      .replace(/\/+$/, "");
    return `${titleNorm}::${companyNorm}::${linkNorm}`;
  }

  const locationNorm = (job.location || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${titleNorm}::${companyNorm}::${locationNorm}`;
}