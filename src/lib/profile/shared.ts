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
    headline: "Entry-level clinical operations, QA, regulatory, PV and medinfo candidate",
    location: "Glasgow, Scotland",
    openToRelocationUk: true,
    summary:
      "MSc Clinical Pharmacology candidate targeting entry-level regulated documentation, clinical trial support, study coordination, SOP/compliance-heavy admin, and healthcare governance roles.",
    targetTitles: [
      "Clinical Trial Assistant",
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
      "In-House CRA",
      "Junior CRA",
      "QA Associate",
      "Quality Systems Associate",
      "Document Control Associate",
      "Regulatory Affairs Assistant",
      "Regulatory Operations Assistant",
      "Pharmacovigilance Associate",
      "Drug Safety Associate",
      "Medical Information Associate",
      "Research Governance",
      "Research Support",
    ],
    targetRoleTracks: ["qa", "regulatory", "pv", "medinfo", "clinical"],
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
  input: Partial<CandidateProfileSeed>
): CandidateProfileSeed {
  const defaults = getDefaultCandidateProfile();

  return {
    ...defaults,
    ...input,
    targetTitles: uniqueStrings(input.targetTitles || defaults.targetTitles),
    targetRoleTracks:
      (input.targetRoleTracks || defaults.targetRoleTracks) as RoleTrack[],
    locationConstraints: uniqueStrings(
      input.locationConstraints || defaults.locationConstraints
    ),
    strengths: uniqueStrings(input.strengths || defaults.strengths),
    experienceHighlights: uniqueStrings(
      input.experienceHighlights || defaults.experienceHighlights
    ),
    education: uniqueStrings(input.education || defaults.education),
    sourceCvIds: uniqueStrings(input.sourceCvIds || defaults.sourceCvIds || []),
    extraction: input.extraction || defaults.extraction,
  };
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  );
}
