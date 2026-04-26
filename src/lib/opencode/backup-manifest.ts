import {
  BACKUP_EXCLUDED_PATTERNS,
  BACKUP_INCLUDED_ROOTS,
  shouldExcludeBackupPath,
} from "./backup-selection";

export const BACKUP_VERSION = 1;
export const RESTORE_INSTRUCTIONS_VERSION = 1;
export const BACKUP_APP_NAME = "Life-OS";
export const BACKUP_ENCRYPTION_METHOD = "zip+age";

export interface BackupManifest {
  backupVersion: number;
  createdAt: string;
  sourceRoot: string;
  includedPaths: string[];
  excludedPatterns: string[];
  fileCount: number;
  byteCount: number;
  encryptionMethod: string;
  restoreInstructionsVersion: number;
  appName: string;
}

export function createBackupManifest(input: {
  createdAt?: string;
  sourceRoot?: string;
  includedPaths: string[];
  fileCount: number;
  byteCount: number;
}): BackupManifest {
  return {
    backupVersion: BACKUP_VERSION,
    createdAt: input.createdAt || new Date().toISOString(),
    sourceRoot: input.sourceRoot || ".",
    includedPaths: input.includedPaths,
    excludedPatterns: BACKUP_EXCLUDED_PATTERNS.map((pattern) => pattern.source),
    fileCount: input.fileCount,
    byteCount: input.byteCount,
    encryptionMethod: BACKUP_ENCRYPTION_METHOD,
    restoreInstructionsVersion: RESTORE_INSTRUCTIONS_VERSION,
    appName: BACKUP_APP_NAME,
  };
}

export function validateBackupManifest(
  manifest: unknown,
  extractedPaths: string[] = []
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== "object") {
    return { valid: false, errors: ["Manifest is missing or not an object."] };
  }

  const value = manifest as Partial<BackupManifest>;

  if (value.backupVersion !== BACKUP_VERSION) {
    errors.push(`Unsupported backupVersion: ${String(value.backupVersion)}.`);
  }
  if (typeof value.createdAt !== "string" || !value.createdAt.trim()) {
    errors.push("Manifest createdAt is missing.");
  }
  if (typeof value.sourceRoot !== "string" || !value.sourceRoot.trim()) {
    errors.push("Manifest sourceRoot is missing.");
  }
  if (!Array.isArray(value.includedPaths) || value.includedPaths.length === 0) {
    errors.push("Manifest includedPaths is missing.");
  }
  if (typeof value.fileCount !== "number" || value.fileCount < 0) {
    errors.push("Manifest fileCount is invalid.");
  }
  if (typeof value.byteCount !== "number" || value.byteCount < 0) {
    errors.push("Manifest byteCount is invalid.");
  }
  if (value.encryptionMethod !== BACKUP_ENCRYPTION_METHOD) {
    errors.push(`Unsupported encryption method: ${String(value.encryptionMethod)}.`);
  }
  if (value.restoreInstructionsVersion !== RESTORE_INSTRUCTIONS_VERSION) {
    errors.push(
      `Unsupported restoreInstructionsVersion: ${String(value.restoreInstructionsVersion)}.`
    );
  }
  if (value.appName !== BACKUP_APP_NAME) {
    errors.push(`Unexpected appName: ${String(value.appName)}.`);
  }

  for (const includePath of value.includedPaths || []) {
    const normalized = includePath.replace(/\\/g, "/");
    const allowed = BACKUP_INCLUDED_ROOTS.some(
      (root) => normalized === root || normalized.startsWith(`${root}/`)
    );
    if (!allowed) {
      errors.push(`Manifest includes forbidden path root: ${normalized}.`);
    }
    if (shouldExcludeBackupPath(normalized)) {
      errors.push(`Manifest includes excluded path: ${normalized}.`);
    }
  }

  if (extractedPaths.length > 0) {
    const normalizedExtracted = extractedPaths.map((item) => item.replace(/\\/g, "/"));
    if (!normalizedExtracted.some((item) => item === "data" || item.startsWith("data/"))) {
      errors.push("Restored payload does not contain expected data/ structure.");
    }
    for (const item of normalizedExtracted) {
      if (shouldExcludeBackupPath(item)) {
        errors.push(`Restored payload contains forbidden path: ${item}.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
