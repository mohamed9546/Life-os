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
  SOURCE_CATALOG,
  createDefaultCareerProfile,
  createDefaultSavedSearches,
  createDefaultSourcePreferences,
  searchesToQueries,
} from "./defaults";
import { JobSearchQuery } from "@/lib/jobs/sources/types";

function warnSettingsFallback(operation: string, error: unknown) {
  console.warn(
    `[career/settings] Supabase ${operation} failed; using local JSON fallback.`,
    error
  );
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeProfile(
  profile: Partial<CareerProfile> | null | undefined,
  userId: string,
  email: string
): CareerProfile {
  const defaults = createDefaultCareerProfile(userId, email);

  return {
    ...defaults,
    ...profile,
    id: userId,
    email: profile?.email || email,
    fullName: profile?.fullName ?? defaults.fullName,
    onboardingCompleted: Boolean(
      profile?.onboardingCompleted ?? defaults.onboardingCompleted
    ),
    targetRoleTracks: Array.isArray(profile?.targetRoleTracks)
      ? (profile.targetRoleTracks as CareerProfile["targetRoleTracks"])
      : defaults.targetRoleTracks,
    targetLocations: Array.isArray(profile?.targetLocations)
      ? profile.targetLocations
      : defaults.targetLocations,
    remotePreference: profile?.remotePreference || defaults.remotePreference,
    preferredSeniority:
      profile?.preferredSeniority || defaults.preferredSeniority,
    notificationFrequency:
      profile?.notificationFrequency || defaults.notificationFrequency,
    isAdmin: Boolean(profile?.isAdmin ?? defaults.isAdmin),
    createdAt: profile?.createdAt || defaults.createdAt,
    updatedAt: profile?.updatedAt || defaults.updatedAt,
  };
}

function normalizeSearch(
  search: Partial<SavedSearch>,
  userId: string,
  index: number
): SavedSearch {
  const now = new Date().toISOString();

  return {
    id: search.id || `${userId}-search-${index}`,
    userId,
    label: search.label || "Saved search",
    keywords: asArray(search.keywords).filter(Boolean),
    location: search.location || "United Kingdom",
    remoteOnly: Boolean(search.remoteOnly),
    radius: typeof search.radius === "number" ? search.radius : 0,
    enabled: search.enabled ?? true,
    createdAt: search.createdAt || now,
    updatedAt: search.updatedAt || now,
  };
}

function normalizeSourcePreference(
  source: Partial<SourcePreference>,
  userId: string,
  index: number
): SourcePreference {
  const now = new Date().toISOString();
  const sourceId = source.sourceId || SOURCE_CATALOG[index]?.id || "unknown";

  return {
    id: source.id || `${userId}-${sourceId}`,
    userId,
    sourceId,
    enabled: Boolean(source.enabled),
    createdAt: source.createdAt || now,
    updatedAt: source.updatedAt || now,
  };
}

function normalizeSettingsBundle(
  settings: Partial<UserSettingsBundle>,
  userId: string,
  email: string
): UserSettingsBundle {
  return {
    profile: normalizeProfile(settings.profile, userId, email),
    savedSearches: asArray(settings.savedSearches).map((search, index) =>
      normalizeSearch(search, userId, index)
    ),
    sourcePreferences: asArray(settings.sourcePreferences).map((source, index) =>
      normalizeSourcePreference(source, userId, index)
    ),
  };
}

function mergeSavedSearchesWithDefaults(
  existing: SavedSearch[],
  userId: string
): SavedSearch[] {
  const normalizedExisting = existing.map((search, index) =>
    normalizeSearch(search, userId, index)
  );
  const defaults = createDefaultSavedSearches(userId);

  if (normalizedExisting.length === 0) {
    return defaults;
  }

  const existingIds = new Set(normalizedExisting.map((search) => search.id));
  const missingDefaults = defaults.filter((search) => !existingIds.has(search.id));
  return [...normalizedExisting, ...missingDefaults];
}

function mergeSourcePreferencesWithDefaults(
  existing: SourcePreference[],
  userId: string
): SourcePreference[] {
  const normalizedExisting = existing
    .map((source, index) => normalizeSourcePreference(source, userId, index))
    .filter((source) =>
      SOURCE_CATALOG.some((catalogSource) => catalogSource.id === source.sourceId)
    );
  const defaults = createDefaultSourcePreferences(userId);

  if (normalizedExisting.length === 0) {
    return defaults;
  }

  const existingSourceIds = new Set(
    normalizedExisting.map((source) => source.sourceId)
  );
  const missingDefaults = defaults.filter(
    (source) => !existingSourceIds.has(source.sourceId)
  );
  return [...normalizedExisting, ...missingDefaults];
}

async function loadFallbackSettings(userId: string, email: string) {
  const [profile, savedSearches, sourcePreferences] = await Promise.all([
    loadFallbackProfile(userId, email),
    loadFallbackSavedSearches(userId),
    loadFallbackSourcePreferences(userId),
  ]);

  return normalizeSettingsBundle(
    { profile, savedSearches, sourcePreferences },
    userId,
    email
  );
}

async function loadFallbackProfile(userId: string, email: string) {
  const profiles = await readCollection<CareerProfile>(Collections.CAREER_PROFILES);
  const existing = profiles.find((profile) => profile.id === userId);
  if (existing) {
    return normalizeProfile(existing, userId, email);
  }

  return createDefaultCareerProfile(userId, email);
}

async function loadFallbackSavedSearches(userId: string) {
  const searches = await readCollection<SavedSearch>(Collections.SAVED_SEARCHES);
  const existing = searches.filter((search) => search.userId === userId);
  return mergeSavedSearchesWithDefaults(existing, userId);
}

async function loadFallbackSourcePreferences(userId: string) {
  const sources = await readCollection<SourcePreference>(
    Collections.SOURCE_PREFERENCES
  );
  const existing = sources.filter((source) => source.userId === userId);
  return mergeSourcePreferencesWithDefaults(existing, userId);
}

async function writeFallbackProfile(profile: CareerProfile) {
  const profiles = await readCollection<CareerProfile>(Collections.CAREER_PROFILES);
  const normalized = normalizeProfile(profile, profile.id, profile.email);
  const nextProfiles = profiles.filter((item) => item.id !== profile.id);
  nextProfiles.push(normalized);
  await writeCollection(Collections.CAREER_PROFILES, nextProfiles);
  return normalized;
}

async function writeFallbackSavedSearches(userId: string, searches: SavedSearch[]) {
  const existing = await readCollection<SavedSearch>(Collections.SAVED_SEARCHES);
  const filtered = existing.filter((item) => item.userId !== userId);
  const normalized = searches.map((search, index) =>
    normalizeSearch(search, userId, index)
  );
  await writeCollection(Collections.SAVED_SEARCHES, [...filtered, ...normalized]);
  return normalized;
}

async function writeFallbackSourcePreferences(
  userId: string,
  preferences: SourcePreference[]
) {
  const existing = await readCollection<SourcePreference>(
    Collections.SOURCE_PREFERENCES
  );
  const filtered = existing.filter((item) => item.userId !== userId);
  const normalized = preferences.map((source, index) =>
    normalizeSourcePreference(source, userId, index)
  );
  await writeCollection(Collections.SOURCE_PREFERENCES, [...filtered, ...normalized]);
  return normalized;
}

export async function getUserSettings(
  userId: string,
  email: string
): Promise<UserSettingsBundle> {
  const supabase = createServiceClient();

  if (!supabase) {
    return loadFallbackSettings(userId, email);
  }

  try {
    const [profileResult, searchResult, sourceResult] = await Promise.all([
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

    if (profileResult.error) throw profileResult.error;
    if (searchResult.error) throw searchResult.error;
    if (sourceResult.error) throw sourceResult.error;

    const profile =
      mapProfileFromDb(profileResult.data) || createDefaultCareerProfile(userId, email);

    const savedSearches = mergeSavedSearchesWithDefaults(
      (searchResult.data || []).map(mapSearchFromDb),
      userId
    );
    const sourcePreferences = mergeSourcePreferencesWithDefaults(
      (sourceResult.data || []).map(mapSourceFromDb),
      userId
    );

    return normalizeSettingsBundle(
      { profile, savedSearches, sourcePreferences },
      userId,
      email
    );
  } catch (err) {
    warnSettingsFallback("settings read", err);
    return loadFallbackSettings(userId, email);
  }
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
  const normalized = normalizeProfile(next, userId, email);

  if (!supabase) {
    return writeFallbackProfile(normalized);
  }

  return writeDbProfile(normalized);
}

export async function replaceSavedSearches(userId: string, searches: SavedSearch[]) {
  const supabase = createServiceClient();
  const normalizedSearches = searches.map((search, index) =>
    normalizeSearch(search, userId, index)
  );

  if (!supabase) {
    return writeFallbackSavedSearches(userId, normalizedSearches);
  }

  try {
    const deleteResult = await supabase
      .from("saved_searches")
      .delete()
      .eq("user_id", userId);

    if (deleteResult.error) throw deleteResult.error;

    if (normalizedSearches.length === 0) {
      return [];
    }

    const payload = normalizedSearches.map((search) => ({
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

    const { data, error } = await supabase
      .from("saved_searches")
      .insert(payload)
      .select("*");

    if (error) throw error;
    return (data || []).map(mapSearchFromDb);
  } catch (err) {
    warnSettingsFallback("saved search write", err);
    return writeFallbackSavedSearches(userId, normalizedSearches);
  }
}

export async function replaceSourcePreferences(
  userId: string,
  preferences: SourcePreference[]
) {
  const supabase = createServiceClient();
  const normalizedPreferences = preferences.map((source, index) =>
    normalizeSourcePreference(source, userId, index)
  );

  if (!supabase) {
    return writeFallbackSourcePreferences(userId, normalizedPreferences);
  }

  try {
    const deleteResult = await supabase
      .from("source_configs")
      .delete()
      .eq("user_id", userId);

    if (deleteResult.error) throw deleteResult.error;

    if (normalizedPreferences.length === 0) {
      return [];
    }

    const payload = normalizedPreferences.map((source) => ({
      id: uuid(),
      user_id: userId,
      source_id: source.sourceId,
      enabled: source.enabled,
      created_at: source.createdAt,
      updated_at: source.updatedAt,
    }));

    const { data, error } = await supabase
      .from("source_configs")
      .insert(payload)
      .select("*");

    if (error) throw error;
    return (data || []).map(mapSourceFromDb);
  } catch (err) {
    warnSettingsFallback("source preference write", err);
    return writeFallbackSourcePreferences(userId, normalizedPreferences);
  }
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

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return mapProfileFromDb(data) || createDefaultCareerProfile(userId, email);
  } catch (err) {
    warnSettingsFallback("profile read", err);
    return loadFallbackProfile(userId, email);
  }
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

  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) throw error;
    return mapProfileFromDb(data) || profile;
  } catch (err) {
    warnSettingsFallback("profile write", err);
    return writeFallbackProfile(profile);
  }
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
