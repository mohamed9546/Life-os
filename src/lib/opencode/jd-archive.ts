import path from "path";
import { listOpenCodeFiles, readOpenCodeJson } from "./storage";

export interface ArchivedJobDocument {
  slug: string;
  sourceUrl?: string;
  savedAt: string;
  parsed: {
    title: string;
    company: string;
    location: string;
    salaryText: string | null;
    employmentType: string;
    remoteType: string;
    roleTrack: string;
    summary: string;
    keywords: string[];
    mustHaves: string[];
    niceToHaves: string[];
  };
  triage: {
    recommendedTrack: {
      id: string;
      label: string;
      score: number;
    };
    note: string;
  };
}

export async function listArchivedJds(): Promise<ArchivedJobDocument[]> {
  const files = (await listOpenCodeFiles("jds"))
    .filter((filePath) => filePath.toLowerCase().endsWith(".json"));

  const docs = await Promise.all(
    files.map(async (filePath) => {
      const slug = path.basename(filePath, ".json");
      return {
        slug,
        ...(await readOpenCodeJson<Omit<ArchivedJobDocument, "slug">>(path.join("jds", `${slug}.json`), {
          sourceUrl: undefined,
          savedAt: "",
          parsed: {
            title: slug,
            company: "Unknown company",
            location: "Unknown",
            salaryText: null,
            employmentType: "unknown",
            remoteType: "unknown",
            roleTrack: "other",
            summary: "",
            keywords: [],
            mustHaves: [],
            niceToHaves: [],
          },
          triage: {
            recommendedTrack: {
              id: "cta-clinical",
              label: "CTA / Clinical trial support",
              score: 0,
            },
            note: "",
          },
        })),
      } satisfies ArchivedJobDocument;
    })
  );

  return docs.sort((left, right) => right.savedAt.localeCompare(left.savedAt));
}

export async function readArchivedJd(slug: string): Promise<ArchivedJobDocument | null> {
  const doc = await readOpenCodeJson<ArchivedJobDocument | null>(path.join("jds", `${slug}.json`), null);
  if (!doc) {
    return null;
  }
  return { ...doc, slug };
}
