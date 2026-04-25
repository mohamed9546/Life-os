import { AIResult } from "@/types";
import { callAI } from "../client";
import { callPythonAI, isPythonAIEnabled } from "../python-sidecar";
import {
  CandidateProfileImportSchema,
  validateAIOutput,
} from "../schemas";
import {
  CandidateProfileImportDraft,
  getDefaultCandidateProfile,
  normalizeCandidateProfile,
} from "@/lib/profile/candidate-profile";

const AI_CV_TEXT_LIMIT = 12_000;
const ROLE_TRACKS = [
  "qa",
  "regulatory",
  "pv",
  "medinfo",
  "clinical",
  "other",
] as const;

const SYSTEM_PROMPT = `You extract candidate profiles from CV text for a local-first career operating system.
Return valid JSON only.
Focus on UK life sciences transition roles and preserve specifics from the CV.
Do not invent certifications or achievements that are not grounded in the source text.`;

function buildPrompt(rawText: string, sourceFiles: string[]): string {
  const cvText = truncateForPrompt(rawText);

  return `Extract a normalized candidate profile draft from this CV text.

Return exactly:
{
  "rawText": "the original text summarized or truncated only if necessary",
  "profile": {
    "fullName": "string",
    "headline": "string",
    "location": "string",
    "openToRelocationUk": true,
    "summary": "string",
    "targetTitles": ["string"],
    "targetRoleTracks": ["clinical", "regulatory"],
    "locationConstraints": ["string"],
    "transitionNarrative": "string",
    "strengths": ["string"],
    "experienceHighlights": ["string"],
    "education": ["string"],
    "sourceCvIds": ["string"],
    "extraction": {
      "reviewState": "draft",
      "confidence": 0.0,
      "issues": ["string"],
      "extractedAt": "ISO string",
      "sourceFiles": ["string"]
    }
  },
  "confidence": 0.0,
  "issues": ["string"],
  "sourceFiles": ["string"],
  "extractedAt": "ISO string"
}

SOURCE FILES:
${sourceFiles.map((item) => `- ${item}`).join("\n")}

CV TEXT:
---
${cvText}
---

Respond with JSON only.`;
}

function truncateForPrompt(rawText: string): string {
  if (rawText.length <= AI_CV_TEXT_LIMIT) {
    return rawText;
  }

  return `${rawText.slice(0, AI_CV_TEXT_LIMIT)}

[CV text truncated for AI extraction. Preserve only facts visible above.]`;
}

export async function extractCandidateProfile(
  rawText: string,
  sourceFiles: string[]
): Promise<AIResult<CandidateProfileImportDraft> | { error: string }> {
  if (isPythonAIEnabled()) {
    try {
      const result = await callPythonAI<
        { rawText: string; sourceFiles: string[] },
        {
          success: boolean;
          data?: CandidateProfileImportDraft;
          meta?: AIResult<CandidateProfileImportDraft>["meta"];
          error?: string;
        }
      >(
        "/extract-candidate-profile",
        { rawText, sourceFiles },
        360_000
      );

      if (result.success && result.data && result.meta) {
        return {
          data: {
            ...result.data,
            profile: normalizeCandidateProfile(result.data.profile),
          },
          meta: result.meta,
          rawInput: { rawText, sourceFiles },
          rawOutput: "",
        };
      }

      console.warn(
        "[extract-candidate-profile] Python sidecar returned failure, falling back to TS:",
        result.error
      );
    } catch (err) {
      console.warn(
        "[extract-candidate-profile] Python sidecar call failed, falling back to TS:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const result = await callAI<CandidateProfileImportDraft>({
    taskType: "extract-candidate-profile",
    prompt: buildPrompt(rawText, sourceFiles),
    systemPrompt: SYSTEM_PROMPT,
    rawInput: { rawText: truncateForPrompt(rawText), sourceFiles },
    temperature: 0.1,
  });

  if (!result.success || !result.data) {
    return buildHeuristicDraft(
      rawText,
      sourceFiles,
      result.error || "Candidate profile extraction failed"
    );
  }

  // Local 2B-7B Ollama models occasionally return a JSON array, a quoted
  // string, or markdown wrapping the object. Zod validation against
  // those shapes throws downstream errors (incl. the V8
  // "Object.defineProperty called on non-object" surface from the
  // candidate-profile UI). Reject non-object payloads up-front with a
  // clear message instead.
  const data: unknown = result.data;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return buildHeuristicDraft(
      rawText,
      sourceFiles,
      "AI returned a non-object payload for candidate profile extraction."
    );
  }

  const validation = validateAIOutput(
    CandidateProfileImportSchema,
    repairCandidateProfileImport(data)
  );
  if (!validation.valid) {
    return buildHeuristicDraft(
      rawText,
      sourceFiles,
      `AI validation failed: ${validation.error}`
    );
  }

  return {
    data: {
      ...validation.data,
      profile: normalizeCandidateProfile(validation.data.profile),
    },
    meta: {
      ...result.meta!,
      confidence: validation.data.confidence,
    },
    rawInput: { rawText, sourceFiles },
    rawOutput: result.rawOutput,
  };
}

function repairCandidateProfileImport(data: unknown): unknown {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }

  const candidate = data as {
    profile?: {
      targetRoleTracks?: unknown;
    };
  };

  if (candidate.profile && typeof candidate.profile === "object") {
    candidate.profile = {
      ...candidate.profile,
      targetRoleTracks: coerceRoleTracks(candidate.profile.targetRoleTracks),
    };
  }

  return candidate;
}

function coerceRoleTracks(value: unknown): string[] {
  const inputs = Array.isArray(value) ? value : [value];
  const tracks = inputs.flatMap((item) =>
    typeof item === "string" ? item.split(/[|,/]/).map((part) => part.trim()) : []
  );
  const validTracks = tracks.filter((track): track is (typeof ROLE_TRACKS)[number] =>
    (ROLE_TRACKS as readonly string[]).includes(track)
  );

  return validTracks.length > 0 ? unique(validTracks) : ["other"];
}

function buildHeuristicDraft(
  rawText: string,
  sourceFiles: string[],
  reason: string
): AIResult<CandidateProfileImportDraft> {
  const extractedAt = new Date().toISOString();
  const defaults = getDefaultCandidateProfile();
  const lines = getUsefulLines(rawText);
  const fullName = inferFullName(lines) || defaults.fullName;
  const headline = inferHeadline(lines) || defaults.headline;
  const location = inferLocation(lines) || defaults.location;
  const education = inferEducation(lines, defaults.education);
  const strengths = inferStrengths(rawText, defaults.strengths);
  const experienceHighlights = inferExperienceHighlights(
    lines,
    defaults.experienceHighlights
  );

  const draft: CandidateProfileImportDraft = {
    rawText,
    profile: normalizeCandidateProfile({
      ...defaults,
      fullName,
      headline,
      location,
      summary: buildSummary(fullName, headline, location, education),
      strengths,
      experienceHighlights,
      education,
      sourceCvIds: sourceFiles,
      extraction: {
        reviewState: "draft",
        confidence: 0.35,
        issues: [
          `AI extraction did not complete cleanly, so this draft was created from basic CV text parsing. Original error: ${reason}`,
        ],
        extractedAt,
        sourceFiles,
      },
    }),
    confidence: 0.35,
    issues: [
      `AI extraction did not complete cleanly, so this draft needs review. Original error: ${reason}`,
    ],
    sourceFiles,
    extractedAt,
  };

  return {
    data: draft,
    meta: {
      model: "heuristic-fallback",
      promptType: "extract-candidate-profile",
      timestamp: extractedAt,
      confidence: draft.confidence,
      durationMs: 0,
      inputBytes: new TextEncoder().encode(rawText).length,
      outputBytes: 0,
      fallbackUsed: true,
      fallbackAttempted: true,
      attemptCount: 1,
      effectiveTimeoutMs: 0,
      jsonExtractionFallback: false,
    },
    rawInput: { rawText, sourceFiles },
    rawOutput: "",
  };
}

function getUsefulLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 2 && line.length <= 160)
    .slice(0, 80);
}

function inferFullName(lines: string[]): string {
  const candidate = lines.find(
    (line) =>
      /^[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,3}$/.test(line) &&
      !/(curriculum|vitae|resume|profile|contact|education|experience)/i.test(line)
  );
  return candidate || "";
}

function inferHeadline(lines: string[]): string {
  return (
    lines.find(
      (line) =>
        /clinical|research|trial|regulatory|quality|pharmacovigilance|medical information|CRA|CTA/i.test(
          line
        ) && !/@/.test(line)
    ) || ""
  );
}

function inferLocation(lines: string[]): string {
  return (
    lines.find((line) => /glasgow|scotland|london|uk|united kingdom|egypt/i.test(line)) ||
    ""
  );
}

function inferEducation(rawLines: string[], defaults: string[]): string[] {
  const education = rawLines.filter((line) =>
    /\b(MSc|BSc|PhD|Bachelor|Master|University|College|GCP)\b/i.test(line)
  );
  return unique([...education.slice(0, 8), ...defaults]);
}

function inferStrengths(rawText: string, defaults: string[]): string[] {
  const candidates = [
    ["GCP training", /\bGCP\b|good clinical practice/i],
    ["Clinical research coordination", /clinical research|trial coordination|CTA|CRA/i],
    ["Regulated healthcare documentation", /documentation|SOP|compliance|audit/i],
    ["Regulatory and quality awareness", /regulatory|quality|QA|GxP/i],
    ["Pharmacovigilance awareness", /pharmacovigilance|drug safety|PV/i],
  ] as const;

  return unique([
    ...candidates
      .filter(([, pattern]) => pattern.test(rawText))
      .map(([label]) => label),
    ...defaults,
  ]).slice(0, 10);
}

function inferExperienceHighlights(lines: string[], defaults: string[]): string[] {
  const highlights = lines.filter((line) =>
    /intern|assistant|coordinator|research|clinical|hospital|pharma|laboratory|trial/i.test(
      line
    )
  );
  return unique([...highlights.slice(0, 8), ...defaults]).slice(0, 10);
}

function buildSummary(
  fullName: string,
  headline: string,
  location: string,
  education: string[]
): string {
  const subject = fullName || "Candidate";
  const headlineText = headline
    ? ` with CV evidence around ${headline}`
    : " with CV evidence for regulated life sciences transition roles";
  const locationText = location ? ` Based in or connected to ${location}.` : "";
  const educationText = education.length > 0 ? ` Education/training: ${education[0]}.` : "";
  return `${subject}${headlineText}.${locationText}${educationText}`.trim();
}

function unique(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  );
}
