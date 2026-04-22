import { readObject, writeObject } from "@/lib/storage";
import {
  CandidateProfileImportDraft,
  CandidateProfileSeed,
  getDefaultCandidateProfile,
  normalizeCandidateProfile,
} from "@/lib/profile/shared";

export type { CandidateProfileImportDraft, CandidateProfileSeed } from "@/lib/profile/shared";

const CANDIDATE_PROFILE_FILE = "candidate-profile";
const CANDIDATE_PROFILE_DRAFT_FILE = "candidate-profile-draft";

export async function loadCandidateProfile(): Promise<CandidateProfileSeed | null> {
  return readObject<CandidateProfileSeed>(CANDIDATE_PROFILE_FILE);
}

export async function saveCandidateProfile(
  profile: CandidateProfileSeed
): Promise<CandidateProfileSeed> {
  await writeObject(CANDIDATE_PROFILE_FILE, profile);
  return profile;
}

export async function loadCandidateProfileDraft(): Promise<CandidateProfileImportDraft | null> {
  return readObject<CandidateProfileImportDraft>(CANDIDATE_PROFILE_DRAFT_FILE);
}

export async function saveCandidateProfileDraft(
  draft: CandidateProfileImportDraft
): Promise<CandidateProfileImportDraft> {
  await writeObject(CANDIDATE_PROFILE_DRAFT_FILE, draft);
  return draft;
}

export async function approveCandidateProfileDraft(): Promise<CandidateProfileSeed | null> {
  const draft = await loadCandidateProfileDraft();
  if (!draft) {
    return null;
  }

  const approved: CandidateProfileSeed = {
    ...draft.profile,
    extraction: {
      reviewState: "approved",
      confidence: draft.confidence,
      issues: draft.issues,
      extractedAt: draft.extractedAt,
      sourceFiles: draft.sourceFiles,
    },
  };

  await saveCandidateProfile(approved);
  return approved;
}

export function buildCandidateProfilePromptBlock(
  profile: CandidateProfileSeed | null
): string {
  if (!profile) {
    return "";
  }

  return `
CANDIDATE CONTEXT FROM LOCAL CV PROFILE:
- Name: ${profile.fullName}
- Headline: ${profile.headline}
- Current location: ${profile.location}
- Open to UK relocation: ${profile.openToRelocationUk ? "yes" : "no"}
- Summary: ${profile.summary}
- Transition narrative: ${profile.transitionNarrative}

TARGET TITLES:
${profile.targetTitles.map((title) => `- ${title}`).join("\n")}

TARGET ROLE TRACKS:
${profile.targetRoleTracks.map((track) => `- ${track}`).join("\n")}

LOCATION CONSTRAINTS:
${profile.locationConstraints.map((item) => `- ${item}`).join("\n")}

STRENGTHS:
${profile.strengths.map((strength) => `- ${strength}`).join("\n")}

EXPERIENCE HIGHLIGHTS:
${profile.experienceHighlights.map((highlight) => `- ${highlight}`).join("\n")}

EDUCATION:
${profile.education.map((item) => `- ${item}`).join("\n")}
`.trim();
}

export { getDefaultCandidateProfile, normalizeCandidateProfile };
