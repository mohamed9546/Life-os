// ============================================================
// AI Task: Generate a personalised LinkedIn connection request.
// 280 characters max. References specific company details.
// ============================================================

import { DecisionMaker, ParsedJobPosting, CompanyIntel } from "@/types";
import { callAI } from "../client";

const SYSTEM_PROMPT = `You write LinkedIn connection requests for job seekers in UK life sciences.
Be concise, warm, and specific. Reference something real about the company or role.
Never use generic templates like "I came across your profile". Never use em-dashes.
Maximum 280 characters. Output only the message text — no quotes, no explanation.`;

function buildCompanyContext(company: CompanyIntel | null): string {
  if (!company) return "";
  const parts: string[] = [];
  if (company.description) parts.push(company.description.slice(0, 120));
  else {
    if (company.industry) parts.push(`Industry: ${company.industry}`);
    if (company.latestFundingRound) parts.push(`Recent funding: ${company.latestFundingRound}`);
    if (company.employeeRange) parts.push(`Size: ${company.employeeRange} employees`);
  }
  return parts.join(". ");
}

export async function generateLinkedInIntro(
  person: DecisionMaker,
  job: ParsedJobPosting,
  companyIntel: CompanyIntel | null
): Promise<string> {
  const companyContext = buildCompanyContext(companyIntel);

  const prompt = `Write a LinkedIn connection request to ${person.firstName || person.fullName} (${person.title}) at ${job.company}.

Job I am interested in: ${job.title} (${job.roleFamily}, ${job.remoteType})
${companyContext ? `Company context: ${companyContext}` : ""}

The candidate is a pharmacist transitioning into life sciences industry roles.
They have pharmacy, GDocP, and clinical knowledge transferable to ${job.roleFamily} roles.

Write a personalised 1-2 sentence connection request. Must be under 280 characters.
Output only the message text.`;

  const result = await callAI<string>({
    taskType: "linkedin-intro",
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    rawTextOutput: true,
    temperature: 0.7,
  });

  if (result.success && typeof result.data === "string" && result.data.trim()) {
    const text = result.data.trim().replace(/^["']|["']$/g, "");
    return text.slice(0, 280);
  }

  // Fallback template
  const fallback = `Hi ${person.firstName || person.fullName}, I'm a pharmacist transitioning into ${job.roleFamily} and came across the ${job.title} role at ${job.company}. I'd love to connect!`;
  return fallback.slice(0, 280);
}
