import { v4 as uuid } from "uuid";
import {
  CareerProfile,
  SavedSearch,
  SourcePreference,
  UserSettingsBundle,
} from "@/types";
import { Collections, readCollection, writeCollection } from "@/lib/storage";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createDefaultCareerProfile,
  createDefaultSavedSearches,
  createDefaultSourcePreferences,
  searchesToQueries,
} from "./defaults";
import { JobSearchQuery } from "@/lib/jobs/sources/types";

async function loadFallbackProfile(userId: string, email: string) {
  const profiles = await readCollection<CareerProfile>(Collections.CAREER_PROFILES);
  const existing = profiles.find((profile) => profile.id === userId);
  if (existing) {
    return existing;
  }

  const created = createDefaultCareerProfile(userId, email);
  profiles.push(created);
  await writeCollection(Collections.CAREER_PROFILES, profiles);
  return created;
}

async function loadFallbackSavedSearches(userId: string) {
  const searches = await readCollection<SavedSearch>(Collections.SAVED_SEARCHES);
  const existing = searches.filter((search) => search.userId === userId);
  if (existing.length > 0) {
    return existing;
  }

  const created = createDefaultSavedSearches(userId);
  await writeCollection(Collections.SAVED_SEARCHES, [...searches, ...created]);
  return created;
}

async function loadFallbackSourcePreferences(userId: string) {
  const sources = await readCollection<SourcePreference>(
    Collections.SOURCE_PREFERENCES
  );
  const existing = sources.filter((source) => source.userId === userId);
  if (existing.length > 0) {
    return existing;
  }

  const created = createDefaultSourcePreferences(userId);
  await writeCollection(Collections.SOURCE_PREFERENCES, [...sources, ...created]);
  return created;
}

async function writeFallbackProfile(profile: CareerProfile) {
  const profiles = await readCollection<CareerProfile>(Collections.CAREER_PROFILES);
  const nextProfiles = profiles.filter((item) => item.id !== profile.id);
  nextProfiles.push(profile);
  await writeCollection(Collections.CAREER_PROFILES, nextProfiles);
  return profile;
}

async function writeFallbackSavedSearches(userId: string, searches: SavedSearch[]) {
  const existing = await readCollection<SavedSearch>(Collections.SAVED_SEARCHES);
  const filtered = existing.filter((item) => item.userId !== userId);
  await writeCollection(Collections.SAVED_SEARCHES, [...filtered, ...searches]);
  return searches;
}

async function writeFallbackSourcePreferences(
  userId: string,
  preferences: SourcePreference[]
) {
  const existing = await readCollection<SourcePreference>(
    Collections.SOURCE_PREFERENCES
  );
  const filtered = existing.filter((item) => item.userId !== userId);
  await writeCollection(Collections.SOURCE_PREFERENCES, [...filtered, ...preferences]);
  return preferences;
}

export async function getUserSettings(
  userId: string,
  email: string
): Promise<UserSettingsBundle> {
  const supabase = createServiceClient();

  if (!supabase) {
    const [profile, savedSearches, sourcePreferences] = await Promise.all([
      loadFallbackProfile(userId, email),
      loadFallbackSavedSearches(userId),
      loadFallbackSourcePreferences(userId),
    ]);

    return { profile, savedSearches, sourcePreferences };
  }

  const [{ data: profileData }, { data: searchData }, { data: sourceData }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("saved_searches")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("source_configs")
        .select("*")
        .eq("user_id", userId)
        .order("source_id", { ascending: true }),
    ]);

  const profile =
    mapProfileFromDb(profileData) ||
    (await writeDbProfile(createDefaultCareerProfile(userId, email)));

  let savedSearches = (searchData || []).map(mapSearchFromDb);
  let sourcePreferences = (sourceData || []).map(mapSourceFromDb);

  if (savedSearches.length === 0) {
    savedSearches = await replaceSavedSearches(
      userId,
      createDefaultSavedSearches(userId)
    );
  }

  if (sourcePreferences.length === 0) {
    sourcePreferences = await replaceSourcePreferences(
      userId,
      createDefaultSourcePreferences(userId)
    );
  }

  return {
    profile,
    savedSearches,
    sourcePreferences,
  };
}

export async function upsertUserProfile(
  userId: string,
  email: string,
  patch: Partial<CareerProfile>
): Promise<CareerProfile> {
  const supabase = createServiceClient();
  const current = supabase
    ? await loadDbProfile(userId, email)
    : await loadFallbackProfile(userId, email);
  const next: CareerProfile = {
    ...current,
    ...patch,
    id: userId,
    email,
    updatedAt: new Date().toISOString(),
  };

  if (!supabase) {
    return writeFallbackProfile(next);
  }

  return writeDbProfile(next);
}

export async function replaceSavedSearches(userId: string, searches: SavedSearch[]) {
  const supabase = createServiceClient();

  if (!supabase) {
    return writeFallbackSavedSearches(userId, searches);
  }

  await supabase.from("saved_searches").delete().eq("user_id", userId);

  if (searches.length === 0) {
    return [];
  }

  const payload = searches.map((search) => ({
    id: uuid(),
    user_id: userId,
    label: search.label,
    keywords: search.keywords,
    location: search.location,
    remote_only: search.remoteOnly,
    radius: search.radius,
    enabled: search.enabled,
    created_at: search.createdAt,
    updated_at: search.updatedAt,
  }));

  const { data } = await supabase
    .from("saved_searches")
    .insert(payload)
    .select("*");

  return (data || []).map(mapSearchFromDb);
}

export async function replaceSourcePreferences(
  userId: string,
  preferences: SourcePreference[]
) {
  const supabase = createServiceClient();

  if (!supabase) {
    return writeFallbackSourcePreferences(userId, preferences);
  }

  await supabase.from("source_configs").delete().eq("user_id", userId);

  if (preferences.length === 0) {
    return [];
  }

  const payload = preferences.map((source) => ({
    id: uuid(),
    user_id: userId,
    source_id: source.sourceId,
    enabled: source.enabled,
    created_at: source.createdAt,
    updated_at: source.updatedAt,
  }));

  const { data } = await supabase
    .from("source_configs")
    .insert(payload)
    .select("*");

  return (data || []).map(mapSourceFromDb);
}

export async function getEnabledUserSearchQueries(
  userId: string,
  email: string
): Promise<JobSearchQuery[]> {
  const settings = await getUserSettings(userId, email);
  return searchesToQueries(settings.savedSearches);
}

export async function getEnabledUserSourceIds(
  userId: string,
  email: string
): Promise<string[]> {
  const settings = await getUserSettings(userId, email);
  return settings.sourcePreferences
    .filter((source) => source.enabled)
    .map((source) => source.sourceId);
}

function mapProfileFromDb(data: any): CareerProfile | null {
  if (!data) return null;

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    onboardingCompleted: Boolean(data.onboarding_completed),
    targetRoleTracks: data.target_role_tracks || [],
    targetLocations: data.target_locations || [],
    remotePreference: data.remote_preference || "flexible",
    preferredSeniority: data.preferred_seniority || "entry-to-mid",
    notificationFrequency: data.notification_frequency || "daily",
    isAdmin: Boolean(data.is_admin),
    createdAt: data.created_at || new Date().toISOString(),
    updatedAt: data.updated_at || new Date().toISOString(),
  };
}

async function loadDbProfile(userId: string, email: string): Promise<CareerProfile> {
  const supabase = createServiceClient();
  if (!supabase) {
    return loadFallbackProfile(userId, email);
  }

  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return mapProfileFromDb(data) || createDefaultCareerProfile(userId, email);
}

async function writeDbProfile(profile: CareerProfile): Promise<CareerProfile> {
  const supabase = createServiceClient();
  if (!supabase) {
    return writeFallbackProfile(profile);
  }

  const payload = {
    id: profile.id,
    email: profile.email,
    full_name: profile.fullName,
    onboarding_completed: profile.onboardingCompleted,
    target_role_tracks: profile.targetRoleTracks,
    target_locations: profile.targetLocations,
    remote_preference: profile.remotePreference,
    preferred_seniority: profile.preferredSeniority,
    notification_frequency: profile.notificationFrequency,
    is_admin: profile.isAdmin,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };

  const { data } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  return mapProfileFromDb(data) || profile;
}

function mapSearchFromDb(data: any): SavedSearch {
  return {
    id: data.id,
    userId: data.user_id,
    label: data.label,
    keywords: data.keywords || [],
    location: data.location || "United Kingdom",
    remoteOnly: Boolean(data.remote_only),
    radius: data.radius || 0,
    enabled: Boolean(data.enabled),
    createdAt: data.created_at || new Date().toISOString(),
    updatedAt: data.updated_at || new Date().toISOString(),
  };
}

function mapSourceFromDb(data: any): SourcePreference {
  return {
    id: data.id,
    userId: data.user_id,
    sourceId: data.source_id,
    enabled: Boolean(data.enabled),
    createdAt: data.created_at || new Date().toISOString(),
    updatedAt: data.updated_at || new Date().toISOString(),
  };
}
