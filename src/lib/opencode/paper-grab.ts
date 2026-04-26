import { writeOpenCodeText } from "./storage";

export interface PaperNote {
  idType: "pmid" | "doi";
  id: string;
  title: string;
  journal: string;
  year: string;
  authors: string[];
  abstract: string;
  sourceUrl: string;
  savedPath: string;
}

export async function grabPaperNote(identifier: string): Promise<PaperNote> {
  const note = /^\d+$/.test(identifier)
    ? await fetchPubMedNote(identifier)
    : await fetchCrossrefNote(identifier);

  const savedPath = `notes/papers/${note.idType}-${slugify(note.id)}-${slugify(note.title || "paper")}.md`;
  await writeOpenCodeText(savedPath, renderNote(note));
  return { ...note, savedPath };
}

async function fetchPubMedNote(pmid: string): Promise<Omit<PaperNote, "savedPath">> {
  const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${encodeURIComponent(pmid)}&retmode=json`;
  const abstractUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${encodeURIComponent(pmid)}&retmode=text&rettype=abstract`;
  const [summaryRes, abstractRes] = await Promise.all([fetch(summaryUrl), fetch(abstractUrl)]);
  const summary = await summaryRes.json();
  const abstractText = await abstractRes.text();
  const record = summary?.result?.[pmid] || {};
  return {
    idType: "pmid",
    id: pmid,
    title: record.title || `PMID ${pmid}`,
    journal: record.fulljournalname || record.source || "Unknown journal",
    year: record.pubdate || "Unknown year",
    authors: (record.authors || []).map((author: { name?: string }) => author.name).filter(Boolean),
    abstract: abstractText.trim(),
    sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
  };
}

async function fetchCrossrefNote(doi: string): Promise<Omit<PaperNote, "savedPath">> {
  const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  if (!response.ok) {
    throw new Error(`Crossref returned ${response.status}`);
  }
  const payload = await response.json();
  const message = payload?.message || {};
  return {
    idType: "doi",
    id: doi,
    title: message.title?.[0] || doi,
    journal: message["container-title"]?.[0] || "Unknown journal",
    year: String(message.issued?.["date-parts"]?.[0]?.[0] || "Unknown year"),
    authors: (message.author || [])
      .map((author: { given?: string; family?: string }) => [author.given, author.family].filter(Boolean).join(" "))
      .filter(Boolean),
    abstract: stripHtml(message.abstract || "Abstract unavailable from Crossref."),
    sourceUrl: message.URL || `https://doi.org/${doi}`,
  };
}

function renderNote(note: Omit<PaperNote, "savedPath">): string {
  return [
    `# ${note.title}`,
    ``,
    `- ${note.idType.toUpperCase()}: ${note.id}`,
    `- Journal: ${note.journal}`,
    `- Year: ${note.year}`,
    `- Authors: ${note.authors.join(", ") || "Unknown"}`,
    `- Source: ${note.sourceUrl}`,
    ``,
    `## Abstract`,
    ``,
    note.abstract || "Abstract unavailable.",
    ``,
    `## Methods`,
    `- `,
    ``,
    `## Findings`,
    `- `,
    ``,
    `## Applicability to my work`,
    `- `,
    ``,
    `## Cite-able CV bullet`,
    `- `,
    ``,
  ].join("\n");
}

function stripHtml(value: string): string {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
