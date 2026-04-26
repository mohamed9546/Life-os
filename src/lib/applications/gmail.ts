import { RawJobItem } from "@/types";
import { promises as fs } from "fs";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { readObject, writeObject } from "@/lib/storage";
import { evaluateRawJobRelevance } from "@/lib/jobs/pipeline/relevance";
import { callAI } from "@/lib/ai/client";
import {
  getProcessedGmailAlerts,
  markGmailAlertsProcessed,
} from "./storage";
import { z } from "zod";

const GMAIL_TOKEN_OBJECT = "gmail-token";
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
];

const GmailExtractedJobsSchema = z.object({
  jobs: z.array(
    z.object({
      title: z.string().min(2),
      company: z.string().min(1).default("Unknown company"),
      location: z.string().min(1).default("United Kingdom"),
      link: z.string().default(""),
      description: z.string().default(""),
    })
  ).max(8),
});

export interface GmailOAuthClient {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface GmailToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

async function readStoredGmailToken(): Promise<GmailToken | null> {
  return readObject<GmailToken>(GMAIL_TOKEN_OBJECT);
}

interface GmailMessageSummary {
  id: string;
  threadId?: string;
}

interface GmailMessage {
  id: string;
  threadId?: string;
  payload?: {
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailMessage["payload"][];
    headers?: Array<{ name: string; value: string }>;
  };
  snippet?: string;
}

interface GoogleApiErrorPayload {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    errors?: Array<{
      reason?: string;
      message?: string;
    }>;
  };
}

type GoogleOAuthJson = {
  web?: {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
  };
  installed?: {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
  };
};

export function getGmailOAuthClient(requestOrigin?: string): GmailOAuthClient | null {
  const fileClient = readGoogleOAuthClientFile();
  const clientId = readEnvFirst([
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_CLIENT_ID",
    "OAUTH_CLIENT_ID",
    "OAuthClientId",
    "OAuthclientId",
  ]) || fileClient?.clientId || "";
  const clientSecret =
    readEnvFirst([
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_CLIENT_SECRET",
      "OAUTH_CLIENT_SECRET",
      "OAuthClientSecret",
      "OAuthclientSecret",
    ]) || fileClient?.clientSecret || "";
  const base =
    process.env.GOOGLE_OAUTH_REDIRECT_BASE ||
    requestOrigin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://127.0.0.1:3000";

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${base.replace(/\/+$/, "")}/api/gmail/auth/callback`,
  };
}

function readEnvFirst(names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

function readGoogleOAuthClientFile():
  | { clientId: string; clientSecret: string }
  | null {
  const configuredPath = process.env.GOOGLE_OAUTH_CLIENT_FILE;
  const candidates = [
    configuredPath,
    path.join(process.cwd(), "data", "google-oauth-client.json"),
    path.join(process.cwd(), "google-oauth-client.json"),
  ].filter((item): item is string => Boolean(item));

  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) continue;
      const parsed = JSON.parse(readFileSync(candidate, "utf8")) as GoogleOAuthJson;
      const config = parsed.web || parsed.installed;
      if (config?.client_id && config.client_secret) {
        return {
          clientId: config.client_id,
          clientSecret: config.client_secret,
        };
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

export function buildGmailAuthUrl(client: GmailOAuthClient): string {
  const params = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES.join(" "),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGmailCode(
  code: string,
  client: GmailOAuthClient
): Promise<void> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: client.redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google OAuth token exchange failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  await writeObject<GmailToken>(GMAIL_TOKEN_OBJECT, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  });
}

async function getAccessToken(): Promise<string | null> {
  const token = await readStoredGmailToken();
  if (!token) return null;
  if (token.expiresAt > Date.now() + 60_000) return token.accessToken;

  const client = getGmailOAuthClient();
  if (!client || !token.refreshToken) return token.accessToken;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      refresh_token: token.refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!response.ok) return token.accessToken;
  const data = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };
  const next = {
    ...token,
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  await writeObject<GmailToken>(GMAIL_TOKEN_OBJECT, next);
  return next.accessToken;
}

export async function syncGmailJobAlerts(
  userId: string,
  options?: { maxMessages?: number }
): Promise<{
  jobs: RawJobItem[];
  processed: number;
  importedMessages: number;
  skipped: number;
  failed: number;
  error?: string;
}> {
  const token = await getAccessToken();
  if (!token) {
    return {
      jobs: [],
      processed: 0,
      importedMessages: 0,
      skipped: 0,
      failed: 0,
      error: "Gmail is not connected. Set Google OAuth env vars and connect Gmail.",
    };
  }

  const query = process.env.GMAIL_JOB_ALERT_QUERY || buildDefaultGmailAlertQuery();
  const maxMessages = options?.maxMessages || 25;
  const alreadyProcessed = new Set(
    (await getProcessedGmailAlerts(userId)).map((item) => item.messageId)
  );

  const messages = await gmailListMessages(token, query, maxMessages);
  const jobs: RawJobItem[] = [];
  const inspected: Array<{ messageId: string; threadId?: string; source: string }> = [];
  let importedMessages = 0;
  let failed = 0;

  for (const message of messages.filter((item) => !alreadyProcessed.has(item.id))) {
    try {
      const full = await gmailGetMessage(token, message.id);
      const text = extractTextFromGmailMessage(full);
      const source = detectAlertSource(full, text);
      const subject = getHeader(full, "subject");
      const aiJobs = await extractJobsFromAlertWithAI({
        text,
        source,
        messageId: full.id,
        subject,
        from: getHeader(full, "from"),
      });
      const alertJobs = filterImportedGmailJobs(
        aiJobs.length > 0 ? aiJobs : parseJobAlertText(text, source, full.id, subject)
      );

      jobs.push(...alertJobs);
      inspected.push({ messageId: full.id, threadId: full.threadId, source });

      if (alertJobs.length > 0) {
        importedMessages += 1;
      }
    } catch (err) {
      failed += 1;
      console.error(`[gmail] Failed to inspect alert ${message.id}:`, err);
    }
  }

  await markGmailAlertsProcessed(userId, inspected);
  return {
    jobs,
    processed: inspected.length,
    importedMessages,
    skipped: Math.max(0, inspected.length - importedMessages),
    failed,
  };
}

export async function getGmailConnectionStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  email?: string;
  error?: string;
}> {
  const client = getGmailOAuthClient();
  if (!client) {
    return {
      configured: false,
      connected: false,
      error: "Google OAuth client is not configured.",
    };
  }

  const storedToken = await readStoredGmailToken();
  if (!storedToken?.accessToken) {
    return {
      configured: true,
      connected: false,
      error: "Gmail is not connected.",
    };
  }

  const token = await getAccessToken();
  if (!token) {
    return {
      configured: true,
      connected: false,
      error: "Gmail is not connected.",
    };
  }

  try {
    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const error = await readGoogleApiError(response);
      if (response.status === 403 && /scope|insufficient/i.test(error)) {
        return {
          configured: true,
          connected: true,
          error: error || "Gmail connected; profile lookup is blocked by the granted scopes.",
        };
      }
      return {
        configured: true,
        connected: false,
        error: error || `Gmail profile lookup failed: ${response.status}`,
      };
    }

    const profile = (await response.json()) as { emailAddress?: string };
    return {
      configured: true,
      connected: true,
      email: profile.emailAddress,
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      error: err instanceof Error ? err.message : "Gmail connection check failed.",
    };
  }
}

function buildDefaultGmailAlertQuery(): string {
  return [
    "in:inbox",
    "newer_than:3d",
    "(",
    "from:linkedin",
    "OR from:indeed",
    "OR from:totaljobs",
    "OR from:irishjobs",
    "OR from:jobs.nhs.uk",
    "OR from:nhsjobs",
    'OR subject:"job alert"',
    'OR subject:"jobs for you"',
    'OR subject:"recommended jobs"',
    'OR subject:"clinical trial"',
    'OR subject:"clinical research"',
    'OR subject:"study coordinator"',
    'OR subject:"trial coordinator"',
    'OR subject:"site activation"',
    'OR subject:"study start-up"',
    'OR "clinical trial assistant"',
    'OR "clinical trial associate"',
    'OR "clinical research assistant"',
    'OR "clinical research coordinator"',
    'OR "trial coordinator"',
    'OR "study coordinator"',
    'OR "clinical operations assistant"',
    ")",
  ].join(" ");
}

async function extractJobsFromAlertWithAI(input: {
  text: string;
  source: string;
  messageId: string;
  subject: string;
  from: string;
}): Promise<RawJobItem[]> {
  const links = extractLinks(input.text);
  const prompt = `Extract only real job opportunities from this email alert.

PRIORITY TARGETS:
- Clinical Trial Assistant
- Clinical Trials Assistant
- Clinical Trial Associate
- Clinical Research Assistant
- Clinical Research Coordinator
- Trial Coordinator
- Clinical Operations Assistant
- Study Start-Up Assistant/Coordinator
- Site Activation Assistant/Coordinator
- Trial Administrator

SECONDARY TARGETS:
- QA Associate / Quality Systems Associate / Document Control Associate
- Regulatory Affairs Assistant / Regulatory Operations Assistant
- Medical Information Associate
- Research Governance / Research Support

EXCLUDE:
- IT support, drivers, offshore/oil & gas, hospitality, aviation security, radiography, field sales, finance/advice compliance, generic unrelated operations

Return JSON only in this shape:
{
  "jobs": [
    {
      "title": "job title",
      "company": "company",
      "location": "location",
      "link": "best matching apply/job URL if present, else empty string",
      "description": "one short sentence about the role"
    }
  ]
}

If there are no relevant jobs, return {"jobs":[]}.

Source: ${input.source}
From: ${input.from}
Subject: ${input.subject}
Links:
${links.join("\n") || "None"}

Email text:
---
${input.text.slice(0, 12000)}
---`;

  const result = await callAI<{ jobs: unknown[] }>({
    taskType: "extract-job-list-from-scrape",
    prompt,
    rawInput: {
      source: input.source,
      from: input.from,
      subject: input.subject,
      textPreview: input.text.slice(0, 2000),
      links,
    },
    temperature: 0.05,
    maxTokens: 1_200,
  });

  if (!result.success || !result.data) {
    return [];
  }

  const parsed = GmailExtractedJobsSchema.safeParse(result.data);
  if (!parsed.success) {
    return [];
  }

  const now = new Date().toISOString();
  return parsed.data.jobs.map((job, index) => ({
    source: `gmail-${input.source}`,
    sourceJobId: `${input.messageId}-ai-${index}`,
    company: job.company,
    title: job.title,
    location: job.location,
    link: job.link || links[index] || links[0] || "",
    description: `${job.description || ""}\n\n${input.text}`.trim().slice(0, 6000),
    raw: { gmailMessageId: input.messageId, alertSource: input.source, aiExtracted: true },
    fetchedAt: now,
  }));
}

async function readGoogleApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as GoogleApiErrorPayload;
    return (
      payload.error?.message ||
      payload.error?.errors?.[0]?.message ||
      payload.error?.status ||
      ""
    );
  } catch {
    return "";
  }
}

export async function createGmailApplicationDraft(input: {
  to: string;
  subject: string;
  body: string;
  attachmentPath?: string;
}): Promise<{ draftId: string | null; error?: string }> {
  return createGmailDraft(input);
}

export async function createGmailDraft(input: {
  to: string;
  subject: string;
  body: string;
  attachmentPath?: string;
}): Promise<{ draftId: string | null; error?: string }> {
  const token = await getAccessToken();
  if (!token) {
    return { draftId: null, error: "Gmail is not connected." };
  }

  const raw = await buildMimeMessage(input);
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: { raw } }),
    cache: "no-store",
  });

  if (!response.ok) {
    return { draftId: null, error: `Gmail draft creation failed: ${response.status}` };
  }

  const data = (await response.json()) as { id?: string };
  return { draftId: data.id || null };
}

export async function deleteGmailDraft(draftId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token || !draftId) {
    return;
  }

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(draftId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Gmail draft deletion failed: ${response.status}`);
  }
}

export async function getGmailSentStyleSamples(
  options?: { maxMessages?: number }
): Promise<string[]> {
  const token = await getAccessToken();
  if (!token) {
    return [];
  }

  const messages = await gmailListMessages(
    token,
    "in:sent newer_than:365d -has:attachment",
    options?.maxMessages || 8
  );

  const samples: string[] = [];
  for (const message of messages) {
    const full = await gmailGetMessage(token, message.id);
    const text = cleanupSentStyleSample(extractTextFromGmailMessage(full));
    if (text) {
      samples.push(text);
    }
  }

  return samples;
}

async function gmailListMessages(
  token: string,
  q: string,
  maxResults: number
): Promise<GmailMessageSummary[]> {
  const params = new URLSearchParams({ q, maxResults: String(maxResults) });
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error(`Gmail message search failed: ${response.status}`);
  }
  const data = (await response.json()) as { messages?: GmailMessageSummary[] };
  return data.messages || [];
}

async function gmailGetMessage(token: string, id: string): Promise<GmailMessage> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error(`Gmail message read failed: ${response.status}`);
  }
  return (await response.json()) as GmailMessage;
}

function extractTextFromGmailMessage(message: GmailMessage): string {
  const parts: string[] = [message.snippet || ""];

  function walk(payload: GmailMessage["payload"] | undefined) {
    if (!payload) return;
    if (payload.body?.data) {
      parts.push(decodeBase64Url(payload.body.data));
    }
    for (const part of payload.parts || []) {
      walk(part);
    }
  }

  walk(message.payload);
  return htmlToText(parts.join("\n"));
}

function parseJobAlertText(
  text: string,
  source: string,
  messageId: string,
  subject: string
): RawJobItem[] {
  const now = new Date().toISOString();
  const links = extractLinks(text);
  const lines = normalizeAlertLines(text);
  const cards = extractAlertCards(source, lines, links, subject, text);

  return cards.map((card, index) => ({
      source: `gmail-${source}`,
      sourceJobId: `${messageId}-${index}`,
      company: card.company,
      title: card.title,
      location: card.location,
      link: card.link,
      description: text.slice(0, 6000),
      raw: { gmailMessageId: messageId, alertSource: source },
      fetchedAt: now,
    }));
}

function normalizeAlertLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 4 && line.length <= 160)
    .filter((line) => !/^https?:\/\//i.test(line))
    .filter(
      (line) =>
        !/(unsubscribe|manage alerts|job alert|email preferences|view jobs|see all jobs|privacy|terms|notification settings|recommended for you|based on your profile)/i.test(
          line
        )
    );
}

function extractAlertCards(
  source: string,
  lines: string[],
  links: string[],
  subject: string,
  fullText: string
): Array<{ title: string; company: string; location: string; link: string }> {
  if (source === "totaljobs") {
    return extractTotaljobsCards(fullText);
  }
  if (source === "irishjobs") {
    return extractIrishJobsCards(fullText);
  }
  if (source === "linkedin") {
    return extractLinkedInCards(fullText);
  }
  if (source === "indeed") {
    return extractIndeedCards(lines, links, subject, fullText);
  }

  const cards: Array<{ title: string; company: string; location: string; link: string }> = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index++) {
    const title = lines[index];
    if (!looksLikeJobTitle(title)) {
      continue;
    }

    const company = findCompanyLine(lines, index + 1);
    const location = findLocationLine(lines, index + 1);
    const key = `${title.toLowerCase()}::${company.toLowerCase()}::${location.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    cards.push({
      title,
      company: company || inferCompany(fullText, links[cards.length] || links[0] || ""),
      location: location || inferLocation(fullText),
      link: links[cards.length] || links[0] || "",
    });

    if (cards.length >= 3) {
      break;
    }
  }

  if (cards.length === 0) {
    const title = deriveTitleFromSubject(subject);
    if (title) {
      cards.push({
        title,
        company: inferCompany(fullText, links[0] || ""),
        location: inferLocation(fullText),
        link: links[0] || "",
      });
    }
  }

  return cards;
}

function filterImportedGmailJobs(jobs: RawJobItem[]): RawJobItem[] {
  return jobs.filter((job) => {
    if (isHardRejectedGmailTitle(job.title)) {
      return false;
    }
    const gate = evaluateRawJobRelevance(job);
    if (gate.hardReject) {
      return false;
    }
    if (["weak", "irrelevant"].includes(gate.regulatedHealthcareRelevance)) {
      return false;
    }
    if (gate.supportNature === "leadership") {
      return false;
    }
    if (!isTargetGmailLocation(job.location || job.description || "")) {
      return false;
    }
    return true;
  });
}

function isHardRejectedGmailTitle(title: string): boolean {
  return /\b(care assistant|health care assistant|healthcare assistant|support worker|caregiver|carer|nursing assistant|nightshift care assistant|dayshift care assistant)\b/i.test(
    title
  );
}

function isTargetGmailLocation(value: string): boolean {
  const normalized = value.toLowerCase();
  if (!normalized.trim()) {
    return true;
  }
  if (/\b(remote|hybrid|uk|united kingdom|england|scotland|wales|glasgow|edinburgh|london|ireland|dublin|cork|galway|limerick|egypt|cairo)\b/.test(normalized)) {
    return true;
  }
  if (/\b(minnesota|alaska|united states|usa|baltimore|maryland)\b/.test(normalized)) {
    return false;
  }
  return !/\b[A-Z]{2}\b/.test(value);
}

function extractTotaljobsCards(
  text: string
): Array<{ title: string; company: string; location: string; link: string }> {
  const cards: Array<{ title: string; company: string; location: string; link: string }> = [];
  const seen = new Set<string>();
  const chunks = text.split(/(?:Strong|Good).{0,4}Fit/i).slice(1);

  for (const chunk of chunks) {
    const block = rawAlertLines(chunk);
    const title = block.find((line) => looksLikeJobTitle(line) && !isSectionHeading(line));
    const link = block.find((line) => looksLikeTrackedJobUrl(line, "totaljobs"));
    if (!title || !link) {
      continue;
    }
    const titleIndex = block.indexOf(title);
    const nearby = block.slice(titleIndex + 1, titleIndex + 7);
    const company = nearby.find((line) => looksLikeCompanyLine(line)) || inferCompany(chunk, link);
    const location = nearby.find((line) => looksLikeLocationLine(line)) || inferLocation(chunk);
    const key = `${title.toLowerCase()}::${company.toLowerCase()}::${location.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    cards.push({
      title,
      company: company || inferCompany(nearby.join("\n"), link),
      location,
      link,
    });

    if (cards.length >= 5) {
      break;
    }
  }

  return cards;
}

function extractIrishJobsCards(
  text: string
): Array<{ title: string; company: string; location: string; link: string }> {
  const block = rawAlertLines(text);
  const cards: Array<{ title: string; company: string; location: string; link: string }> = [];
  const seen = new Set<string>();

  for (let index = 0; index < block.length - 3; index++) {
    const title = block[index];
    const link = block[index + 1];
    const company = block[index + 2];
    const location = block[index + 3];
    if (!looksLikeJobTitle(title) || !looksLikeTrackedJobUrl(link, "irishjobs")) {
      continue;
    }
    if (!looksLikeCompanyLine(company) || !looksLikeLocationLine(location)) {
      continue;
    }
    const key = `${title.toLowerCase()}::${company.toLowerCase()}::${location.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    cards.push({ title, company, location, link: cleanTrackedUrl(link) });
    if (cards.length >= 5) {
      break;
    }
  }

  return cards;
}

function extractLinkedInCards(
  text: string
): Array<{ title: string; company: string; location: string; link: string }> {
  const block = rawAlertLines(text);
  const cards: Array<{ title: string; company: string; location: string; link: string }> = [];
  const seen = new Set<string>();

  for (let index = 0; index < block.length - 3; index++) {
    const title = block[index];
    const company = block[index + 1];
    const location = block[index + 2];
    const linkLine = block[index + 3];
    const link = linkLine.replace(/^View job:\s*/i, "");
    if (!looksLikeJobTitle(title) || !looksLikeCompanyLine(company)) {
      continue;
    }
    if (!looksLikeLocationLine(location) || !looksLikeTrackedJobUrl(link, "linkedin")) {
      continue;
    }
    const key = `${title.toLowerCase()}::${company.toLowerCase()}::${location.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    cards.push({ title, company, location, link: cleanTrackedUrl(link) });
    if (cards.length >= 5) {
      break;
    }
  }

  return cards;
}

function extractIndeedCards(
  lines: string[],
  links: string[],
  subject: string,
  fullText: string
): Array<{ title: string; company: string; location: string; link: string }> {
  const cards: Array<{ title: string; company: string; location: string; link: string }> = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length - 1; index++) {
    const title = lines[index];
    const companyLocation = lines[index + 1];
    if (!looksLikeJobTitle(title) || !companyLocation.includes(" - ")) {
      continue;
    }
    const [company, location] = companyLocation.split(/\s+-\s+/, 2).map((item) => item.trim());
    if (!company || !location || isAlertNoise(company) || isAlertNoise(location)) {
      continue;
    }

    const link = links[cards.length] || links[0] || "";
    const key = `${title.toLowerCase()}::${company.toLowerCase()}::${location.toLowerCase()}`;
    if (!link || seen.has(key)) {
      continue;
    }
    seen.add(key);

    cards.push({ title, company, location, link });
    if (cards.length >= 5) {
      break;
    }
  }

  if (cards.length === 0) {
    const fallback = deriveTitleFromSubject(subject);
    if (fallback && links[0]) {
      cards.push({
        title: fallback,
        company: inferCompany(fullText, links[0]),
        location: inferLocation(fullText),
        link: links[0],
      });
    }
  }

  return cards;
}

function deriveTitleFromSubject(subject: string): string | null {
  const cleaned = subject
    .replace(/^(job alert|jobs for you|recommended jobs|your job alert)\s*[:\-]?\s*/i, "")
    .replace(/\s*[-|].*$/, "")
    .trim();
  if (!cleaned || cleaned.length < 4) {
    return null;
  }
  return cleaned.slice(0, 120);
}

function looksLikeJobTitle(line: string): boolean {
  if (line.length < 4 || line.length > 100) {
    return false;
  }
  if (/[.!?;:]/.test(line)) {
    return false;
  }
  const words = line.split(/\s+/);
  if (words.length < 2 || words.length > 10) {
    return false;
  }
  if (isAlertNoise(line) || isMetadataLine(line) || looksLikeLocationLine(line)) {
    return false;
  }
  return /\b(assistant|associate|administrator|analyst|coordinator|specialist|officer|scientist|technician|technologist|research assistant|clinical scientist|regulatory affairs|quality assurance|pharmacovigilance|medical information|drug safety|cra|cta|study manager|clinical trial|medical affairs)\b/i.test(
    line
  );
}

function looksLikeCompanyLine(line: string): boolean {
  if (line.length < 2 || line.length > 60) {
    return false;
  }
  if (looksLikeLocationLine(line) || isMetadataLine(line) || isAlertNoise(line) || isSectionHeading(line)) {
    return false;
  }
  if (/^https?:\/\//i.test(line) || /^\d/.test(line) || /\b(employees|days ago|just posted)\b/i.test(line)) {
    return false;
  }
  return true;
}

function rawAlertLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^https?:\/\//i.test(line) || line.length <= 200);
}

function looksLikeTrackedJobUrl(line: string, source: string): boolean {
  const cleaned = cleanTrackedUrl(line);
  if (!/^https?:\/\//i.test(cleaned)) {
    return false;
  }
  return cleaned.toLowerCase().includes(source);
}

function cleanTrackedUrl(line: string): string {
  return line
    .replace(/^View job:\s*/i, "")
    .replace(/^See matching results on Indeed:\s*/i, "")
    .replace(/^Search for more related jobs.*?https?:\/\//i, "https://")
    .trim()
    .replace(/[),.]+$/, "")
    .replace(/&amp;/g, "&");
}

function isSectionHeading(line: string): boolean {
  return /^(strong fit|top skills|compliance support|customer and business support|continuous improvement|picked for you|jobs? \d+-\d+ of \d+)/i.test(
    line
  );
}

function findCompanyLine(lines: string[], startIndex: number): string {
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 4); index++) {
    const line = lines[index];
    if (isAlertNoise(line) || isMetadataLine(line) || looksLikeLocationLine(line)) {
      continue;
    }
    if (looksLikeJobTitle(line)) {
      continue;
    }
    if (line.split(/\s+/).length <= 8) {
      return line;
    }
  }
  return "";
}

function findLocationLine(lines: string[], startIndex: number): string {
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 6); index++) {
    const line = lines[index];
    if (looksLikeLocationLine(line)) {
      return line;
    }
  }
  return "";
}

function looksLikeLocationLine(line: string): boolean {
  if (/(£|\bfrom\b|per annum|an hour|salary|bonus|pension|competitive|employees?)\b/i.test(line)) {
    return false;
  }
  return /\b(remote|hybrid|onsite|glasgow|edinburgh|scotland|london|dublin|ireland|united kingdom|uk|egypt|cairo)\b/i.test(
    line
  ) || /,/.test(line) || /\([A-Z]{2,}\)/.test(line);
}

function isMetadataLine(line: string): boolean {
  return /\b(permanent|contract|temporary|full[- ]time|part[- ]time|days? ago|salary|bonus|pension|apply now|easy apply|view job|top skills|strong fit|new|just posted|responsive employer|employees?)\b/i.test(
    line
  );
}

function isAlertNoise(line: string): boolean {
  return /\b(hello|unsubscribe|manage alerts|email preferences|privacy|terms|notification settings|recommended for you|based on your profile|we recommend this job for you|take a look and see if you want to apply)\b/i.test(
    line
  );
}

function extractLinks(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/gi) || [];
  return Array.from(
    new Set(
      matches
        .map((url) => url.replace(/&amp;/g, "&").replace(/[),.]+$/, ""))
        .filter((url) => /job|career|apply|indeed|linkedin|totaljobs|irishjobs|jobs\.nhs/i.test(url))
    )
  ).slice(0, 20);
}

function detectAlertSource(message: GmailMessage, text: string): string {
  const from = getHeader(message, "from");
  const subject = getHeader(message, "subject");
  const combined = `${from} ${subject} ${text}`.toLowerCase();
  if (combined.includes("irishjobs")) return "irishjobs";
  if (combined.includes("totaljobs")) return "totaljobs";
  if (combined.includes("linkedin")) return "linkedin";
  if (combined.includes("indeed")) return "indeed";
  if (combined.includes("jobs.nhs") || combined.includes("nhs jobs")) return "nhsjobs";
  return "job-alert";
}

function getHeader(message: GmailMessage, name: string): string {
  const headers = message.payload?.headers || [];
  return headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function inferCompany(text: string, link: string): string {
  const companyLine = text.match(/(?:company|employer)\s*:?\s*([A-Z][^\n]{2,80})/i)?.[1];
  if (companyLine) return companyLine.trim();
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    return host.split(".")[0] || "Unknown Company";
  } catch {
    return "Unknown Company";
  }
}

function inferLocation(text: string): string {
  const match = text.match(/\b(Glasgow|Edinburgh|Scotland|London|Dublin|Ireland|United Kingdom|UK|Egypt|Cairo|Remote|Hybrid)\b/i);
  return match?.[1] || "United Kingdom";
}

function htmlToText(input: string): string {
  return input
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi, " $1 ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>|<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ");
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function cleanupSentStyleSample(input: string): string {
  const text = input
    .split(/\nOn .+ wrote:|\nFrom:|\nSent:|\n-{2,}\s*Original Message\s*-{2,}/i)[0]
    .replace(/\bhttps?:\/\/\S+/gi, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length < 40) {
    return "";
  }

  return text.slice(0, 900);
}

async function buildMimeMessage(input: {
  to: string;
  subject: string;
  body: string;
  attachmentPath?: string;
}): Promise<string> {
  const boundary = `applypilot-${Date.now()}`;
  const headers = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];
  const parts = [
    headers.join("\r\n"),
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    input.body,
  ];

  if (input.attachmentPath) {
    const bytes = await fs.readFile(input.attachmentPath);
    const filename = path.basename(input.attachmentPath);
    parts.push(
      `--${boundary}`,
      `Content-Type: application/pdf; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      bytes.toString("base64").replace(/(.{76})/g, "$1\r\n")
    );
  }

  parts.push(`--${boundary}--`, "");
  return Buffer.from(parts.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
