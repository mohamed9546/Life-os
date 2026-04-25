import { RawJobItem } from "@/types";
import { promises as fs } from "fs";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { readObject, writeObject } from "@/lib/storage";
import {
  getProcessedGmailAlerts,
  markGmailAlertsProcessed,
} from "./storage";

const GMAIL_TOKEN_OBJECT = "gmail-token";
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
];

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
  const token = await readObject<GmailToken>(GMAIL_TOKEN_OBJECT);
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
): Promise<{ jobs: RawJobItem[]; processed: number; error?: string }> {
  const token = await getAccessToken();
  if (!token) {
    return {
      jobs: [],
      processed: 0,
      error: "Gmail is not connected. Set Google OAuth env vars and connect Gmail.",
    };
  }

  const query =
    process.env.GMAIL_JOB_ALERT_QUERY ||
    'newer_than:21d ({from:indeed from:totaljobs from:irishjobs from:linkedin} OR subject:("job alert" OR jobs OR vacancy))';
  const maxMessages = options?.maxMessages || 25;
  const alreadyProcessed = new Set(
    (await getProcessedGmailAlerts(userId)).map((item) => item.messageId)
  );

  const messages = await gmailListMessages(token, query, maxMessages);
  const jobs: RawJobItem[] = [];
  const processed: Array<{ messageId: string; threadId?: string; source: string }> = [];

  for (const message of messages.filter((item) => !alreadyProcessed.has(item.id))) {
    const full = await gmailGetMessage(token, message.id);
    const text = extractTextFromGmailMessage(full);
    const source = detectAlertSource(full, text);
    const alertJobs = parseJobAlertText(text, source, full.id);
    jobs.push(...alertJobs);
    processed.push({ messageId: full.id, threadId: full.threadId, source });
  }

  await markGmailAlertsProcessed(userId, processed);
  return { jobs, processed: processed.length };
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

function parseJobAlertText(text: string, source: string, messageId: string): RawJobItem[] {
  const now = new Date().toISOString();
  const links = extractLinks(text);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 4 && line.length <= 160);
  const titleCandidates = lines.filter((line) =>
    /clinical|trial|research|regulatory|quality|pharmacovigilance|drug safety|medical information|qa|gcp|cra|cta/i.test(line)
  );

  const jobs: RawJobItem[] = [];
  const max = Math.max(links.length, titleCandidates.length);
  for (let i = 0; i < Math.min(max, 10); i++) {
    const link = links[i] || links[0] || "";
    const title = titleCandidates[i] || titleCandidates[0] || "Job alert match";
    if (!link && !title) continue;
    jobs.push({
      source: `gmail-${source}`,
      sourceJobId: `${messageId}-${i}`,
      company: inferCompany(text, link),
      title,
      location: inferLocation(text),
      link,
      description: text.slice(0, 6000),
      raw: { gmailMessageId: messageId, alertSource: source },
      fetchedAt: now,
    });
  }

  return jobs;
}

function extractLinks(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/gi) || [];
  return Array.from(
    new Set(
      matches
        .map((url) => url.replace(/&amp;/g, "&").replace(/[),.]+$/, ""))
        .filter((url) => /job|career|apply|indeed|linkedin|totaljobs|irishjobs/i.test(url))
    )
  ).slice(0, 20);
}

function detectAlertSource(message: GmailMessage, text: string): string {
  const headers = message.payload?.headers || [];
  const from = headers.find((header) => header.name.toLowerCase() === "from")?.value || "";
  const combined = `${from} ${text}`.toLowerCase();
  if (combined.includes("irishjobs")) return "irishjobs";
  if (combined.includes("totaljobs")) return "totaljobs";
  if (combined.includes("linkedin")) return "linkedin";
  if (combined.includes("indeed")) return "indeed";
  return "job-alert";
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
