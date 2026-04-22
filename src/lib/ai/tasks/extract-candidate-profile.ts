import { AIResult } from "@/types";
import { callAI } from "../client";
import {
  CandidateProfileImportSchema,
  validateAIOutput,
} from "../schemas";
import {
  CandidateProfileImportDraft,
  normalizeCandidateProfile,
} from "@/lib/profile/candidate-profile";

const SYSTEM_PROMPT = `You extract candidate profiles from CV text for a local-first career operating system.
Return valid JSON only.
Focus on UK life sciences transition roles and preserve specifics from the CV.
Do not invent certifications or achievements that are not grounded in the source text.`;

function buildPrompt(rawText: string, sourceFiles: string[]): string {
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
    "targetRoleTracks": ["qa | regulatory | pv | medinfo | clinical | other"],
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
${rawText}
---

Respond with JSON only.`;
}

export async function extractCandidateProfile(
  rawText: string,
  sourceFiles: string[]
): Promise<AIResult<CandidateProfileImportDraft> | { error: string }> {
  const result = await callAI<CandidateProfileImportDraft>({
    taskType: "extract-candidate-profile",
    prompt: buildPrompt(rawText, sourceFiles),
    systemPrompt: SYSTEM_PROMPT,
    rawInput: { rawText, sourceFiles },
    temperature: 0.1,
  });

  if (!result.success || !result.data) {
    return { error: result.error || "Candidate profile extraction failed" };
  }

  const validation = validateAIOutput(CandidateProfileImportSchema, result.data);
  if (!validation.valid) {
    return { error: `Validation failed: ${validation.error}` };
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
