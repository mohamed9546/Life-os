import { RawJobItem, Transaction } from "@/types";
import { normalizeRawJob } from "@/lib/jobs/sources";

export function parseJsonArrayPayload(input: string): unknown[] {
  const parsed = JSON.parse(input) as unknown;
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown[] }).items)) {
    return (parsed as { items: unknown[] }).items;
  }

  throw new Error("Expected a JSON array or an object with an items array");
}

export function coerceJobImports(items: unknown[]): RawJobItem[] {
  return items
    .map((item, index) => coerceJobImport(item, index))
    .filter((item): item is RawJobItem => item !== null);
}

export function coerceJobImport(item: unknown, index: number): RawJobItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const source = asString(record.source) || "import";
  const title = asString(record.title) || asString(record.jobTitle);
  const company = asString(record.company) || asString(record.employer);
  const link = asString(record.link) || asString(record.url);
  const location = asString(record.location) || asString(record.city) || "United Kingdom";

  if (!title || !company) {
    return null;
  }

  return normalizeRawJob({
    source,
    sourceJobId: asString(record.sourceJobId) || `import-${index}`,
    title,
    company,
    location,
    salaryText: asString(record.salaryText) || asString(record.salary),
    link: link || `import://${source}/${index}`,
    postedAt: asString(record.postedAt) || undefined,
    employmentType: asString(record.employmentType) || undefined,
    remoteType: asString(record.remoteType) || undefined,
    description: asString(record.description) || asString(record.summary) || undefined,
    raw: record,
    fetchedAt: new Date().toISOString(),
  });
}

export function parseTransactionsCsv(input: string): Array<{
  date: string;
  description: string;
  amount: number;
  currency: string;
}> {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const rows = lines.slice(1);

  return rows
    .map((line) => {
      const columns = splitCsvLine(line);
      const record = headers.reduce<Record<string, string>>((accumulator, header, index) => {
        accumulator[header] = columns[index] || "";
        return accumulator;
      }, {});

      const date =
        record.date ||
        record["transaction date"] ||
        record.booked ||
        record.posted ||
        "";
      const description =
        record.description ||
        record.details ||
        record.merchant ||
        record.payee ||
        "";
      const amountRaw =
        record.amount ||
        record.value ||
        record.debit ||
        record.credit ||
        "";
      const currency = record.currency || "GBP";

      const amount = parseNumber(amountRaw);
      if (!date || !description || Number.isNaN(amount)) {
        return null;
      }

      return {
        date: normalizeDate(date),
        description,
        amount,
        currency,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export function coerceTransactionImports(items: unknown[]): Array<{
  date: string;
  description: string;
  amount: number;
  currency: string;
}> {
  return items
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const date = asString(record.date) || asString(record.postedAt) || "";
      const description =
        asString(record.description) || asString(record.merchant) || asString(record.payee) || "";
      const amountValue =
        typeof record.amount === "number"
          ? record.amount
          : parseNumber(asString(record.amount) || "");

      if (!date || !description || Number.isNaN(amountValue)) {
        return null;
      }

      return {
        date: normalizeDate(date),
        description,
        amount: amountValue,
        currency: asString(record.currency) || "GBP",
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

export function buildTransactionEntities(
  rows: Array<{ date: string; description: string; amount: number; currency: string }>
): Transaction[] {
  const now = new Date().toISOString();
  return rows.map((row, index) => ({
    id: `txn-import-${Date.now()}-${index}`,
    date: row.date,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    createdAt: now,
    updatedAt: now,
  }));
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseNumber(value: string): number {
  const normalized = value.replace(/[£,$\s]/g, "").replace(/,/g, "");
  return Number.parseFloat(normalized);
}

function normalizeDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString();
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
