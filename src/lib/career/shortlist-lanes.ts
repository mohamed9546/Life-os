import { EnrichedJob } from "@/types";

export type ShortlistLane = "primary" | "secondary" | "off-target";

const CTA_PRIMARY_TERMS = [
  "clinical trial assistant",
  "clinical trials assistant",
  "clinical trial associate",
  "clinical research assistant",
  "clinical research coordinator",
  "trial coordinator",
  "clinical study assistant",
  "clinical study coordinator",
  "clinical operations assistant",
  "trial administrator",
  "study start-up",
  "study startup",
  "site activation",
  "tmf",
  "etmf",
  "ctms",
];

export function classifyShortlistLane(job: EnrichedJob): ShortlistLane {
  const parsed = job.parsed?.data;
  return classifyLaneFromParts({
    roleTrack: parsed?.roleTrack,
    title: parsed?.title || job.raw.title || "",
    summary: parsed?.summary || job.raw.description || "",
    keywords: [...(parsed?.keywords || []), ...(parsed?.mustHaves || [])],
  });
}

export function isPrimaryCtaShortlistJob(job: EnrichedJob): boolean {
  return classifyShortlistLane(job) === "primary";
}

export function isSecondaryShortlistJob(job: EnrichedJob): boolean {
  return classifyShortlistLane(job) === "secondary";
}

export function inferShortlistLaneFromText(input: {
  roleTrack?: string | null;
  title?: string | null;
  summary?: string | null;
  keywords?: string[];
}): ShortlistLane {
  return classifyLaneFromParts({
    roleTrack: input.roleTrack,
    title: input.title || "",
    summary: input.summary || "",
    keywords: input.keywords || [],
  });
}

function classifyLaneFromParts(input: {
  roleTrack?: string | null;
  title: string;
  summary: string;
  keywords: string[];
}): ShortlistLane {
  const roleTrack = input.roleTrack || "other";
  const title = input.title.toLowerCase();
  const summary = input.summary.toLowerCase();
  const keywords = input.keywords.join(" ").toLowerCase();

  const hasPrimarySignal = CTA_PRIMARY_TERMS.some(
    (term) => title.includes(term) || summary.includes(term) || keywords.includes(term)
  );

  if (roleTrack === "clinical" && hasPrimarySignal) {
    return "primary";
  }

  if (["qa", "regulatory", "medinfo"].includes(roleTrack)) {
    return "secondary";
  }

  return "off-target";
}
