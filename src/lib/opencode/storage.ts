import { promises as fs } from "fs";
import path from "path";

const OPENCODE_ROOT = path.join(process.cwd(), "data", "opencode");

async function ensureParent(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export function getOpenCodeRoot(): string {
  return OPENCODE_ROOT;
}

export function getOpenCodePath(relativePath: string): string {
  return path.join(OPENCODE_ROOT, relativePath.replace(/^[/\\]+/, ""));
}

export async function readOpenCodeJson<T>(
  relativePath: string,
  fallback: T
): Promise<T> {
  const filePath = getOpenCodePath(relativePath);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw err;
  }
}

export async function writeOpenCodeJson<T>(
  relativePath: string,
  value: T
): Promise<void> {
  const filePath = getOpenCodePath(relativePath);
  await ensureParent(filePath);
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readOpenCodeText(
  relativePath: string,
  fallback = ""
): Promise<string> {
  const filePath = getOpenCodePath(relativePath);
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw err;
  }
}

export async function writeOpenCodeText(
  relativePath: string,
  value: string
): Promise<void> {
  const filePath = getOpenCodePath(relativePath);
  await ensureParent(filePath);
  await fs.writeFile(filePath, value, "utf8");
}

export async function appendOpenCodeText(
  relativePath: string,
  value: string
): Promise<void> {
  const filePath = getOpenCodePath(relativePath);
  await ensureParent(filePath);
  await fs.appendFile(filePath, value, "utf8");
}

export async function listOpenCodeFiles(relativeDir: string): Promise<string[]> {
  const base = getOpenCodePath(relativeDir);
  try {
    return await listFilesRecursive(base);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}
