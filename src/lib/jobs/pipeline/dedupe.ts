// ============================================================
// Job deduplication engine.
// Prevents the same job from being stored/processed multiple
// times, both within a single source and across all sources.
//
// Dedupe rules:
// 1. title + company + link (primary — most reliable)
// 2. title + company + normalized location (fallback if no link)
// 3. sourceJobId per source (source-level dedupe)
// ============================================================

import { RawJobItem } from "@/types";
import { generateDedupeKey } from "@/lib/jobs/sources/normalize";
import { getAllDedupeKeys } from "@/lib/jobs/storage";

export interface DedupeResult {
  /** Jobs that passed deduplication — genuinely new */
  newJobs: RawJobItem[];
  /** Jobs that were duplicates — already seen */
  duplicates: RawJobItem[];
  /** Stats */
  stats: {
    inputCount: number;
    newCount: number;
    duplicateCount: number;
    inBatchDuplicates: number;
    crossCollectionDuplicates: number;
  };
}

/**
 * Deduplicate a batch of raw jobs against:
 * 1. Each other (within the batch)
 * 2. All existing jobs across all collections
 */
export async function deduplicateJobs(
  jobs: RawJobItem[]
): Promise<DedupeResult> {
  const existingKeys = await getAllDedupeKeys();
  const batchKeys = new Set<string>();
  const newJobs: RawJobItem[] = [];
  const duplicates: RawJobItem[] = [];
  let inBatchDuplicates = 0;
  let crossCollectionDuplicates = 0;

  for (const job of jobs) {
    const dedupeKey = generateDedupeKey(job);

    // Check against existing collections
    if (existingKeys.has(dedupeKey)) {
      duplicates.push(job);
      crossCollectionDuplicates++;
      continue;
    }

    // Check within current batch
    if (batchKeys.has(dedupeKey)) {
      duplicates.push(job);
      inBatchDuplicates++;
      continue;
    }

    // Also check by sourceJobId within the same source
    // (some sources give unique IDs that are more reliable)
    if (job.sourceJobId) {
      const sourceKey = `${job.source}::${job.sourceJobId}`;
      if (batchKeys.has(sourceKey) || existingKeys.has(sourceKey)) {
        duplicates.push(job);
        inBatchDuplicates++;
        continue;
      }
      batchKeys.add(sourceKey);
    }

    batchKeys.add(dedupeKey);
    newJobs.push(job);
  }

  const stats = {
    inputCount: jobs.length,
    newCount: newJobs.length,
    duplicateCount: duplicates.length,
    inBatchDuplicates,
    crossCollectionDuplicates,
  };

  console.log(
    `[dedupe] ${stats.inputCount} in → ${stats.newCount} new, ${stats.duplicateCount} duplicates ` +
    `(${inBatchDuplicates} in-batch, ${crossCollectionDuplicates} cross-collection)`
  );

  return { newJobs, duplicates, stats };
}

/**
 * Quick check if a single job is a duplicate.
 */
export async function isDuplicate(job: RawJobItem): Promise<boolean> {
  const existingKeys = await getAllDedupeKeys();
  const dedupeKey = generateDedupeKey(job);
  return existingKeys.has(dedupeKey);
}