// ============================================================
// User profile prompt helpers for AI job-fit evaluation.
// ============================================================

import { CareerProfile } from "@/types";
import { getCurrentAppUser } from "@/lib/auth/session";
import { getUserSettings } from "@/lib/career/settings";
import {
  buildCandidateProfilePromptBlock,
  loadCandidateProfile,
} from "@/lib/profile/candidate-profile";

const DEFAULT_PROFILE = {
  targetLocations: ["Glasgow", "Scotland", "United Kingdom"],
  targetRoleTracks: ["qa", "regulatory", "pv", "medinfo", "clinical"],
  remotePreference: "flexible",
  preferredSeniority: "entry-to-mid",
  transitionContext:
    "Candidate holds an MSc in Clinical Pharmacology (Distinction) and a BSc in Clinical Pharmacy. They have extensive experience managing high-volume community dispensaries (13,000+ items/mo), strict Controlled Drug governance, and patient triage. They also possess molecular biology lab experience (DNA/RNA extraction, Illumina MiSeq). They are leveraging their GDocP, GCP awareness, and clinical knowledge to transition entirely out of retail pharmacy into desk-based industry roles (PV, QA, Regulatory, or Clinical Ops). They have NO prior industry experience — only transferable pharmacy and lab skills.",
} as const;

function formatRoleTrack(roleTrack: string) {
  switch (roleTrack) {
    case "qa":
      return "Quality Assurance";
    case "regulatory":
      return "Regulatory Affairs";
    case "pv":
      return "Pharmacovigilance";
    case "medinfo":
      return "Medical Information";
    case "clinical":
      return "Clinical Operations";
    default:
      return roleTrack;
  }
}

export function buildUserProfilePromptBlock(profile?: Partial<CareerProfile> | null): string {
  const targetLocations = profile?.targetLocations?.length
    ? profile.targetLocations
    : DEFAULT_PROFILE.targetLocations;
  const roleTracks = profile?.targetRoleTracks?.length
    ? profile.targetRoleTracks
    : DEFAULT_PROFILE.targetRoleTracks;
  const remotePreference = profile?.remotePreference || DEFAULT_PROFILE.remotePreference;
  const seniority = profile?.preferredSeniority || DEFAULT_PROFILE.preferredSeniority;

  return `
USER PROFILE FOR FIT EVALUATION:

CANDIDATE BACKGROUND (read this first — it must inform every score):
${DEFAULT_PROFILE.transitionContext}
- Favor roles with structured onboarding, transition accessibility, and desk-based work.
- Penalise senior-only, lab-heavy, retail pharmacy, financial services, or travel-heavy roles.

STRONGEST TARGET PATHS:
${roleTracks.map((roleTrack) => `- ${formatRoleTrack(roleTrack)}`).join("\n")}

PREFERRED LOCATIONS:
${targetLocations.map((location) => `- ${location}`).join("\n")}

REMOTE PREFERENCE: ${remotePreference}
PREFERRED SENIORITY: ${seniority}
`.trim();
}

export async function loadUserProfilePromptBlock(): Promise<string> {
  try {
    const candidateProfile = await loadCandidateProfile();
    const user = await getCurrentAppUser();
    if (!user) {
      return [buildUserProfilePromptBlock(), buildCandidateProfilePromptBlock(candidateProfile)]
        .filter(Boolean)
        .join("\n\n");
    }

    const settings = await getUserSettings(user.id, user.email);
    return [
      buildUserProfilePromptBlock(settings.profile),
      buildCandidateProfilePromptBlock(candidateProfile),
    ]
      .filter(Boolean)
      .join("\n\n");
  } catch {
    try {
      const candidateProfile = await loadCandidateProfile();
      return [buildUserProfilePromptBlock(), buildCandidateProfilePromptBlock(candidateProfile)]
        .filter(Boolean)
        .join("\n\n");
    } catch {
      return buildUserProfilePromptBlock();
    }
  }
}
