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
import { evaluateRawJobRelevance } from "@/lib/jobs/pipeline/relevance";

const SYSTEM_PROMPT = `You are a career strategy AI specialising in entry-level UK life sciences, clinical operations, QA, regulatory, pharmacovigilance, and medical information transitions.
Treat the candidate as entry/support-level, not senior. They have MSc Clinical Pharmacology, GCP training, clinical research internship exposure, regulated healthcare documentation experience, SOP/compliance-heavy workflow exposure, and governance/controlled-document exposure.
Strong-fit work includes regulated documentation, clinical trial support, study coordination, SOP/compliance-heavy admin, healthcare administration, research governance, and regulated support functions.
Primary target titles: Clinical Trial Assistant, Clinical Research Coordinator, Clinical Operations Assistant/Coordinator, Clinical Study Assistant/Coordinator, Study Start-Up Assistant/Coordinator, Site Activation Assistant/Coordinator, Trial Administrator, Clinical Project Assistant, In-House CRA, and Junior CRA only if clearly junior/entry-level.
Secondary target titles: QA Associate, Quality Systems Associate, Document Control Associate, Regulatory Affairs Assistant, Regulatory Operations Assistant, Pharmacovigilance Associate, Drug Safety Associate, Medical Information Associate, Research Governance, and Research Support.
Severely penalise tax/accounting/payroll/finance operations, legal assistant roles, wet-lab execution, field sales/territory roles, GPhC-essential roles, community-pharmacy-only roles, and senior/leadership roles.
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
  "actionRecommendation": "apply now | apply if time | skip",
  "visaRisk": "green | amber | red",
  "confidence": 0.0 to 1.0
}

VISA RISK LOGIC:
- green: No explicit anti-visa wording, no permanent-right-to-work restriction
- amber: "no sponsorship available", "must already have right to work", ambiguous but not explicitly anti-visa
- red: "cannot hire visa holders", "must have permanent right to work", "no candidates on visas", "must not require sponsorship now or in future"

ACTION RECOMMENDATION LOGIC:
- apply now = strong fit, manageable risk, strategically valuable
- apply if time = medium fit or amber constraints
- skip = weak fit, irrelevant family, or strong visa/seniority mismatch

SCORING GUIDE:
- fitScore 70-100: Strong match for CTA, clinical operations, QA, regulatory, PV, or medinfo transition goals
- fitScore 40-69: Moderate match, worth considering if interviewability and strategic value are still credible
- fitScore 20-39: Weak match, only if nothing better
- fitScore 0-19: Poor match, likely reject

- redFlagScore 0-20: Few concerns
- redFlagScore 21-50: Some concerns worth noting
- redFlagScore 51-100: Significant red flags

SCORING RULES — REWARDS (apply to fitScore):
- Primary target role: Clinical Trial Assistant, Clinical Research Coordinator, Clinical Operations Assistant/Coordinator, Clinical Study Assistant/Coordinator, Study Start-Up, Site Activation, Trial Administrator, Clinical Project Assistant, In-House CRA, or clearly junior CRA: +25
- Secondary target role: QA Associate, Quality Systems Associate, Document Control, Regulatory Affairs/Operations Assistant, Pharmacovigilance/Drug Safety Associate, Medical Information Associate, Research Governance, or Research Support: +18
- Role explicitly values ICH-GCP, GCP, TMF/eTMF, ISF, essential documents, CTMS, SOP, protocol compliance, submissions support, filing/archiving, audit readiness, governance, or clinical documentation: +15
- Entry/junior/assistant/coordinator/support/administrator seniority that does not require prior industry experience: +12
- Glasgow, Scotland, UK remote/hybrid, or strong London hybrid fit: +5

SCORING RULES — PENALTIES (apply to fitScore and redFlagScore):
- Role is Community Pharmacy Manager, Locum Pharmacist, Retail Pharmacy, Dispensary Manager, or any pharmacy retail role: fitScore -40, redFlagScore +30 (candidate is deliberately leaving retail)
- Role title or description involves Tax, Accountant, Chartered Tax Advisor, Finance, Audit, or CTA in a financial context: fitScore -50, redFlagScore +40 (hard reject — completely wrong sector)
- Role is lab-heavy bench scientist, molecular biologist, or requires active wet-lab work unrelated to oversight: fitScore -25, redFlagScore +20
- Role requires more than 5 years of industry experience (candidate is transitioning, not making a lateral move): fitScore -20
- Senior/Director/VP with mandatory line management, extensive travel, or employer has strong visa/sponsorship barriers: fitScore -15, redFlagScore +15
- Field sales, territory manager, business development representative, legal assistant, insurance, claims handler, veterinary, dental sales, or GPhC-registration-essential roles: fitScore -50, redFlagScore +40
- Ireland-relevant roles can be flagged, but should not rank above strong UK/Scotland/London-hybrid matches unless explicitly requested.

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
  const relevance = evaluateRawJobRelevance({
    source: "parsed",
    title: job.title,
    company: job.company,
    location: job.location,
    salaryText: job.salaryText || undefined,
    link: "",
    employmentType: job.employmentType,
    remoteType: job.remoteType,
    description: [
      job.summary,
      ...job.mustHaves,
      ...job.niceToHaves,
      ...job.redFlags,
      ...job.keywords,
    ].join("\n"),
    fetchedAt: new Date().toISOString(),
  });
  const track = job.roleTrack || "other";
  const title = (job.title || "").toLowerCase();
  const seniority = (job.seniority || "").toLowerCase();
  const redFlags = job.redFlags || [];

  let fitScore = TRACK_BASE_SCORES[track] ?? 22;
  fitScore += Math.round(relevance.bonus * 0.7);
  fitScore -= Math.round(relevance.penalty * 0.8);
  if (relevance.hardReject) fitScore -= 60;
  if (relevance.irelandRelevant) fitScore -= 8;

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
  redFlagScore += Math.min(60, Math.round(relevance.penalty * 0.5));
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
      priorityBand === "high" ? "apply now"
      : priorityBand === "medium" ? "apply if time"
      : "skip",
    visaRisk: redFlagScore > 40 ? "red" : redFlagScore > 20 ? "amber" : "green",
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
