import { describe, expect, it } from "vitest";
import {
  buildBackupSelectionFromRelativePaths,
  shouldExcludeBackupPath,
} from "./backup-selection";
import {
  BACKUP_APP_NAME,
  BACKUP_ENCRYPTION_METHOD,
  BACKUP_VERSION,
  RESTORE_INSTRUCTIONS_VERSION,
  createBackupManifest,
  validateBackupManifest,
} from "./backup-manifest";

describe("backup selection", () => {
  it("includes data and data/opencode files", () => {
    const result = buildBackupSelectionFromRelativePaths([
      "data/jobs-ranked.json",
      "data/opencode/apps-status.json",
    ]);

    expect(result.included.map((item) => item.relativePath)).toEqual([
      "data/jobs-ranked.json",
      "data/opencode/apps-status.json",
    ]);
  });

  it("excludes .env files", () => {
    expect(shouldExcludeBackupPath(".env.local")).toBe(true);
    expect(shouldExcludeBackupPath("data/.env.backup")).toBe(true);
  });

  it("excludes OAuth/token files", () => {
    expect(shouldExcludeBackupPath("data/gmail-token.json")).toBe(true);
    expect(shouldExcludeBackupPath("data/gcp-oauth.keys.json")).toBe(true);
    expect(shouldExcludeBackupPath("data/oauth-credentials.json")).toBe(true);
  });

  it("excludes plaintext private files", () => {
    expect(shouldExcludeBackupPath("private/export.txt")).toBe(true);
    expect(shouldExcludeBackupPath("private/exports/archive.age")).toBe(true);
  });

  it("excludes logs, build outputs, dependencies, caches, and bulky artifacts", () => {
    expect(shouldExcludeBackupPath("node_modules/foo.js")).toBe(true);
    expect(shouldExcludeBackupPath(".next/server/app.js")).toBe(true);
    expect(shouldExcludeBackupPath("python-ai/.venv/Scripts/python.exe")).toBe(true);
    expect(shouldExcludeBackupPath("python-ai/tests/__pycache__/cache.pyc")).toBe(true);
    expect(shouldExcludeBackupPath("data/generated-cvs/cv.pdf")).toBe(true);
    expect(shouldExcludeBackupPath("data/playwright-auto-apply/evidence.png")).toBe(true);
    expect(shouldExcludeBackupPath(".logs/runtime.log")).toBe(true);
  });
});

describe("backup manifest", () => {
  it("includes required manifest fields", () => {
    const manifest = createBackupManifest({
      includedPaths: ["data", "data/opencode"],
      fileCount: 3,
      byteCount: 1234,
    });

    expect(manifest.backupVersion).toBe(BACKUP_VERSION);
    expect(manifest.restoreInstructionsVersion).toBe(RESTORE_INSTRUCTIONS_VERSION);
    expect(manifest.appName).toBe(BACKUP_APP_NAME);
    expect(manifest.encryptionMethod).toBe(BACKUP_ENCRYPTION_METHOD);
    expect(manifest.includedPaths).toEqual(["data", "data/opencode"]);
  });

  it("restore validation rejects malformed manifest", () => {
    const result = validateBackupManifest({
      backupVersion: 999,
      includedPaths: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("restore validation rejects unsafe manifest paths", () => {
    const manifest = createBackupManifest({
      includedPaths: ["data", ".env.local"],
      fileCount: 1,
      byteCount: 100,
    });

    const result = validateBackupManifest(manifest, ["data/jobs-ranked.json", ".env.local"]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("forbidden") || error.includes("excluded"))).toBe(true);
  });
});
