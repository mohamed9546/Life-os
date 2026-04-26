import { promises as fs } from "fs";
import path from "path";

let cachedPdfParse = null;

export const rootDir = process.cwd();
export const dataDir = path.join(rootDir, "data");
export const opencodeDir = path.join(dataDir, "opencode");

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^title\s*:\s*/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readJsonFile(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err?.code === "ENOENT") {
      return fallback;
    }
    throw err;
  }
}

export async function writeJsonFile(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readTextFile(filePath, fallback = "") {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") {
      return fallback;
    }
    throw err;
  }
}

export async function writeTextFile(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, value, "utf8");
}

export async function appendTextFile(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, value, "utf8");
}

export function opencodePath(...parts) {
  return path.join(opencodeDir, ...parts);
}

export function dataPath(...parts) {
  return path.join(dataDir, ...parts);
}

export async function loadLocalCollection(name) {
  return readJsonFile(dataPath(`${name}.json`), []);
}

export async function loadOpenCodeJson(name, fallback) {
  return readJsonFile(opencodePath(name), fallback);
}

export async function saveOpenCodeJson(name, value) {
  return writeJsonFile(opencodePath(name), value);
}

export async function saveOpenCodeText(name, value) {
  return writeTextFile(opencodePath(name), value);
}

export function normalizeTitle(value) {
  return String(value || "")
    .replace(/^title\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseMarkdownTasks(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^-\s+/.test(line) || /^-\s+\[.\]\s+/.test(line))
    .map((line) => line.replace(/^-\s+(\[[ xX]\]\s+)?/, "").trim())
    .filter(Boolean);
}

export async function listFilesRecursive(baseDir) {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const fullPath = path.join(baseDir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await listFilesRecursive(fullPath)));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
    return files;
  } catch (err) {
    if (err?.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

export async function readDocumentText(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".pdf") {
    if (!cachedPdfParse) {
      const pdfModule = await import("pdf-parse");
      cachedPdfParse = pdfModule.default || pdfModule;
    }
    const buffer = await fs.readFile(filePath);
    const parsed = await cachedPdfParse(buffer);
    return parsed.text || "";
  }
  return fs.readFile(filePath, "utf8");
}

function getLatestByDedupeKey(items) {
  const latest = new Map();
  for (const item of items) {
    if (!item?.dedupeKey) continue;
    const current = latest.get(item.dedupeKey);
    const currentAt = new Date(current?.attemptedAt || current?.updatedAt || 0).getTime();
    const nextAt = new Date(item.attemptedAt || item.updatedAt || 0).getTime();
    if (!current || nextAt >= currentAt) {
      latest.set(item.dedupeKey, item);
    }
  }
  return latest;
}

export async function buildAppsStatus() {
  const [logs, ranked, enriched, inbox, rejected] = await Promise.all([
    loadLocalCollection("application-logs"),
    loadLocalCollection("jobs-ranked"),
    loadLocalCollection("jobs-enriched"),
    loadLocalCollection("jobs-inbox"),
    loadLocalCollection("jobs-rejected"),
  ]);

  const logMap = getLatestByDedupeKey(logs);
  const jobMap = getLatestByDedupeKey(
    [...ranked, ...enriched, ...inbox, ...rejected].filter((job) =>
      ["applied", "interview", "offer", "tracked", "shortlisted"].includes(job?.status)
    )
  );
  const keys = new Set([...logMap.keys(), ...jobMap.keys()]);
  const now = new Date();

  const candidates = Array.from(keys).map((dedupeKey) => {
    const log = logMap.get(dedupeKey) || null;
    const job = jobMap.get(dedupeKey) || null;
    const attemptedAt = log?.attemptedAt || null;
    const daysSilent = attemptedAt
      ? Math.floor((now.getTime() - new Date(attemptedAt).getTime()) / 86400000)
      : null;
    const followUpStage = daysSilent == null ? null : daysSilent >= 18 ? "second" : daysSilent >= 8 ? "first" : null;
    const appStatus = log?.status || "none";
    const pipelineStatus = job?.status || "unknown";
    const actionable = ["planned", "drafted", "applied", "paused"].includes(appStatus);
    return {
      dedupeKey,
      title: normalizeTitle(job?.raw?.title || log?.title || "Unknown role"),
      company: job?.raw?.company || log?.company || "Unknown company",
      source: job?.raw?.source || log?.source || "unknown",
      appStatus,
      pipelineStatus,
      fitScore: job?.fit?.data?.fitScore ?? log?.fitScore ?? null,
      attemptedAt,
      daysSilent,
      followUpStage: actionable ? followUpStage : null,
      ghosted: actionable && (daysSilent ?? 0) >= 21 && !["interview", "offer"].includes(pipelineStatus),
      gmailDraftId: log?.gmailDraftId,
      applyUrl: log?.applyUrl || job?.raw?.link,
    };
  }).sort((left, right) => (right.fitScore || 0) - (left.fitScore || 0));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      tracked: candidates.filter((item) => ["tracked", "shortlisted"].includes(item.pipelineStatus)).length,
      applied: candidates.filter((item) => item.pipelineStatus === "applied" || item.appStatus === "applied").length,
      interview: candidates.filter((item) => item.pipelineStatus === "interview").length,
      offer: candidates.filter((item) => item.pipelineStatus === "offer").length,
      rejected: candidates.filter((item) => item.pipelineStatus === "rejected").length,
      drafted: candidates.filter((item) => item.appStatus === "drafted").length,
      planned: candidates.filter((item) => item.appStatus === "planned").length,
      paused: candidates.filter((item) => item.appStatus === "paused").length,
      ghosted: candidates.filter((item) => item.ghosted).length,
      followUpFirstDue: candidates.filter((item) => item.followUpStage === "first").length,
      followUpSecondDue: candidates.filter((item) => item.followUpStage === "second").length,
    },
    candidates,
  };
}
