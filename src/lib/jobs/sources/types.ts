// ============================================================
// Unified job source adapter interface.
// Every source adapter (Adzuna, Reed, Greenhouse, etc.)
// implements this contract so the pipeline treats them identically.
// ============================================================

import { RawJobItem } from "@/types";

/**
 * Query parameters that all adapters can accept.
 * Individual adapters may ignore fields that don't apply.
 */
export interface JobSearchQuery {
  keywords: string[];
  negativeKeywords?: string[]; // terms to exclude — passed as -keyword to Reed, what_exclude to Adzuna
  location?: string;
  radius?: number; // miles
  maxResults?: number;
  page?: number;
  salaryMin?: number;
  salaryMax?: number;
  remoteOnly?: boolean;
  postedAfter?: string; // ISO date
}

/** Standard exclusions for all pharma/life-sciences searches — blocks financial and retail noise. */
export const PHARMA_NEGATIVE_KEYWORDS: string[] = [
  "tax",
  "accountant",
  "chartered accountant",
  "chartered tax",
  "finance manager",
  "financial analyst",
  "investment",
  "retail pharmacy",
  "community pharmacy",
  "locum",
  "dispensary manager",
];

/**
 * Result from a source fetch.
 */
export interface JobSourceResult {
  source: string;
  jobs: RawJobItem[];
  totalAvailable: number;
  fetchedAt: string;
  query: JobSearchQuery;
  pageInfo?: {
    page: number;
    perPage: number;
    hasMore: boolean;
  };
  error?: string;
}

/**
 * Every job source adapter must implement this interface.
 */
export interface JobSourceAdapter {
  /** Unique source identifier, e.g. "adzuna", "reed" */
  readonly sourceId: string;

  /** Human-readable name */
  readonly displayName: string;

  /** Check if the adapter is configured and usable */
  isConfigured(): Promise<boolean>;

  /** Fetch jobs matching the query */
  fetchJobs(query: JobSearchQuery): Promise<JobSourceResult>;
}

/**
 * Default search queries used by the worker.
 * These target the user's transition role tracks.
 */
/**
 * Default search queries used by the worker.
 * These target the user's transition role tracks across the UK,
 * with Scotland as priority but not the only focus.
 *
 * Locations cover the main UK pharma corridors:
 * - Glasgow / Edinburgh / Scotland
 * - London / Cambridge / Oxford (Golden Triangle)
 * - Manchester / Leeds / North West
 * - UK Remote / UK Hybrid
 */
export const DEFAULT_SEARCH_QUERIES: JobSearchQuery[] = [
  // --- Scotland (priority) ---
  {
    keywords: ["quality assurance", "pharmaceutical"],
    location: "Glasgow",
    radius: 30,
    maxResults: 25,
  },
  {
    keywords: ["regulatory affairs"],
    location: "Scotland",
    maxResults: 25,
  },
  {
    keywords: ["pharmacovigilance"],
    location: "Scotland",
    maxResults: 25,
  },
  {
    keywords: ["clinical research associate"],
    location: "Scotland",
    maxResults: 25,
  },
  {
    keywords: ["clinical trial assistant"],
    location: "Scotland",
    maxResults: 25,
  },
  {
    keywords: ["study coordinator", "clinical"],
    location: "Scotland",
    maxResults: 20,
  },
  {
    keywords: ["quality systems", "GMP"],
    location: "Scotland",
    maxResults: 20,
  },
  {
    keywords: ["compliance", "pharmaceutical"],
    location: "Scotland",
    maxResults: 20,
  },
  {
    keywords: ["medical device", "regulatory affairs"],
    location: "Scotland",
    maxResults: 20,
  },

  // --- England pharma hubs ---
  {
    keywords: ["quality assurance", "pharmaceutical"],
    location: "London",
    maxResults: 25,
  },
  {
    keywords: ["regulatory affairs", "pharmaceutical"],
    location: "London",
    maxResults: 25,
  },
  {
    keywords: ["pharmacovigilance"],
    location: "London",
    maxResults: 25,
  },
  {
    keywords: ["medical information", "pharmaceutical"],
    location: "London",
    maxResults: 20,
  },
  {
    keywords: ["quality assurance", "GMP"],
    location: "Cambridge",
    radius: 30,
    maxResults: 20,
  },
  {
    keywords: ["regulatory affairs"],
    location: "Cambridge",
    radius: 30,
    maxResults: 20,
  },
  {
    keywords: ["pharmacovigilance"],
    location: "Manchester",
    radius: 30,
    maxResults: 20,
  },
  {
    keywords: ["clinical research associate"],
    location: "Manchester",
    radius: 30,
    maxResults: 20,
  },
  {
    keywords: ["quality assurance", "pharmaceutical"],
    location: "Oxford",
    radius: 30,
    maxResults: 20,
  },
  {
    keywords: ["regulatory affairs", "medical device"],
    location: "Oxford",
    radius: 30,
    maxResults: 20,
  },
  {
    keywords: ["quality systems", "compliance"],
    location: "Leeds",
    radius: 30,
    maxResults: 20,
  },
  {
    keywords: ["pharmacovigilance", "drug safety"],
    location: "Leeds",
    radius: 30,
    maxResults: 20,
  },
  {
    keywords: ["clinical trial assistant"],
    location: "Birmingham",
    radius: 30,
    maxResults: 20,
  },
  {
    keywords: ["medical information"],
    location: "Nottingham",
    radius: 30,
    maxResults: 20,
  },
  {
    keywords: ["regulatory affairs"],
    location: "Reading",
    radius: 25,
    maxResults: 20,
  },

  // --- UK-wide remote/hybrid ---
  {
    keywords: ["pharmacovigilance"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 25,
  },
  {
    keywords: ["regulatory affairs"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 25,
  },
  {
    keywords: ["quality assurance", "pharmaceutical"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 25,
  },
  {
    keywords: ["medical information"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 20,
  },
  {
    keywords: ["clinical research"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 20,
  },
  {
    keywords: ["clinical trial assistant"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 20,
  },
  {
    keywords: ["quality systems", "compliance"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 20,
  },
  {
    keywords: ["medical device regulatory"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 20,
  },
  {
    keywords: ["regulatory operations"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 20,
  },
  {
    keywords: ["drug safety", "case processing"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 20,
  },
  {
    keywords: ["medical information", "scientific"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 20,
  },
  {
    keywords: ["CTA", "clinical research"],
    negativeKeywords: [...PHARMA_NEGATIVE_KEYWORDS, "chartered tax", "tax advisor", "credit trading"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 20,
  },

  // --- Broader keyword variants ---
  {
    keywords: ["QA", "GMP"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["drug safety"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["medical affairs", "pharmaceutical"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["clinical trials", "associate"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["QA officer"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["quality specialist", "GDocP"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["compliance officer", "life sciences"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["regulatory associate", "medical device"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["regulatory operations", "submission"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["drug safety associate"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["case processor", "pharmacovigilance"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["medical information associate"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["scientific information", "medical"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["clinical trial assistant", "site activation"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["TMF", "clinical trial assistant"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["CRA", "clinical research associate"],
    location: "United Kingdom",
    maxResults: 25,
  },
  {
    keywords: ["CRA I", "monitoring"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["site management associate"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["study start up associate"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["clinical operations coordinator"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["trial coordinator", "clinical"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["site activation specialist"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["clinical project assistant"],
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["research assistant", "clinical trials"],
    location: "United Kingdom",
    maxResults: 20,
  },
];
