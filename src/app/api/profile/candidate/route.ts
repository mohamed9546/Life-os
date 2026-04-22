import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import {
  approveCandidateProfileDraft,
  loadCandidateProfile,
  loadCandidateProfileDraft,
  normalizeCandidateProfile,
  saveCandidateProfile,
  saveCandidateProfileDraft,
} from "@/lib/profile/candidate-profile";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAppUser();
    const [profile, draft] = await Promise.all([
      loadCandidateProfile(),
      loadCandidateProfileDraft(),
    ]);

    return NextResponse.json({ profile, draft });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAppUser();
    const body = (await request.json()) as {
      profile?: Record<string, unknown>;
      approveDraft?: boolean;
      draft?: Record<string, unknown>;
    };

    let profile = null;
    let draft = null;

    if (body.approveDraft) {
      profile = await approveCandidateProfileDraft();
    }

    if (body.profile) {
      profile = await saveCandidateProfile(normalizeCandidateProfile(body.profile));
    }

    if (body.draft) {
      draft = await saveCandidateProfileDraft(body.draft as any);
    }

    return NextResponse.json({
      success: true,
      profile: profile || (await loadCandidateProfile()),
      draft: draft || (await loadCandidateProfileDraft()),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update candidate profile" },
      { status: 500 }
    );
  }
}
