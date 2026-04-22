import {
  CareerProfile,
  NotificationFrequency,
  RemoteType,
  RoleTrack,
  SavedSearch,
  SourcePreference,
} from "@/types";
import { JobSearchQuery } from "@/lib/jobs/sources/types";

export const SOURCE_CATALOG = [
  { id: "adzuna", label: "Adzuna", defaultEnabled: true },
  { id: "reed", label: "Reed", defaultEnabled: true },
  { id: "serpapi", label: "SerpAPI Google Jobs", defaultEnabled: false },
  { id: "greenhouse", label: "Greenhouse", defaultEnabled: true },
  { id: "lever", label: "Lever", defaultEnabled: true },
  { id: "remotive", label: "Remotive", defaultEnabled: false },
  { id: "himalayas", label: "Himalayas", defaultEnabled: false },
  { id: "brightnetwork", label: "Bright Network", defaultEnabled: false },
  { id: "linkedin", label: "LinkedIn Public", defaultEnabled: false },
  { id: "rapidapi-linkedin", label: "LinkedIn RapidAPI", defaultEnabled: false },
  { id: "jooble", label: "Jooble", defaultEnabled: false },
  { id: "arbeitnow", label: "Arbeitnow", defaultEnabled: false },
  { id: "findwork", label: "FindWork", defaultEnabled: false },
  { id: "themuse", label: "The Muse", defaultEnabled: false },
  { id: "careerjet", label: "CareerJet", defaultEnabled: false },
  { id: "indeed", label: "Indeed", defaultEnabled: false },
  { id: "weworkremotely", label: "We Work Remotely", defaultEnabled: false },
  { id: "guardianjobs", label: "Guardian Jobs", defaultEnabled: false },
] as const;

export const RELIABLE_SOURCE_IDS = SOURCE_CATALOG.filter(
  (source) => source.defaultEnabled
).map((source) => source.id);

export const DEFAULT_TARGET_ROLE_TRACKS: RoleTrack[] = [
  "clinical",
  "qa",
  "regulatory",
  "pv",
  "medinfo",
];

export function createDefaultCareerProfile(
  userId: string,
  email: string
): CareerProfile {
  const now = new Date().toISOString();

  return {
    id: userId,
    email,
    fullName: null,
    onboardingCompleted: false,
    targetRoleTracks: DEFAULT_TARGET_ROLE_TRACKS,
    targetLocations: [
      "Glasgow",
      "Edinburgh",
      "Scotland",
      "United Kingdom",
      "Ireland",
      "Dublin",
    ],
    remotePreference: "flexible",
    preferredSeniority: "entry-to-mid",
    notificationFrequency: "daily",
    isAdmin: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createDefaultSavedSearches(userId: string): SavedSearch[] {
  const now = new Date().toISOString();

  return [
    {
      id: `${userId}-qa-core`,
      userId,
      label: "QA / GMP core",
      keywords: ["quality assurance", "GMP", "pharmaceutical"],
      location: "Glasgow",
      remoteOnly: false,
      radius: 40,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-qa-compliance`,
      userId,
      label: "Quality systems / compliance",
      keywords: ["quality systems", "compliance", "document control"],
      location: "United Kingdom",
      remoteOnly: true,
      radius: 0,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-regulatory`,
      userId,
      label: "Regulatory affairs",
      keywords: ["regulatory affairs", "regulatory operations"],
      location: "United Kingdom",
      remoteOnly: true,
      radius: 0,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-regulatory-device`,
      userId,
      label: "Regulatory devices",
      keywords: ["medical device regulatory", "ISO 13485", "CE marking"],
      location: "United Kingdom",
      remoteOnly: true,
      radius: 0,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-pv`,
      userId,
      label: "Drug safety / PV",
      keywords: ["pharmacovigilance", "drug safety", "case processing"],
      location: "United Kingdom",
      remoteOnly: true,
      radius: 0,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-medinfo`,
      userId,
      label: "Medical information",
      keywords: ["medical information", "medical affairs", "scientific support"],
      location: "United Kingdom",
      remoteOnly: true,
      radius: 0,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-clinical`,
      userId,
      label: "CTA / trial support",
      keywords: [
        "clinical trial assistant",
        "trial coordinator",
        "clinical operations assistant",
        "study coordinator",
      ],
      location: "United Kingdom",
      remoteOnly: false,
      radius: 40,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-cra-core`,
      userId,
      label: "CRA / site management",
      keywords: [
        "clinical research associate",
        "CRA I",
        "site management",
        "monitoring",
      ],
      location: "United Kingdom",
      remoteOnly: true,
      radius: 0,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-clinical-ops`,
      userId,
      label: "Clinical operations / startup",
      keywords: [
        "clinical operations",
        "study start up",
        "site activation",
        "trial coordinator",
        "clinical trial administrator",
      ],
      location: "United Kingdom",
      remoteOnly: true,
      radius: 0,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function createDefaultSourcePreferences(userId: string): SourcePreference[] {
  const now = new Date().toISOString();

  return SOURCE_CATALOG.map((source) => ({
    id: `${userId}-${source.id}`,
    userId,
    sourceId: source.id,
    enabled: source.defaultEnabled,
    createdAt: now,
    updatedAt: now,
  }));
}

export function searchesToQueries(searches: SavedSearch[]): JobSearchQuery[] {
  return searches
    .filter((search) => search.enabled)
    .map((search) => ({
      keywords: search.keywords,
      location: search.location,
      radius: search.radius,
      remoteOnly: search.remoteOnly,
      maxResults: 25,
    }));
}

export function normalizeRemotePreference(value: string): CareerProfile["remotePreference"] {
  if (value === "remote" || value === "hybrid" || value === "onsite") {
    return value;
  }
  return "flexible";
}

export function normalizeNotificationFrequency(
  value: string
): NotificationFrequency {
  if (value === "manual" || value === "daily" || value === "weekly") {
    return value;
  }
  return "daily";
}

export function normalizeRoleTracks(values: string[]): RoleTrack[] {
  const allowed = new Set<RoleTrack>([
    "qa",
    "regulatory",
    "pv",
    "medinfo",
    "clinical",
    "other",
  ]);

  return values.filter((value): value is RoleTrack => allowed.has(value as RoleTrack));
}

export function normalizeRemoteType(value: string): RemoteType {
  if (value === "remote" || value === "hybrid" || value === "onsite") {
    return value;
  }
  return "unknown";
}
