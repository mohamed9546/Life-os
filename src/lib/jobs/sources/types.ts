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
  // =====================================================
  // PRIMARY TARGET — Clinical Trial / Research roles
  // =====================================================

  // --- Scotland (priority) ---
  {
    keywords: ["clinical trial assistant"],
    negativeKeywords: [...PHARMA_NEGATIVE_KEYWORDS, "senior", "lead", "principal", "director"],
    location: "Glasgow",
    radius: 30,
    maxResults: 25,
  },
  {
    keywords: ["clinical research coordinator"],
    negativeKeywords: [...PHARMA_NEGATIVE_KEYWORDS, "senior", "lead", "principal"],
    location: "Scotland",
    maxResults: 25,
  },
  {
    keywords: ["clinical operations assistant"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "Scotland",
    maxResults: 25,
  },
  {
    keywords: ["study start-up", "coordinator"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "Scotland",
    maxResults: 20,
  },
  {
    keywords: ["site activation", "assistant"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "Scotland",
    maxResults: 20,
  },
  {
    keywords: ["trial administrator"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "Scotland",
    maxResults: 20,
  },
  {
    keywords: ["clinical project assistant"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "Scotland",
    maxResults: 20,
  },

  // --- UK-wide primary targets ---
  {
    keywords: ["clinical trial assistant"],
    negativeKeywords: [...PHARMA_NEGATIVE_KEYWORDS, "senior", "lead", "principal", "director"],
    location: "United Kingdom",
    maxResults: 25,
  },
  {
    keywords: ["clinical research coordinator"],
    negativeKeywords: [...PHARMA_NEGATIVE_KEYWORDS, "senior", "lead", "principal"],
    location: "United Kingdom",
    maxResults: 25,
  },
  {
    keywords: ["clinical operations coordinator"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 25,
  },
  {
    keywords: ["clinical study coordinator"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 25,
  },
  {
    keywords: ["study start-up assistant"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["study start-up coordinator"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["site activation coordinator"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["trial administrator"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["clinical project assistant"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["junior CRA"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["in-house CRA"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["TMF", "clinical trial"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["eTMF", "coordinator"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["ICH-GCP", "assistant"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 20,
  },

  // --- UK-wide remote/hybrid primary ---
  {
    keywords: ["clinical trial assistant"],
    negativeKeywords: [...PHARMA_NEGATIVE_KEYWORDS, "senior", "lead"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 25,
  },
  {
    keywords: ["clinical research coordinator"],
    negativeKeywords: [...PHARMA_NEGATIVE_KEYWORDS, "senior", "lead"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 25,
  },
  {
    keywords: ["study start-up", "clinical"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 20,
  },
  {
    keywords: ["clinical operations", "assistant"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 20,
  },

  // --- Ireland primary targets ---
  {
    keywords: ["clinical trial assistant"],
    negativeKeywords: [...PHARMA_NEGATIVE_KEYWORDS, "senior", "lead", "principal"],
    location: "Ireland",
    maxResults: 25,
  },
  {
    keywords: ["clinical research coordinator"],
    negativeKeywords: [...PHARMA_NEGATIVE_KEYWORDS, "senior", "lead", "principal"],
    location: "Ireland",
    maxResults: 25,
  },
  {
    keywords: ["clinical operations coordinator"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "Ireland",
    maxResults: 20,
  },
  {
    keywords: ["study start-up", "coordinator"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "Ireland",
    maxResults: 20,
  },
  {
    keywords: ["site activation", "clinical"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "Ireland",
    maxResults: 20,
  },
  {
    keywords: ["clinical project assistant"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "Dublin",
    radius: 50,
    maxResults: 20,
  },
  {
    keywords: ["junior CRA"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "Ireland",
    maxResults: 20,
  },

  // =====================================================
  // SECONDARY TARGET — QA, Regulatory, PV, MedInfo
  // =====================================================

  // --- Scotland secondary ---
  {
    keywords: ["quality assurance", "pharmaceutical"],
    negativeKeywords: [...PHARMA_NEGATIVE_KEYWORDS, "senior", "lead", "director"],
    location: "Glasgow",
    radius: 30,
    maxResults: 25,
  },
  {
    keywords: ["regulatory affairs", "assistant"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "Scotland",
    maxResults: 25,
  },
  {
    keywords: ["pharmacovigilance", "associate"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "Scotland",
    maxResults: 25,
  },
  {
    keywords: ["document control", "pharmaceutical"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "Scotland",
    maxResults: 20,
  },

  // --- UK-wide secondary ---
  {
    keywords: ["QA associate", "pharmaceutical"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 25,
  },
  {
    keywords: ["quality systems", "compliance"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["regulatory affairs assistant"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 25,
  },
  {
    keywords: ["regulatory operations", "associate"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["pharmacovigilance associate"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 25,
  },
  {
    keywords: ["drug safety associate"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 25,
  },
  {
    keywords: ["medical information associate"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["document control", "GMP"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 20,
  },
  {
    keywords: ["research governance", "support"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    maxResults: 20,
  },

  // --- UK-wide remote secondary ---
  {
    keywords: ["pharmacovigilance"],
    negativeKeywords: [...PHARMA_NEGATIVE_KEYWORDS, "senior", "lead", "manager"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 25,
  },
  {
    keywords: ["regulatory affairs"],
    negativeKeywords: [...PHARMA_NEGATIVE_KEYWORDS, "senior", "lead", "director"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 25,
  },
  {
    keywords: ["drug safety", "case processing"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 20,
  },
  {
    keywords: ["medical information"],
    negativeKeywords: [...PHARMA_NEGATIVE_KEYWORDS, "senior", "lead"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 20,
  },
  {
    keywords: ["quality assurance", "pharmaceutical"],
    negativeKeywords: [...PHARMA_NEGATIVE_KEYWORDS, "senior", "lead", "director"],
    location: "United Kingdom",
    remoteOnly: true,
    maxResults: 25,
  },

  // --- Ireland secondary ---
  {
    keywords: ["regulatory affairs", "assistant"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "Ireland",
    maxResults: 20,
  },
  {
    keywords: ["pharmacovigilance", "associate"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "Ireland",
    maxResults: 20,
  },
  {
    keywords: ["quality assurance", "pharmaceutical"],
    negativeKeywords: [...PHARMA_NEGATIVE_KEYWORDS, "senior", "lead", "director"],
    location: "Ireland",
    maxResults: 20,
  },
  {
    keywords: ["drug safety associate"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "Ireland",
    maxResults: 20,
  },
  {
    keywords: ["document control", "pharmaceutical"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "Dublin",
    radius: 50,
    maxResults: 20,
  },

  // --- London (secondary, hybrid only if strong fit) ---
  {
    keywords: ["clinical trial assistant"],
    negativeKeywords: [...PHARMA_NEGATIVE_KEYWORDS, "senior", "lead"],
    location: "London",
    maxResults: 20,
  },
  {
    keywords: ["pharmacovigilance", "associate"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "London",
    maxResults: 20,
  },
  {
    keywords: ["regulatory affairs", "assistant"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "London",
    maxResults: 20,
  },
  {
    keywords: ["medical information", "associate"],
    negativeKeywords: PHARMA_NEGATIVE_KEYWORDS,
    location: "London",
    maxResults: 20,
  },
];
