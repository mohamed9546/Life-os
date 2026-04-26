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
  { id: "jobsac", label: "jobs.ac.uk", defaultEnabled: true },
  { id: "totaljobs", label: "Totaljobs", defaultEnabled: true },
  { id: "serpapi", label: "SerpAPI Google Jobs", defaultEnabled: false },
  { id: "greenhouse", label: "Greenhouse", defaultEnabled: true },
  { id: "lever", label: "Lever", defaultEnabled: true },
  { id: "remotive", label: "Remotive", defaultEnabled: true },
  { id: "himalayas", label: "Himalayas", defaultEnabled: true },
  { id: "linkedin", label: "LinkedIn Public", defaultEnabled: true },
  { id: "rapidapi-linkedin", label: "LinkedIn RapidAPI", defaultEnabled: false },
  { id: "jooble", label: "Jooble", defaultEnabled: true },
  { id: "arbeitnow", label: "Arbeitnow", defaultEnabled: true },
  { id: "findwork", label: "FindWork", defaultEnabled: true },
  { id: "themuse", label: "The Muse", defaultEnabled: true },
  { id: "careerjet", label: "CareerJet", defaultEnabled: false },
  { id: "indeed", label: "Indeed", defaultEnabled: true },
  { id: "weworkremotely", label: "We Work Remotely", defaultEnabled: false },
  { id: "guardianjobs", label: "Guardian Jobs", defaultEnabled: true },
  { id: "nhsjobs", label: "NHS Jobs", defaultEnabled: true },
] as const;

export const RELIABLE_SOURCE_IDS = SOURCE_CATALOG.filter(
  (source) => source.defaultEnabled
).map((source) => source.id);

export const DEFAULT_TARGET_ROLE_TRACKS: RoleTrack[] = [
  "clinical",
  "qa",
  "regulatory",
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
      "Egypt",
      "Cairo",
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
      id: `${userId}-cta-core`,
      userId,
      label: "CTA core",
      keywords: [
        "clinical trial assistant",
        "clinical trials assistant",
        "clinical trial associate",
        "clinical research assistant",
      ],
      location: "United Kingdom",
      remoteOnly: false,
      radius: 40,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-cta-coordination`,
      userId,
      label: "Clinical coordination",
      keywords: [
        "clinical research coordinator",
        "trial coordinator",
        "clinical study assistant",
        "clinical study coordinator",
      ],
      location: "United Kingdom",
      remoteOnly: false,
      radius: 0,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-cta-startup`,
      userId,
      label: "Study start-up / site activation",
      keywords: [
        "study start-up assistant",
        "study start-up coordinator",
        "site activation assistant",
        "site activation coordinator",
      ],
      location: "United Kingdom",
      remoteOnly: true,
      radius: 0,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-clinical-glasgow-scotland`,
      userId,
      label: "Glasgow / Scotland CTA support",
      keywords: [
        "clinical trial assistant",
        "clinical trial associate",
        "clinical research assistant",
        "trial administrator",
      ],
      location: "Scotland",
      remoteOnly: false,
      radius: 50,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-london-hybrid-clinical`,
      userId,
      label: "London hybrid CTA / clinical ops",
      keywords: [
        "clinical operations assistant",
        "clinical trial assistant",
        "study start-up coordinator",
        "site activation coordinator",
      ],
      location: "London",
      remoteOnly: false,
      radius: 35,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-qa-core`,
      userId,
      label: "QA / GMP support",
      keywords: [
        "quality assurance pharmaceutical",
        "quality systems gmp",
        "document control gmp",
      ],
      location: "United Kingdom",
      remoteOnly: false,
      radius: 0,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-regulatory`,
      userId,
      label: "Regulatory affairs support",
      keywords: [
        "regulatory affairs assistant",
        "regulatory operations assistant",
        "regulatory submissions coordinator",
      ],
      location: "United Kingdom",
      remoteOnly: false,
      radius: 0,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-medinfo`,
      userId,
      label: "Medical information",
      keywords: [
        "medical information associate",
        "medical information officer",
        "medical affairs support",
      ],
      location: "United Kingdom",
      remoteOnly: false,
      radius: 0,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-research-governance`,
      userId,
      label: "Research governance / support",
      keywords: [
        "research governance",
        "research support officer",
        "clinical trial administrator",
      ],
      location: "United Kingdom",
      remoteOnly: false,
      radius: 0,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-egypt-clinical`,
      userId,
      label: "Egypt clinical / regulatory support",
      keywords: ["clinical trial assistant", "regulatory affairs assistant"],
      location: "Egypt",
      remoteOnly: false,
      radius: 0,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${userId}-cra-core`,
      userId,
      label: "Junior CRA / site support",
      keywords: [
        "junior cra",
        "in-house cra",
        "clinical research associate trainee",
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
  // A saved search like `["clinical trial assistant", "trial coordinator", …]`
  // is the user's intent to OR across those phrases. Most job APIs (Adzuna,
  // Reed, Indeed, etc.) AND-join the `what` parameter, so a single combined
  // query returns zero results. We fan out one query per phrase here so every
  // adapter downstream works with single-phrase queries and can rely on
  // dedupe to merge.
  return searches
    .filter((search) => search.enabled)
    .sort((left, right) => highestSearchPhraseScore(right) - highestSearchPhraseScore(left))
    .flatMap((search) => {
      const phrases = (search.keywords.length > 0 ? search.keywords : [""])
        .map((phrase) => phrase.trim())
        .filter((phrase) => phrase.length > 0)
        .filter((phrase) => !isLowSignalSearchPhrase(phrase))
        .sort((left, right) => scoreSearchPhrase(right) - scoreSearchPhrase(left));
      return phrases.map((phrase) => ({
        keywords: [phrase],
        location: search.location,
        radius: search.radius,
        remoteOnly: search.remoteOnly,
        maxResults: 25,
      }));
    });
}

function highestSearchPhraseScore(search: SavedSearch): number {
  return Math.max(
    0,
    ...search.keywords
      .map((phrase) => phrase.trim())
      .filter((phrase) => !isLowSignalSearchPhrase(phrase))
      .map(scoreSearchPhrase)
  );
}

function isLowSignalSearchPhrase(phrase: string): boolean {
  return new Set([
    "gmp",
    "pharmaceutical",
    "compliance",
    "monitoring",
    "site management",
  ]).has(phrase.trim().toLowerCase());
}

function scoreSearchPhrase(phrase: string): number {
  const normalized = phrase.trim().toLowerCase();
  if (
    [
      "clinical trial assistant",
      "clinical trials assistant",
      "clinical trial associate",
      "clinical research assistant",
      "clinical research coordinator",
    ].includes(normalized)
  ) {
    return 100;
  }

  if (
    [
      "trial coordinator",
      "clinical study assistant",
      "clinical study coordinator",
      "clinical operations assistant",
      "clinical trial administrator",
      "study start-up assistant",
      "study start-up coordinator",
      "site activation assistant",
      "site activation coordinator",
    ].includes(normalized)
  ) {
    return 80;
  }

  if (/regulatory|quality|medical information|research governance|cra/.test(normalized)) {
    return 40;
  }

  return 20;
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
