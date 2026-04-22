// ============================================================
// AI Task: Evaluate job fit against user profile.
// Takes a parsed job and returns a fit assessment.
// ============================================================

import {
  AIFailureKind,
  AIMetadata,
  ParsedJobPosting,
  JobFitEvaluation,
  AIResult,
} from "@/types";
import { callAI } from "../client";
import { JobFitEvaluationSchema, validateAIOutput } from "../schemas";
import { loadUserProfilePromptBlock } from "../user-profile";

const SYSTEM_PROMPT = `You are a career strategy AI specialising in pharmacy-to-industry transitions in the UK life sciences sector.
The candidate is a qualified pharmacist moving OUT of retail/community pharmacy into desk-based regulated industry roles.
Your primary target lanes: Pharmacovigilance (PV), Medical Information, QA/Compliance, Regulatory Affairs, Clinical Operations, Clinical Trial Assistant (CTA).
You must reward roles that leverage community pharmacy transferable skills: GDocP, GCP, adverse event reporting, medicines management, patient triage, Controlled Drug governance.
You must severely penalise roles that keep the candidate in retail/community pharmacy, financial services, or lab-bench science.
Always respond with valid JSON matching the exact schema requested.
Be realistic and strategic — never flattering. This candidate has transferable skills but needs stepping-stone roles, not stretch goals.`;

function buildPrompt(job: ParsedJobPosting, userProfileBlock: string): string {
  return `Evaluate the following job against the user profile below and return a JSON object.

${userProfileBlock}

JOB TO EVALUATE:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Salary: ${job.salaryText || "Not specified"}
Employment Type: ${job.employmentType}
Seniority: ${job.seniority}
Remote Type: ${job.remoteType}
Role Family: ${job.roleFamily}
Role Track: ${job.roleTrack}
Must Haves: ${job.mustHaves.join(", ") || "None listed"}
Nice to Haves: ${job.niceToHaves.join(", ") || "None listed"}
Red Flags: ${job.redFlags.join(", ") || "None"}
Summary: ${job.summary}

Return exactly this JSON structure:
{
  "fitScore": 0-100,
  "redFlagScore": 0-100,
  "priorityBand": "high | medium | low | reject",
  "whyMatched": ["reasons this job is a good fit"],
  "whyNot": ["reasons this job is not ideal"],
  "strategicValue": "string explaining strategic career value",
  "likelyInterviewability": "string assessing chances of getting an interview",
  "actionRecommendation": "string - what to do with this job",
  "confidence": 0.0 to 1.0
}

SCORING GUIDE:
- fitScore 70-100: Strong match for CTA, clinical operations, QA, regulatory, PV, or medinfo transition goals
- fitScore 40-69: Moderate match, worth considering if interviewability and strategic value are still credible
- fitScore 20-39: Weak match, only if nothing better
- fitScore 0-19: Poor match, likely reject

- redFlagScore 0-20: Few concerns
- redFlagScore 21-50: Some concerns worth noting
- redFlagScore 51-100: Significant red flags

SCORING RULES — REWARDS (apply to fitScore):
- Role is in PV, Drug Safety, Medical Information, QA Compliance, Regulatory Submissions, or Clinical Operations: +20
- Role explicitly values GDocP, GCP, adverse event reporting, medicines management, or patient triage: +15
- Stepping-stone role: Clinical Trial Assistant, Trial Coordinator, Study Start-Up, Site Activation, or TMF Coordinator: +15
- Entry/junior/assistant/coordinator seniority that does not require prior industry experience: +10
- Desk-based, remote/hybrid, UK-based or Ireland: +5

SCORING RULES — PENALTIES (apply to fitScore and redFlagScore):
- Role is Community Pharmacy Manager, Locum Pharmacist, Retail Pharmacy, Dispensary Manager, or any pharmacy retail role: fitScore -40, redFlagScore +30 (candidate is deliberately leaving retail)
- Role title or description involves Tax, Accountant, Chartered Tax Advisor, Finance, Audit, or CTA in a financial context: fitScore -50, redFlagScore +40 (hard reject — completely wrong sector)
- Role is lab-heavy bench scientist, molecular biologist, or requires active wet-lab work unrelated to oversight: fitScore -25, redFlagScore +20
- Role requires more than 5 years of industry experience (candidate is transitioning, not making a lateral move): fitScore -20
- Senior/Director/VP with mandatory line management, extensive travel, or employer has strong visa/sponsorship barriers: fitScore -15, redFlagScore +15

Priority bands:
- high: fitScore >= 65 AND redFlagScore < 40
- medium: fitScore >= 40 AND redFlagScore < 60
- low: fitScore >= 20 AND redFlagScore < 70
- reject: everything else

Respond with ONLY the JSON object.`;
}

type AITaskErrorResult = {
  error: string;
  failureKind?: AIFailureKind;
  meta?: Partial<AIMetadata>;
};

// ---- Heuristic fallback (no AI required) ----

const TRACK_BASE_SCORES: Record<string, number> = {
  qa: 65, regulatory: 70, pv: 68, clinical: 72, medinfo: 65, other: 22,
};

const TRACK_LABELS: Record<string, string> = {
  qa: "QA/GMP", regulatory: "Regulatory Affairs", pv: "Pharmacovigilance",
  clinical: "Clinical Operations", medinfo: "Medical Information", other: "Other",
};

function buildHeuristicFallback(job: ParsedJobPosting): JobFitEvaluation {
  const track = job.roleTrack || "other";
  const title = (job.title || "").toLowerCase();
  const seniority = (job.seniority || "").toLowerCase();
  const redFlags = job.redFlags || [];

  let fitScore = TRACK_BASE_SCORES[track] ?? 22;

  // Seniority adjustment
  if (/director|vp\b|vice president|head of/.test(seniority)) fitScore -= 20;
  else if (/senior|manager/.test(seniority)) fitScore -= 10;
  else if (/assistant|associate|coordinator|junior/.test(seniority)) fitScore += 8;

  // Title bonuses for entry-level transition roles
  if (/\b(assistant|associate|coordinator|support|officer)\b/.test(title)) fitScore += 5;

  // Penalise clearly off-track roles
  if (track === "other" && /\b(tax|accountant|software|developer|engineer|scientist|bench)\b/.test(title)) {
    fitScore -= 15;
  }

  let redFlagScore = Math.min(100, redFlags.length * 10);
  if (/director|vp\b/.test(seniority)) redFlagScore += 15;
  if (job.mustHaves?.some(m => /visa|sponsor/i.test(m))) redFlagScore += 20;
  redFlagScore = Math.min(100, redFlagScore);

  fitScore = Math.max(0, Math.min(100, fitScore));

  let priorityBand: JobFitEvaluation["priorityBand"];
  if (fitScore >= 65 && redFlagScore < 40) priorityBand = "high";
  else if (fitScore >= 40 && redFlagScore < 60) priorityBand = "medium";
  else if (fitScore >= 20 && redFlagScore < 70) priorityBand = "low";
  else priorityBand = "reject";

  const trackLabel = TRACK_LABELS[track] ?? track;
  const inTarget = track !== "other";

  return {
    fitScore,
    redFlagScore,
    priorityBand,
    whyMatched: inTarget
      ? [`${trackLabel} track aligns with transition targets (heuristic)`]
      : [],
    whyNot: !inTarget
      ? ["Role track is outside primary transition targets (heuristic)"]
      : redFlagScore > 30
      ? ["Some red flags detected — review before applying"]
      : [],
    strategicValue: inTarget
      ? `${trackLabel} experience builds toward career transition goals`
      : "Limited strategic value for current transition targets",
    likelyInterviewability:
      fitScore >= 65 ? "Good — profile-role alignment looks strong"
      : fitScore >= 40 ? "Moderate — some alignment, review gaps"
      : "Low — significant gap between profile and role",
    actionRecommendation:
      priorityBand === "high" ? "Prioritise — apply soon"
      : priorityBand === "medium" ? "Review and consider applying"
      : priorityBand === "low" ? "Optional — apply only if nothing better"
      : "Skip — outside transition targets",
    confidence: 0.3,
  };
}

// ---- Main export ----

export async function evaluateJobFit(
  job: ParsedJobPosting
): Promise<AIResult<JobFitEvaluation> | AITaskErrorResult> {
  const userProfileBlock = await loadUserProfilePromptBlock();
  const result = await callAI<JobFitEvaluation>({
    taskType: "evaluate-job",
    prompt: buildPrompt(job, userProfileBlock),
    systemPrompt: SYSTEM_PROMPT,
    rawInput: job,
    temperature: 0.1,
  });

  if (result.success && result.data) {
    const validation = validateAIOutput(JobFitEvaluationSchema, result.data);
    if (validation.valid) {
      return {
        data: validation.data,
        meta: { ...result.meta!, confidence: validation.data.confidence },
        rawInput: job,
        rawOutput: result.rawOutput,
      };
    }
    console.warn("[evaluate-job] Schema validation failed — using heuristic fallback:", validation.error);
  } else {
    console.warn(`[evaluate-job] AI failed (${result.failureKind ?? "unknown"}) — using heuristic fallback`);
  }

  // Heuristic fallback: always produces a usable score
  const fallback = buildHeuristicFallback(job);
  return {
    data: fallback,
    meta: {
      model: "heuristic",
      promptType: "evaluate-job",
      timestamp: new Date().toISOString(),
      confidence: fallback.confidence,
      durationMs: 0,
      inputBytes: 0,
      outputBytes: 0,
      fallbackUsed: true,
      fallbackAttempted: true,
      attemptCount: result.attemptCount ?? 1,
      effectiveTimeoutMs: 0,
      jsonExtractionFallback: false,
      failureKind: result.failureKind,
    },
    rawInput: job,
    rawOutput: undefined,
  };
}
