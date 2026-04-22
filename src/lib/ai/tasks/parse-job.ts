// ============================================================
// AI Task: Parse a raw job posting into structured data.
// Takes raw job text and extracts all key fields.
// ============================================================

import { AIFailureKind, AIMetadata, ParsedJobPosting, AIResult } from "@/types";
import { callAI } from "../client";
import { ParsedJobPostingSchema, validateAIOutput } from "../schemas";

const SYSTEM_PROMPT = `You are a job posting parser for the UK life sciences / pharma job market.
Your task is to extract structured information from job postings.
Classify roleTrack conservatively, with special care for CTA, trial support, clinical operations support, QA, regulatory, PV, and medinfo pathways.
Always respond with valid JSON matching the exact schema requested.
Never include explanatory text outside the JSON object.
If information is not available in the posting, use reasonable defaults or null.`;

// Terms that immediately classify a job as "other" regardless of other keywords.
// Run this check before TRACK_KEYWORDS matching to prevent e.g. "Chartered Tax Advisor (CTA)" from matching clinical.
const FINANCIAL_OVERRIDE_TERMS = [
  "chartered tax",
  "tax advisor",
  "tax consultant",
  "tax accountant",
  "tax manager",
  "audit manager",
  "financial analyst",
  "finance manager",
  "accountancy",
  "chartered accountant",
  "investment analyst",
  "trading associate",
];

const TRACK_KEYWORDS = {
  clinical: [
    "clinical trial",
    "clinical operations",
    "clinical trial assistant",
    "trial coordinator",
    "study coordinator",
    "site activation",
    "study startup",
    "study start-up",
    "site management",
    "trial master file",
    "tmf",
    "cra",
    "clinical research associate",
  ],
  regulatory: [
    "regulatory",
    "submissions",
    "regulatory affairs",
    "regulatory operations",
    "ctd",
    "mhra",
    "ema",
    "regulatory submission",
    "post-market",
  ],
  qa: [
    "quality assurance",
    "quality systems",
    "gmp",
    "good manufacturing practice",
    "document control",
    "deviation",
    "deviation management",
    "capa",
    "compliance",
    "gdocp",
    "qms",
    "quality management system",
  ],
  pv: [
    "pharmacovigilance",
    "drug safety",
    "safety case",
    "argus",
    "case processing",
    "clinical safety",
    "icsr",
    "psur",
    "dsur",
    "adverse event",
    "signal detection",
    "drug safety associate",
  ],
  medinfo: [
    "medical information",
    "medical affairs",
    "scientific support",
    "medical response",
    "product complaint",
    "scientific advisor",
    "medical copywriter",
  ],
} as const;

function buildPrompt(rawText: string, metadata?: Record<string, string>): string {
  const metaBlock = metadata
    ? `\nADDITIONAL METADATA:\n${Object.entries(metadata)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")}`
    : "";

  return `Parse the following job posting and return a JSON object with exactly these fields:

{
  "title": "string - job title",
  "company": "string - company name",
  "location": "string - location",
  "salaryText": "string or null - salary as mentioned",
  "employmentType": "permanent | contract | temp | unknown",
  "seniority": "string - e.g. entry, mid, senior, lead, director",
  "remoteType": "remote | hybrid | onsite | unknown",
  "roleFamily": "string - broad category e.g. Quality, Regulatory, Pharma, Science",
  "roleTrack": "qa | regulatory | pv | medinfo | clinical | other",
  "mustHaves": ["array of must-have requirements"],
  "niceToHaves": ["array of nice-to-have requirements"],
  "redFlags": ["array of potential concerns - e.g. unrealistic requirements, vague descriptions, excessive travel, mismatched seniority"],
  "keywords": ["array of key terms and skills"],
  "summary": "string - 2-3 sentence summary of the role",
  "confidence": 0.0 to 1.0
}
${metaBlock}

JOB POSTING TEXT:
---
${rawText}
---

Respond with ONLY the JSON object. No markdown, no explanation.`;
}

function detectRoleTrack(text: string): ParsedJobPosting["roleTrack"] {
  const lower = text.toLowerCase();

  // Hard-reject financial/accounting roles before keyword matching.
  // Prevents "Chartered Tax Advisor (CTA)" from matching the clinical track.
  if (FINANCIAL_OVERRIDE_TERMS.some((term) => lower.includes(term))) {
    return "other";
  }

  for (const [roleTrack, keywords] of Object.entries(TRACK_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return roleTrack as ParsedJobPosting["roleTrack"];
    }
  }

  return "other";
}

function detectEmploymentType(text: string): ParsedJobPosting["employmentType"] {
  const lower = text.toLowerCase();
  if (lower.includes("contract") || lower.includes("fixed term")) {
    return "contract";
  }
  if (lower.includes("temporary") || lower.includes("temp")) {
    return "temp";
  }
  if (lower.includes("permanent") || lower.includes("full-time") || lower.includes("full time")) {
    return "permanent";
  }
  return "unknown";
}

function detectRemoteType(text: string): ParsedJobPosting["remoteType"] {
  const lower = text.toLowerCase();
  if (lower.includes("hybrid")) {
    return "hybrid";
  }
  if (lower.includes("remote")) {
    return "remote";
  }
  if (
    lower.includes("on site") ||
    lower.includes("onsite") ||
    lower.includes("office-based") ||
    lower.includes("office based")
  ) {
    return "onsite";
  }
  return "unknown";
}

function detectSeniority(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("director") || lower.includes("head of")) return "director";
  if (lower.includes("senior") || lower.includes("manager") || lower.includes("lead")) {
    return "senior";
  }
  if (lower.includes("junior") || lower.includes("entry level") || lower.includes("graduate")) {
    return "entry";
  }
  if (lower.includes("assistant") || lower.includes("coordinator") || lower.includes("associate")) {
    return "entry-to-mid";
  }
  return "mid";
}

function extractSalaryText(text: string): string | null {
  const salaryMatch = text.match(
    /(£\s?\d[\d,]*(?:\s*-\s*£?\s?\d[\d,]*)?(?:\s*(?:per annum|per year|pa|annual|hour|per hour))?)/i
  );
  return salaryMatch?.[1]?.trim() || null;
}

function pickTitle(rawText: string, metadata?: Record<string, string>): string {
  if (metadata?.title?.trim()) {
    return metadata.title.trim();
  }

  const firstLine = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length >= 4 && line.length <= 120);

  return firstLine || "Unknown role";
}

function pickCompany(rawText: string, metadata?: Record<string, string>): string {
  if (metadata?.company?.trim()) {
    return metadata.company.trim();
  }

  const byCompany = rawText.match(/(?:company|employer)\s*[:\-]\s*([^\n\r]+)/i);
  return byCompany?.[1]?.trim() || "Unknown company";
}

function pickLocation(rawText: string, metadata?: Record<string, string>): string {
  if (metadata?.location?.trim()) {
    return metadata.location.trim();
  }

  const byLocation = rawText.match(/location\s*[:\-]\s*([^\n\r]+)/i);
  if (byLocation?.[1]?.trim()) {
    return byLocation[1].trim();
  }

  const remoteType = detectRemoteType(rawText);
  if (remoteType === "remote") return "Remote";
  if (rawText.toLowerCase().includes("united kingdom") || rawText.toLowerCase().includes("uk")) {
    return "United Kingdom";
  }

  return "Unknown";
}

function extractSentences(rawText: string): string[] {
  return rawText
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function extractListBySignals(rawText: string, signals: string[], limit: number): string[] {
  const sentences = extractSentences(rawText);
  return sentences
    .filter((sentence) =>
      signals.some((signal) => sentence.toLowerCase().includes(signal))
    )
    .slice(0, limit)
    .map((sentence) => sentence.slice(0, 180));
}

function buildDeterministicFallback(
  rawText: string,
  metadata?: Record<string, string>,
  failureKind?: AIFailureKind
): ParsedJobPosting {
  const lower = rawText.toLowerCase();
  const roleTrack = detectRoleTrack(rawText);
  const remoteType = detectRemoteType(rawText);
  const title = pickTitle(rawText, metadata);
  const company = pickCompany(rawText, metadata);
  const location = pickLocation(rawText, metadata);
  const mustHaves = extractListBySignals(
    rawText,
    ["must", "required", "experience with", "responsible for"],
    4
  );
  const niceToHaves = extractListBySignals(
    rawText,
    ["preferred", "nice to have", "bonus", "desirable"],
    3
  );
  const redFlags = [
    ...(lower.includes("sponsorship not available") || lower.includes("right to work required")
      ? ["Possible visa or sponsorship barrier."]
      : []),
    ...(lower.includes("extensive travel") || lower.includes("travel required")
      ? ["Travel requirement may reduce fit for a stable desk-based path."]
      : []),
    ...(lower.includes("laboratory") || lower.includes("lab-based") || lower.includes("bench work")
      ? ["Role appears lab-heavy relative to the target transition path."]
      : []),
    ...(detectSeniority(rawText) === "senior"
      ? ["Seniority expectations may be above the target transition level."]
      : []),
    ...(failureKind === "timeout"
      ? ["AI timeout triggered deterministic fallback parsing."]
      : []),
  ].slice(0, 4);

  const keywordPool = new Set<string>();
  Object.values(TRACK_KEYWORDS).forEach((keywords) => {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        keywordPool.add(keyword);
      }
    }
  });

  if (remoteType !== "unknown") keywordPool.add(remoteType);

  const sentences = extractSentences(rawText);
  const summarySentences = sentences.slice(0, 2);

  return {
    title,
    company,
    location,
    salaryText: extractSalaryText(rawText),
    employmentType: detectEmploymentType(rawText),
    seniority: detectSeniority(rawText),
    remoteType,
    roleFamily:
      roleTrack === "clinical"
        ? "Clinical Operations"
        : roleTrack === "regulatory"
          ? "Regulatory"
          : roleTrack === "qa"
            ? "Quality"
            : roleTrack === "pv"
              ? "Pharmacovigilance"
              : roleTrack === "medinfo"
                ? "Medical Information"
                : "Other",
    roleTrack,
    mustHaves,
    niceToHaves,
    redFlags,
    keywords: Array.from(keywordPool).slice(0, 8),
    summary:
      summarySentences.join(" ").slice(0, 320) ||
      "Structured fallback parsing was used because the local AI runtime did not complete in time.",
    confidence: 0.38,
  };
}

type AITaskErrorResult = {
  error: string;
  failureKind?: AIFailureKind;
  meta?: Partial<AIMetadata>;
};

export async function parseJobPosting(
  rawText: string,
  metadata?: Record<string, string>
): Promise<AIResult<ParsedJobPosting> | AITaskErrorResult> {
  const result = await callAI<ParsedJobPosting>({
    taskType: "parse-job",
    prompt: buildPrompt(rawText, metadata),
    systemPrompt: SYSTEM_PROMPT,
    rawInput: rawText,
    temperature: 0.1,
  });

  if (!result.success || !result.data) {
    const fallback = buildDeterministicFallback(rawText, metadata, result.failureKind);
    return {
      data: fallback,
      meta: {
        model: "deterministic-fallback",
        promptType: "parse-job",
        timestamp: new Date().toISOString(),
        confidence: fallback.confidence,
        durationMs: 0,
        inputBytes: new TextEncoder().encode(rawText).length,
        outputBytes: new TextEncoder().encode(JSON.stringify(fallback)).length,
        fallbackUsed: true,
        fallbackAttempted: result.fallbackAttempted ?? false,
        attemptCount: result.attemptCount ?? 0,
        effectiveTimeoutMs: result.effectiveTimeoutMs ?? 0,
        jsonExtractionFallback: false,
        failureKind: result.failureKind,
      },
      rawInput: rawText,
      rawOutput: JSON.stringify(fallback),
    };
  }

  const validation = validateAIOutput(ParsedJobPostingSchema, result.data);
  if (!validation.valid) {
    console.warn("[parse-job] Schema validation failed:", validation.error);
    const patched = patchParsedJob(result.data as unknown as Record<string, unknown>);
    const revalidation = validateAIOutput(ParsedJobPostingSchema, patched);
    if (!revalidation.valid) {
      const fallback = buildDeterministicFallback(rawText, metadata, "schema_validation");
      return {
        data: fallback,
        meta: {
          ...(result.meta || {
            model: "deterministic-fallback",
            promptType: "parse-job",
            timestamp: new Date().toISOString(),
            confidence: fallback.confidence,
            durationMs: 0,
            inputBytes: new TextEncoder().encode(rawText).length,
            outputBytes: 0,
            fallbackUsed: true,
            fallbackAttempted: false,
            attemptCount: 0,
            effectiveTimeoutMs: 0,
            jsonExtractionFallback: false,
          }),
          model: "deterministic-fallback",
          confidence: fallback.confidence,
          outputBytes: new TextEncoder().encode(JSON.stringify(fallback)).length,
          fallbackUsed: true,
          failureKind: "schema_validation",
        },
        rawInput: rawText,
        rawOutput: JSON.stringify(fallback),
      };
    }
    return {
      data: revalidation.data,
      meta: {
        ...result.meta!,
        confidence: revalidation.data.confidence,
        failureKind: "schema_validation",
      },
      rawInput: rawText,
      rawOutput: result.rawOutput,
    };
  }

  return {
    data: validation.data,
    meta: {
      ...result.meta!,
      confidence: validation.data.confidence,
    },
    rawInput: rawText,
    rawOutput: result.rawOutput,
  };
}

function patchParsedJob(data: Record<string, unknown>): Record<string, unknown> {
  return {
    title: data.title || "Unknown",
    company: data.company || "Unknown",
    location: data.location || "Unknown",
    salaryText: data.salaryText ?? null,
    employmentType: data.employmentType || "unknown",
    seniority: data.seniority || "unknown",
    remoteType: data.remoteType || "unknown",
    roleFamily: data.roleFamily || "other",
    roleTrack: data.roleTrack || "other",
    mustHaves: Array.isArray(data.mustHaves) ? data.mustHaves : [],
    niceToHaves: Array.isArray(data.niceToHaves) ? data.niceToHaves : [],
    redFlags: Array.isArray(data.redFlags) ? data.redFlags : [],
    keywords: Array.isArray(data.keywords) ? data.keywords : [],
    summary: data.summary || "No summary available",
    confidence: typeof data.confidence === "number" ? data.confidence : 0.3,
  };
}
