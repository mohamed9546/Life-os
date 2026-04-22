// ============================================================
// Job source adapter registry.
// Single import point for all source adapters.
//
// Every built adapter is registered here. Each one's own
// isConfigured() decides whether it fires on a given run —
// unconfigured adapters are filtered out by getActiveAdapters().
// ============================================================

import { JobSourceAdapter } from "./types";

// UK-native, key-gated (best UK coverage)
import { AdzunaAdapter } from "./adzuna";
import { ReedAdapter } from "./reed";
import { SerpApiAdapter } from "./serpapi";

// Company-board scrapers (no key; built-in company list)
import { GreenhouseAdapter } from "./greenhouse";
import { LeverAdapter } from "./lever";
import { JoobleAdapter } from "./jooble";

// Public remote/tech boards (free, no key)
import { RemotiveAdapter } from "./remotive";
import { ArbeitnowAdapter } from "./arbeitnow";
import { HimalayasAdapter } from "./himalayas";
import { BrightNetworkAdapter } from "./brightnetwork";
import { TheMuseAdapter } from "./themuse";
import { CareerJetAdapter } from "./careerjet";
import { FindWorkAdapter } from "./findwork";
import { LinkedInAdapter } from "./linkedin";
import { RapidAPILinkedInAdapter } from "./rapidapi-linkedin";
import { IndeedAdapter } from "./indeed";
import { WeWorkRemotelyAdapter } from "./weworkremotely";
import { GuardianJobsAdapter } from "./guardianjobs";

/**
 * All registered job source adapters.
 * Each adapter's isConfigured() determines whether it actually runs.
 */
export function getAllAdapters(): JobSourceAdapter[] {
  return [
    // Reliable beta sources
    new AdzunaAdapter(),
    new ReedAdapter(),
    new SerpApiAdapter(),
    new GreenhouseAdapter(),
    new LeverAdapter(),
    new JoobleAdapter(),
    new RemotiveAdapter(),
    new ArbeitnowAdapter(),
    new HimalayasAdapter(),
    new BrightNetworkAdapter(),
    new TheMuseAdapter(),
    new CareerJetAdapter(),
    new FindWorkAdapter(),
    new LinkedInAdapter(),
    new RapidAPILinkedInAdapter(),
    new IndeedAdapter(),
    new WeWorkRemotelyAdapter(),
    new GuardianJobsAdapter(),
  ];
}

/**
 * Get only configured and enabled adapters.
 * The pipeline uses this — unconfigured sources are silently skipped.
 */
export async function getActiveAdapters(): Promise<JobSourceAdapter[]> {
  const all = getAllAdapters();
  const checks = await Promise.all(
    all.map(async (adapter) => ({
      adapter,
      configured: await adapter.isConfigured(),
    }))
  );
  return checks.filter((c) => c.configured).map((c) => c.adapter);
}

/**
 * Get a specific adapter by source ID.
 */
export function getAdapter(sourceId: string): JobSourceAdapter | null {
  const all = getAllAdapters();
  return all.find((a) => a.sourceId === sourceId) || null;
}


export async function getAdapterConfigStatus(): Promise<Array<{ sourceId: string; displayName: string; configured: boolean }>> {
  const all = getAllAdapters();
  return Promise.all(
    all.map(async (adapter) => ({
      sourceId: adapter.sourceId,
      displayName: adapter.displayName,
      configured: await adapter.isConfigured(),
    }))
  );
}

export { type JobSourceAdapter, type JobSearchQuery, type JobSourceResult } from "./types";
export { DEFAULT_SEARCH_QUERIES } from "./types";
export {
  normalizeRawJob,
  isUsableRawJob,
  generateDedupeKey,
  detectRemoteType,
  detectEmploymentType,
} from "./normalize";
