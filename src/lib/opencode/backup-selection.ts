import { promises as fs } from "fs";
import path from "path";

export interface BackupSelectionEntry {
  relativePath: string;
  fullPath: string;
  sizeBytes: number;
}

export interface BackupSelectionResult {
  included: BackupSelectionEntry[];
  excluded: string[];
}

export const BACKUP_INCLUDED_ROOTS = ["data", "data/opencode"] as const;

export const BACKUP_EXCLUDED_PATTERNS = [
  /(?:^|[\\/])\.env(?:\.|$)/i,
  /^node_modules(?:[\\/]|$)/i,
  /^\.next(?:[\\/]|$)/i,
  /^\.logs(?:[\\/]|$)/i,
  /(?:^|[\\/]).+\.log$/i,
  /^python-ai[\\/]\.venv(?:[\\/]|$)/i,
  /^python-ai(?:[\\/].+)?[\\/]__pycache__(?:[\\/]|$)/i,
  /(?:^|[\\/])(?:gmail-token\.json|gcp-oauth\.keys\.json)$/i,
  /(?:^|[\\/])(?:[^\\/]*[-_.])?(?:oauth|token|credentials?|credential)(?:[-_.][^\\/]*)?\.(?:json|txt|key|pem)$/i,
  /^private(?:[\\/]|$)/i,
  /^data[\\/]generated-cvs(?:[\\/]|$)/i,
  /^data[\\/]playwright-auto-apply(?:[\\/]|$)/i,
  /^life-os-workspace\.json$/i,
  /^life-os-source\.json$/i,
] as const;

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function shouldExcludeBackupPath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  return BACKUP_EXCLUDED_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isWithinBackupRoots(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  return normalized === "data" || normalized.startsWith("data/");
}

export function buildBackupSelectionFromRelativePaths(relativePaths: string[]): BackupSelectionResult {
  const included: BackupSelectionEntry[] = [];
  const excluded: string[] = [];

  for (const original of relativePaths) {
    const relativePath = normalizeRelativePath(original);
    if (!isWithinBackupRoots(relativePath) || shouldExcludeBackupPath(relativePath)) {
      excluded.push(relativePath);
      continue;
    }

    included.push({
      relativePath,
      fullPath: relativePath,
      sizeBytes: 0,
    });
  }

  return { included, excluded };
}

export async function collectBackupSelection(repoRoot: string): Promise<BackupSelectionResult> {
  const dataRoot = path.join(repoRoot, "data");
  const files = await listFilesRecursive(dataRoot);
  const included: BackupSelectionEntry[] = [];
  const excluded: string[] = [];

  for (const fullPath of files) {
    const relativePath = normalizeRelativePath(path.relative(repoRoot, fullPath));
    if (!isWithinBackupRoots(relativePath) || shouldExcludeBackupPath(relativePath)) {
      excluded.push(relativePath);
      continue;
    }

    const stats = await fs.stat(fullPath);
    included.push({
      relativePath,
      fullPath,
      sizeBytes: stats.size,
    });
  }

  return { included, excluded };
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await listFilesRecursive(fullPath)));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
}
