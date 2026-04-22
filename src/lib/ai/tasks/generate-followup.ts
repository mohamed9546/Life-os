// ============================================================
// AI Task: Generate a follow-up plan for a tracked job.
// ============================================================

import { ParsedJobPosting, FollowUpPlan, AIResult } from "@/types";
import { callAI } from "../client";
import { FollowUpPlanSchema, validateAIOutput } from "../schemas";

const SYSTEM_PROMPT = `You are a job search strategy assistant.
Generate practical, specific follow-up plans for job applications.
Always respond with valid JSON only.`;

function buildPrompt(
  job: ParsedJobPosting,
  appliedDate?: string
): string {
  return `Generate a follow-up plan for this job application:

Job: ${job.title} at ${job.company}
Location: ${job.location}
${appliedDate ? `Applied: ${appliedDate}` : "Not yet applied"}

Return exactly:
{
  "nextAction": "specific next step to take",
  "followUpDateSuggestion": "ISO date string for when to follow up",
  "rationale": "why this timing and approach",
  "customNotes": "any additional strategic notes"
}

Respond with ONLY the JSON object.`;
}

export async function generateFollowUpPlan(
  job: ParsedJobPosting,
  appliedDate?: string
): Promise<AIResult<FollowUpPlan> | { error: string }> {
  const result = await callAI<FollowUpPlan>({
    taskType: "generate-followup",
    prompt: buildPrompt(job, appliedDate),
    systemPrompt: SYSTEM_PROMPT,
    rawInput: job,
    temperature: 0.15,
  });

  if (!result.success || !result.data) {
    return { error: result.error || "Follow-up plan generation failed" };
  }

  const validation = validateAIOutput(FollowUpPlanSchema, result.data);
  if (!validation.valid) {
    return { error: `Validation failed: ${validation.error}` };
  }

  return {
    data: validation.data,
    meta: { ...result.meta!, confidence: 0.7 },
    rawInput: job,
    rawOutput: result.rawOutput,
  };
}
