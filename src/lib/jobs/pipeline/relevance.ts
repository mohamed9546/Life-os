import { EnrichedJob, RawJobItem } from "@/types";

export type RoleFamily =
  | "clinical-operations"
  | "qa"
  | "regulatory"
  | "pv"
  | "medinfo"
  | "research-governance"
  | "finance-tax"
  | "wet-lab"
  | "field-sales"
  | "legal"
  | "retail-pharmacy"
  | "other";

export interface RelevanceGateResult {
  roleFamily: RoleFamily;
  regulatedHealthcareRelevance: "strong" | "partial" | "weak" | "irrelevant";
  seniority: "entry-support" | "mid" | "senior" | "unknown";
  supportNature: "support" | "individual-contributor" | "leadership" | "unknown";
  hardReject: boolean;
  penalty: number;
  bonus: number;
  reasons: string[];
  irelandRelevant: boolean;
}

const PRIMARY_TITLE_TERMS = [
  "clinical trial assistant",
  "clinical research coordinator",
  "clinical operations assistant",
  "clinical operations coordinator",
  "clinical study assistant",
  "clinical study coordinator",
  "study start-up assistant",
  "study start-up coordinator",
  "study startup assistant",
  "study startup coordinator",
  "site activation assistant",
  "site activation coordinator",
  "trial administrator",
  "clinical project assistant",
  "in-house cra",
  "junior cra",
];

const SECONDARY_TITLE_TERMS = [
  "qa associate",
  "quality systems associate",
  "document control associate",
  "regulatory affairs assistant",
  "regulatory operations assistant",
  "pharmacovigilance associate",
  "drug safety associate",
  "medical information associate",
  "research governance",
  "research support",
];

const POSITIVE_TERMS = [
  "ich-gcp",
  "gcp",
  "tmf",
  "etmf",
  "isf",
  "essential documents",
  "study start-up",
  "startup",
  "site activation",
  "clinical operations",
  "protocol compliance",
  "study coordination",
  "trial coordination",
  "clinical documentation",
  "document management",
  "audit readiness",
  "ctms",
  "administrative support",
  "project coordination",
  "sop",
  "compliance",
  "document control",
  "trial master file",
  "investigator site file",
  "feasibility",
  "site management support",
  "clinical project support",
  "research support",
  "governance",
  "study admin",
  "submissions support",
  "filing",
  "archiving",
];

const SUPPORT_TERMS = [
  "assistant",
  "associate",
  "coordinator",
  "support",
  "administrator",
  "project assistant",
  "entry level",
  "junior",
  "trainee",
  "graduate",
];

const SENIOR_TERMS = [
  "senior",
  "lead",
  "principal",
  "director",
  "head of",
  "line management",
  "5+ years",
  "7+ years",
];

const FINANCE_TERMS = [
  "tax",
  "tax assistant",
  "tax analyst",
  "accountant",
  "finance analyst",
  "payroll",
  "audit trainee",
  "financial audit",
];

const WET_LAB_TERMS = [
  "microbiologist",
  "laboratory scientist",
  "lab technician",
  "wet lab",
  "bench scientist",
  "biomedical scientist",
  "molecular biologist",
];

const OTHER_HARD_NEGATIVES = [
  "field sales",
  "sales representative",
  "territory manager",
  "business development representative",
  "legal assistant",
  "superintendent pharmacist",
  "gphc registration essential",
  "veterinary",
  "dental sales",
  "insurance",
  "claims handler",
  "care assistant",
  "health care assistant",
  "healthcare assistant",
  "support worker",
  "caregiver",
  "carer",
  "nursing home",
];

export function evaluateRawJobRelevance(raw: RawJobItem): RelevanceGateResult {
  return evaluateTextRelevance([
    raw.title,
    raw.company,
    raw.location,
    raw.description || "",
    raw.employmentType || "",
    raw.remoteType || "",
  ].join("\n"));
}

export function evaluateEnrichedJobRelevance(job: EnrichedJob): RelevanceGateResult {
  return evaluateTextRelevance([
    job.raw.title,
    job.raw.company,
    job.raw.location,
    job.raw.description || "",
    job.parsed?.data?.roleFamily || "",
    job.parsed?.data?.roleTrack || "",
    job.parsed?.data?.summary || "",
    ...(job.parsed?.data?.keywords || []),
    ...(job.parsed?.data?.mustHaves || []),
    ...(job.parsed?.data?.redFlags || []),
  ].join("\n"));
}

function evaluateTextRelevance(text: string): RelevanceGateResult {
  const normalized = text.toLowerCase();
  const titleLine = normalized.split(/\r?\n/)[0] || normalized;
  const reasons: string[] = [];
  let bonus = 0;
  let penalty = 0;
  let roleFamily: RoleFamily = "other";
  let hardReject = false;

  const primaryMatches = findMatches(titleLine, PRIMARY_TITLE_TERMS);
  const secondaryMatches = findMatches(titleLine, SECONDARY_TITLE_TERMS);
  const positiveMatches = findMatches(normalized, POSITIVE_TERMS);
  const supportMatches = findMatches(normalized, SUPPORT_TERMS);
  const seniorMatches = findMatches(titleLine, SENIOR_TERMS);

  if (/clinical trial|clinical research|clinical operations|study start|site activation|trial administrator|trial master file|\btmf\b|\betmf\b|\bcra\b/.test(normalized)) {
    roleFamily = "clinical-operations";
  } else if (/quality assurance|quality systems|document control|\bqms\b|\bgmp\b|gdocp/.test(normalized)) {
    roleFamily = "qa";
  } else if (/regulatory|submissions|mhra|ema/.test(normalized)) {
    roleFamily = "regulatory";
  } else if (/pharmacovigilance|drug safety|adverse event|icsr|argus/.test(normalized)) {
    roleFamily = "pv";
  } else if (/medical information|medical affairs/.test(normalized)) {
    roleFamily = "medinfo";
  } else if (/research governance|research support/.test(normalized)) {
    roleFamily = "research-governance";
  }

  if (matchesAny(normalized, FINANCE_TERMS)) {
    roleFamily = "finance-tax";
    hardReject = true;
    reasons.push("Rejected: finance/tax/accounting language dominates the role.");
  }

  if (matchesAny(normalized, WET_LAB_TERMS) && !/governance|admin|coordinator|support|document|trial/.test(normalized)) {
    roleFamily = "wet-lab";
    hardReject = true;
    reasons.push("Rejected: wet-lab or biomedical scientist execution role.");
  }

  if (matchesAny(normalized, ["field sales", "sales representative", "territory manager", "business development representative"])) {
    roleFamily = "field-sales";
    hardReject = true;
    reasons.push("Rejected: field sales or territory coverage role.");
  }

  if (matchesAny(normalized, ["legal assistant"])) {
    roleFamily = "legal";
    hardReject = true;
    reasons.push("Rejected: legal/admin role outside regulated healthcare target lanes.");
  }

  if (matchesAny(normalized, ["community pharmacy", "retail pharmacy", "locum pharmacist", "dispensary", "superintendent pharmacist"])) {
    roleFamily = "retail-pharmacy";
    hardReject = true;
    reasons.push("Rejected: community-pharmacy-only role.");
  }

  if (/gphc registration (is )?(required|essential)|registration with the gphc (is )?(required|essential)/.test(normalized)) {
    hardReject = true;
    reasons.push("Rejected: GPhC registration is essential.");
  }

  if (matchesAny(normalized, OTHER_HARD_NEGATIVES)) {
    hardReject = true;
    penalty += 80;
    reasons.push("Rejected by strict negative keyword heuristic.");
  }

  if (seniorMatches.length > 0 && !/assistant manager|project support|support manager/.test(normalized)) {
    hardReject = true;
    penalty += 70;
    reasons.push(`Rejected: seniority exceeds target support level (${seniorMatches[0]}).`);
  }

  if (primaryMatches.length > 0) {
    bonus += 45;
    reasons.push(`Primary target title: ${primaryMatches[0]}.`);
  } else if (secondaryMatches.length > 0) {
    bonus += 30;
    reasons.push(`Secondary target title: ${secondaryMatches[0]}.`);
  }

  bonus += Math.min(positiveMatches.length * 5, 35);
  if (positiveMatches.length > 0) {
    reasons.push(`Positive regulated-healthcare signals: ${positiveMatches.slice(0, 5).join(", ")}.`);
  }

  if (supportMatches.length > 0) {
    bonus += 12;
    reasons.push(`Entry/support seniority signal: ${supportMatches[0]}.`);
  }

  const regulatedHealthcareRelevance =
    roleFamily === "other"
      ? positiveMatches.length >= 2
        ? "partial"
        : "weak"
      : ["finance-tax", "wet-lab", "field-sales", "legal", "retail-pharmacy"].includes(roleFamily)
        ? "irrelevant"
        : positiveMatches.length >= 2 || primaryMatches.length > 0 || secondaryMatches.length > 0
          ? "strong"
          : "partial";

  const seniority =
    seniorMatches.length > 0
      ? "senior"
      : supportMatches.length > 0
        ? "entry-support"
        : /mid|experienced/.test(normalized)
          ? "mid"
          : "unknown";

  const supportNature =
    seniority === "senior" || /line management|own the strategy|lead a team/.test(normalized)
      ? "leadership"
      : supportMatches.length > 0 || /admin|coordination|documentation/.test(normalized)
        ? "support"
        : "unknown";

  if (regulatedHealthcareRelevance === "irrelevant") penalty += 100;
  if (regulatedHealthcareRelevance === "weak") penalty += 35;
  if (supportNature === "leadership") penalty += 35;

  return {
    roleFamily,
    regulatedHealthcareRelevance,
    seniority,
    supportNature,
    hardReject,
    penalty,
    bonus,
    reasons,
    irelandRelevant: /\bireland\b|\bdublin\b|\bcork\b|\bgalway\b|\blimerick\b/.test(normalized),
  };
}

function findMatches(text: string, terms: string[]) {
  return terms.filter((term) => text.includes(term));
}

function matchesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}
