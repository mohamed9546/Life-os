import { NextRequest, NextResponse } from "next/server";
import {
  getUserSettings,
  replaceSavedSearches,
  replaceSourcePreferences,
  upsertUserProfile,
} from "@/lib/career/settings";
import { requireAppUser } from "@/lib/auth/session";
import { CareerProfile, SavedSearch, SourcePreference } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAppUser();
    const settings = await getUserSettings(user.id, user.email);
    return NextResponse.json(settings);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAppUser();
    const body = (await request.json()) as {
      profile?: Partial<CareerProfile>;
      savedSearches?: SavedSearch[];
      sourcePreferences?: SourcePreference[];
    };

    if (body.profile) {
      await upsertUserProfile(user.id, user.email, body.profile);
    }

    if (Array.isArray(body.savedSearches)) {
      await replaceSavedSearches(
        user.id,
        body.savedSearches.map((search) => ({
          ...search,
          userId: user.id,
          createdAt: search.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))
      );
    }

    if (Array.isArray(body.sourcePreferences)) {
      await replaceSourcePreferences(
        user.id,
        body.sourcePreferences.map((source) => ({
          ...source,
          userId: user.id,
          createdAt: source.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))
      );
    }

    const settings = await getUserSettings(user.id, user.email);
    return NextResponse.json(settings);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update settings" },
      { status: 500 }
    );
  }
}
