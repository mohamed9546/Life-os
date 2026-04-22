// ============================================================
// AI-powered outreach strategy generator.
// Takes a job + company intel + decision makers and generates
// a personalized outreach plan.
// ============================================================

import { OutreachStrategy, CompanyIntel, DecisionMaker, ParsedJobPosting } from "@/types";
import { callAI } from "@/lib/ai/client";
import { z } from "zod";
import { validateAIOutput } from "@/lib/ai/schemas";
import { loadUserProfilePromptBlock } from "@/lib/ai/user-profile";

const OutreachStrategySchema = z.object({
  recommendedAction: z.string(),
  targetContacts: z.array(
    z.object({
      name: z.string(),
      title: z.string(),
      email: z.string().optional(),
      linkedinUrl: z.string().optional(),
      approachSuggestion: z.string(),
    })
  ),
  emailDraft: z.string().optional(),
  linkedinMessageDraft: z.string().optional(),
  timing: z.string(),
  confidence: z.number().min(0).max(1),
});

const SYSTEM_PROMPT = `You are a career strategist specializing in job application outreach.
Generate personalized, professional outreach strategies.
Focus on warm approaches, not cold spam.
Always respond with valid JSON only.`;

export async function generateOutreachStrategy(
  job: ParsedJobPosting,
  companyIntel: CompanyIntel | null,
  decisionMakers: DecisionMaker[]
): Promise<OutreachStrategy | null> {
  const userProfileBlock = await loadUserProfilePromptBlock();
  const contactsBlock =
    decisionMakers.length > 0
      ? `
DECISION MAKERS FOUND AT ${job.company}:
${decisionMakers
  .slice(0, 5)
  .map(
    (dm) =>
      `- ${dm.fullName} — ${dm.title}${dm.email ? ` (${dm.email})` : ""}${dm.linkedinUrl ? ` [LinkedIn: ${dm.linkedinUrl}]` : ""}`
  )
  .join("\n")}`
      : "\nNo specific decision makers found yet.";

  const companyBlock = companyIntel
    ? `
COMPANY INTEL:
- Industry: ${companyIntel.industry || "Unknown"}
- Size: ${companyIntel.employeeRange || companyIntel.employeeCount || "Unknown"}
- Founded: ${companyIntel.founded || "Unknown"}
- Location: ${companyIntel.location || "Unknown"}
- Description: ${companyIntel.description || "None"}
- Tech Stack: ${companyIntel.techStack?.join(", ") || "Unknown"}
- Annual Revenue: ${companyIntel.annualRevenue || "Unknown"}`
    : "\nNo company intel available.";

  const prompt = `Generate an outreach strategy for this job application:

JOB:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Role Track: ${job.roleTrack}

${userProfileBlock}

${companyBlock}
${contactsBlock}

Return exactly this JSON structure:
{
  "recommendedAction": "specific action to take — e.g. apply directly, reach out to X first, network via LinkedIn, etc.",
  "targetContacts": [
    {
      "name": "contact name",
      "title": "their title",
      "email": "email if known",
      "linkedinUrl": "linkedin URL if known",
      "approachSuggestion": "specific suggestion for reaching this person"
    }
  ],
  "emailDraft": "draft email to the most relevant contact (if email available)",
  "linkedinMessageDraft": "draft LinkedIn connection request message",
  "timing": "when to send and follow up",
  "confidence": 0.0 to 1.0
}

Respond with ONLY the JSON object.`;

  const result = await callAI<OutreachStrategy>({
    taskType: "generate-outreach",
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    rawInput: { job: job.title, company: job.company },
    temperature: 0.3,
  });

  if (!result.success || !result.data) return null;

  const validation = validateAIOutput(OutreachStrategySchema, result.data);
  if (!validation.valid) return null;

  return validation.data;
}
