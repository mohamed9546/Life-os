import { promises as fs } from "fs";
import path from "path";

const root = process.cwd();
const dataDir = path.join(root, "data");
const tokenPath = path.join(dataDir, "gmail-token.json");
const generatedCvDir = path.join(dataDir, "generated-cvs");

const TARGET_TITLE_PATTERNS = [
  /^jack up rig mover$/i,
  /^food & beverage coordinator$/i,
  /^aviation security trainer$/i,
  /^it support apprentice$/i,
  /^advice quality consultant$/i,
  /^band 6 ct radiographer(?:\s*-\s*paisley)?$/i,
  /^ivc system operator$/i,
  /^van driver$/i,
  /^healthcare assessor/i,
  /^biomedical scientist$/i,
  /^laboratory support assistant$/i,
  /^laboratory technician$/i,
  /^qc micro technician$/i,
  /^site engineer$/i,
  /^site fitter$/i,
  /^passive fire surveyor$/i,
  /^stock condition surveyor/i,
  /^production operator$/i,
  /^mobile plant operator$/i,
  /^motor vehicle technician$/i,
  /^hgv technician$/i,
  /^digital support apprentice$/i,
  /^it technician apprentice$/i,
  /^network engineer apprentice$/i,
  /^quality engineer$/i,
  /^quality assurance specialist$/i,
  /^quality engineer.*medical devices/i,
  /^customer service coordinator/i,
  /^meeting & events coordinator$/i,
  /^chef de partie$/i,
  /^housekeeping supervisor$/i,
  /^support co$/i,
  /^trust tax associate$/i,
  /^tax trainee$/i,
  /^personal tax manager$/i,
  /^chartered tax adviser$/i,
  /^ifa advice quality control$/i,
  /^account manager$/i,
];

const TARGET_TITLE_SUBSTRINGS = [
  "tax manager",
  "corporate tax",
  "vice president",
  "regulatory affairs manager",
  "head of quality assurance",
  "senior regulatory specialist",
  "financial services advisory",
  "transaction monitoring analyst",
  "cyber security",
  "structural designer",
  "engineer apprentice",
  "digital operative apprentice",
  "support worker",
  "medical affairs director",
  "regulatory liaison",
  "accountant",
  "paralegal",
  "restructuring",
  "property finance",
  "new build assistant",
];

const COLLECTION_FILES = [
  "jobs-raw.json",
  "jobs-inbox.json",
  "jobs-ranked.json",
  "jobs-rejected.json",
  "jobs-enriched.json",
];

const removedJobIds = new Set();
const removedDedupeKeys = new Set();
const removedDraftIds = new Set();
const removedTailoredCvPaths = new Set();
const removedTitles = new Set();

function normalizeTitle(value) {
  return String(value || "")
    .replace(/^title\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function titleMatches(value) {
  const normalized = normalizeTitle(value);
  return (
    TARGET_TITLE_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    TARGET_TITLE_SUBSTRINGS.some((term) => normalized.includes(term))
  );
}

function candidateTitles(record) {
  return [
    record?.title,
    record?.raw?.title,
    record?.parsed?.data?.title,
    record?.fit?.rawInput?.title,
  ].filter(Boolean);
}

function shouldRemoveRecord(record) {
  if (!record || typeof record !== "object") {
    return false;
  }

  if (record.id && removedJobIds.has(record.id)) {
    return true;
  }

  if (record.jobId && removedJobIds.has(record.jobId)) {
    return true;
  }

  if (record.dedupeKey && removedDedupeKeys.has(record.dedupeKey)) {
    return true;
  }

  if (candidateTitles(record).some(titleMatches)) {
    return true;
  }

  return false;
}

function collectArtifacts(record) {
  if (!record || typeof record !== "object") {
    return;
  }

  for (const title of candidateTitles(record)) {
    if (titleMatches(title)) {
      removedTitles.add(normalizeTitle(title));
    }
  }

  if (record.id) {
    removedJobIds.add(record.id);
  }

  if (record.jobId) {
    removedJobIds.add(record.jobId);
  }

  if (record.dedupeKey) {
    removedDedupeKeys.add(record.dedupeKey);
  }

  if (record.gmailDraftId) {
    removedDraftIds.add(record.gmailDraftId);
  }

  if (record.tailoredCvPath) {
    removedTailoredCvPaths.add(record.tailoredCvPath);
  }
}

async function readJson(fileName) {
  const filePath = path.join(dataDir, fileName);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(fileName, value) {
  const filePath = path.join(dataDir, fileName);
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function cleanNested(value) {
  if (Array.isArray(value)) {
    const next = [];
    for (const item of value) {
      if (shouldRemoveRecord(item)) {
        collectArtifacts(item);
        continue;
      }
      next.push(cleanNested(item));
    }
    return next;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const next = {};
  for (const [key, child] of Object.entries(value)) {
    next[key] = cleanNested(child);
  }
  return next;
}

async function cleanJobCollections() {
  for (const fileName of COLLECTION_FILES) {
    const items = await readJson(fileName);
    const kept = [];
    for (const item of items) {
      if (shouldRemoveRecord(item)) {
        collectArtifacts(item);
        continue;
      }
      kept.push(item);
    }
    await writeJson(fileName, kept);
  }
}

async function cleanJobIntel() {
  const items = await readJson("job-intel.json");
  await writeJson(
    "job-intel.json",
    items.filter((item) => !removedJobIds.has(item.id))
  );
}

async function cleanApplicationLogs() {
  const items = await readJson("application-logs.json");
  const kept = [];
  for (const item of items) {
    if (shouldRemoveRecord(item)) {
      collectArtifacts(item);
      continue;
    }
    kept.push(item);
  }
  await writeJson("application-logs.json", kept);
}

async function cleanPipelineRuns() {
  const items = await readJson("pipeline-runs.json");
  await writeJson("pipeline-runs.json", cleanNested(items));
}

async function deleteGeneratedCvs() {
  for (const filePath of removedTailoredCvPaths) {
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(generatedCvDir))) {
      continue;
    }
    try {
      await fs.unlink(resolved);
    } catch {
      // Ignore missing files.
    }
  }
}

async function readEnvLocal(names) {
  try {
    const content = await fs.readFile(path.join(root, ".env.local"), "utf8");
    for (const name of names) {
      const match = content.match(new RegExp(`^${name}=([^\r\n]+)$`, "mi"));
      if (match?.[1]) {
        return match[1].trim();
      }
    }
  } catch {
    // Ignore missing env file.
  }
  return "";
}

async function readGoogleOauthClient() {
  const configuredPath = process.env.GOOGLE_OAUTH_CLIENT_FILE;
  const candidates = [
    configuredPath,
    path.join(dataDir, "google-oauth-client.json"),
    path.join(root, "google-oauth-client.json"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(await fs.readFile(candidate, "utf8"));
      const client = parsed.web || parsed.installed;
      if (client?.client_id && client?.client_secret) {
        return {
          clientId: client.client_id,
          clientSecret: client.client_secret,
        };
      }
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

async function getGmailAccessToken() {
  let token;
  try {
    token = JSON.parse(await fs.readFile(tokenPath, "utf8"));
  } catch {
    return null;
  }

  if (token?.accessToken && token.expiresAt > Date.now() + 60_000) {
    return token.accessToken;
  }

  if (!token?.refreshToken) {
    return token?.accessToken || null;
  }

  const fileClient = await readGoogleOauthClient();
  const clientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    (await readEnvLocal(["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_CLIENT_ID", "OAUTH_CLIENT_ID"])) ||
    fileClient?.clientId ||
    "";
  const clientSecret =
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    (await readEnvLocal(["GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_CLIENT_SECRET", "OAUTH_CLIENT_SECRET"])) ||
    fileClient?.clientSecret ||
    "";

  if (!clientId || !clientSecret) {
    return token.accessToken || null;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    return token.accessToken || null;
  }

  const refreshed = await response.json();
  token = {
    ...token,
    accessToken: refreshed.access_token,
    expiresAt: Date.now() + (refreshed.expires_in || 3600) * 1000,
  };
  await fs.writeFile(tokenPath, `${JSON.stringify(token, null, 2)}\n`, "utf8");
  return token.accessToken;
}

async function deleteGmailDrafts() {
  if (removedDraftIds.size === 0) {
    return;
  }

  const token = await getGmailAccessToken();
  if (!token) {
    console.warn("[cleanup-off-target-jobs] Gmail token unavailable; skipping draft deletion.");
    return;
  }

  for (const draftId of removedDraftIds) {
    try {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(draftId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok && response.status !== 404) {
        console.warn(`[cleanup-off-target-jobs] Failed to delete draft ${draftId}: ${response.status}`);
      }
    } catch (err) {
      console.warn(`[cleanup-off-target-jobs] Failed to delete draft ${draftId}:`, err);
    }
  }
}

async function main() {
  await cleanJobCollections();
  await cleanJobIntel();
  await cleanApplicationLogs();
  await cleanPipelineRuns();
  await deleteGeneratedCvs();
  await deleteGmailDrafts();

  console.log(
    JSON.stringify(
      {
        removedTitles: Array.from(removedTitles).sort(),
        removedJobIds: removedJobIds.size,
        removedDedupeKeys: removedDedupeKeys.size,
        removedDraftIds: removedDraftIds.size,
        removedTailoredCvFiles: removedTailoredCvPaths.size,
      },
      null,
      2
    )
  );
}

await main();
