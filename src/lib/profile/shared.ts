import { RoleTrack } from "@/types";

export interface CandidateProfileSeed {
  id?: string;
  fullName: string;
  headline: string;
  location: string;
  openToRelocationUk: boolean;
  summary: string;
  targetTitles: string[];
  targetRoleTracks: RoleTrack[];
  locationConstraints: string[];
  transitionNarrative: string;
  strengths: string[];
  experienceHighlights: string[];
  education: string[];
  sourceCvIds?: string[];
  extraction?: {
    reviewState: "draft" | "approved";
    confidence: number;
    issues: string[];
    extractedAt: string;
    sourceFiles: string[];
  };
}

export interface CandidateProfileImportDraft {
  rawText: string;
  profile: CandidateProfileSeed;
  confidence: number;
  issues: string[];
  sourceFiles: string[];
  extractedAt: string;
}

export function getDefaultCandidateProfile(): CandidateProfileSeed {
  return {
    fullName: "",
    headline: "Entry-level Clinical Trial Assistant (CTA), Clinical Research Associate (CRA), QA, regulatory, and medinfo candidate",
    location: "Glasgow, Scotland",
    openToRelocationUk: true,
    summary:
      "MSc Clinical Pharmacology candidate targeting entry-level regulated documentation, clinical trial support, study coordination, SOP/compliance-heavy admin, and healthcare governance roles.",
    targetTitles: [
      "Clinical Trial Assistant (CTA)",
      "Clinical Research Coordinator",
      "Clinical Operations Assistant",
      "Clinical Operations Coordinator",
      "Clinical Study Assistant",
      "Clinical Study Coordinator",
      "Study Start-Up Assistant",
      "Study Start-Up Coordinator",
      "Site Activation Assistant",
      "Site Activation Coordinator",
      "Trial Administrator",
      "Clinical Project Assistant",
      "In-House Clinical Research Associate (CRA)",
      "Junior Clinical Research Associate (CRA)",
      "QA Associate",
      "Quality Systems Associate",
      "Document Control Associate",
      "Regulatory Affairs Assistant",
      "Regulatory Operations Assistant",
      "Medical Information Associate",
      "Research Governance",
      "Research Support",
    ],
    targetRoleTracks: ["qa", "regulatory", "medinfo", "clinical"],
    locationConstraints: [
      "Glasgow",
      "Scotland",
      "United Kingdom",
      "London hybrid",
      "Remote",
      "Hybrid",
      "Egypt",
    ],
    transitionNarrative:
      "Targeting desk-based transition roles in UK life sciences and pharma, with Egypt included as an additional location option.",
    strengths: [
      "GCP training",
      "Regulated healthcare documentation",
      "SOP and compliance-heavy workflows",
      "Trial support and coordination readiness",
      "Governance and controlled-document environment exposure",
    ],
    experienceHighlights: [
      "Clinical research internship exposure",
      "Healthcare administration and regulated support workflows",
      "Documentation quality, filing, archiving and audit-readiness mindset",
    ],
    education: ["MSc Clinical Pharmacology"],
    sourceCvIds: [],
    extraction: {
      reviewState: "approved",
      confidence: 1,
      issues: [],
      extractedAt: new Date().toISOString(),
      sourceFiles: [],
    },
  };
}

export function normalizeCandidateProfile(
  input: Partial<CandidateProfileSeed> | unknown
): CandidateProfileSeed {
  const defaults = getDefaultCandidateProfile();

  // Without this guard, a `null` / string / array `input` would either
  // throw when reading `input.targetTitles` (null) OR splat string
  // characters as numeric keys onto the result, both of which surface
  // as confusing runtime errors in the candidate profile UI.
  const safeInput: Partial<CandidateProfileSeed> =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Partial<CandidateProfileSeed>)
      : {};

  return {
    ...defaults,
    ...safeInput,
    targetTitles: uniqueStrings(
      Array.isArray(safeInput.targetTitles) ? safeInput.targetTitles : defaults.targetTitles
    ),
    targetRoleTracks: (Array.isArray(safeInput.targetRoleTracks)
      ? safeInput.targetRoleTracks
      : defaults.targetRoleTracks) as RoleTrack[],
    locationConstraints: uniqueStrings(
      Array.isArray(safeInput.locationConstraints)
        ? safeInput.locationConstraints
        : defaults.locationConstraints
    ),
    strengths: uniqueStrings(
      Array.isArray(safeInput.strengths) ? safeInput.strengths : defaults.strengths
    ),
    experienceHighlights: uniqueStrings(
      Array.isArray(safeInput.experienceHighlights)
        ? safeInput.experienceHighlights
        : defaults.experienceHighlights
    ),
    education: uniqueStrings(
      Array.isArray(safeInput.education) ? safeInput.education : defaults.education
    ),
    sourceCvIds: uniqueStrings(
      Array.isArray(safeInput.sourceCvIds)
        ? safeInput.sourceCvIds
        : defaults.sourceCvIds || []
    ),
    extraction:
      safeInput.extraction && typeof safeInput.extraction === "object"
        ? safeInput.extraction
        : defaults.extraction,
  };
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}
