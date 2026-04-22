// ============================================================
// AI Task: Rewrite experience highlights to match a job's must-haves.
// Returns tailored highlights as a string array.
// ============================================================

import { ParsedJobPosting } from "@/types";
import { CandidateProfileSeed } from "@/lib/profile/candidate-profile";
import { callAI } from "../client";

const SYSTEM_PROMPT = `You are a professional CV writer specialising in UK life sciences and pharma roles.
Your job is to rewrite a candidate's experience highlights so they directly address the must-have requirements of a specific job.
Keep the same number of bullet points. Each bullet must be concise (under 15 words), start with a strong action verb, and reference a specific skill or achievement that maps to a must-have.
Do not invent qualifications. Only reframe and emphasise what the candidate already has.
Respond with only valid JSON.`;

export async function tailorCV(
  job: ParsedJobPosting,
  profile: CandidateProfileSeed
): Promise<string[]> {
  const prompt = `Rewrite the candidate's experience highlights to match the job's must-have requirements.

JOB: ${job.title} at ${job.company}
MUST-HAVES:
${job.mustHaves.map((m, i) => `${i + 1}. ${m}`).join("\n")}

CURRENT HIGHLIGHTS:
${profile.experienceHighlights.map((h, i) => `${i + 1}. ${h}`).join("\n")}

Return exactly this JSON:
{ "experienceHighlights": ["rewritten highlight 1", "rewritten highlight 2", ...] }

Match one-to-one where possible. Keep the same count (${profile.experienceHighlights.length} bullets).
Respond with ONLY the JSON object.`;

  const result = await callAI<{ experienceHighlights: string[] }>({
    taskType: "tailor-cv",
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    temperature: 0.3,
  });

  if (
    result.success &&
    result.data &&
    Array.isArray(result.data.experienceHighlights) &&
    result.data.experienceHighlights.length > 0
  ) {
    return result.data.experienceHighlights;
  }

  // Fallback: return the original highlights unchanged
  console.warn("[tailor-cv] AI failed — returning original highlights");
  return profile.experienceHighlights;
}
