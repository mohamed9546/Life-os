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
    headline: "",
    location: "Glasgow, Scotland",
    openToRelocationUk: true,
    summary: "",
    targetTitles: [],
    targetRoleTracks: ["qa", "regulatory", "pv", "medinfo", "clinical"],
    locationConstraints: ["Glasgow", "Scotland", "United Kingdom remote"],
    transitionNarrative:
      "Targeting desk-based transition roles in UK life sciences and pharma.",
    strengths: [],
    experienceHighlights: [],
    education: [],
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
