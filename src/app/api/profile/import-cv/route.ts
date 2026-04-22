import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { extractCandidateProfile } from "@/lib/ai";
import { extractTextFromPdfUpload } from "@/lib/profile/pdf";
import {
  saveCandidateProfileDraft,
} from "@/lib/profile/candidate-profile";
import { saveImportRecord } from "@/lib/imports/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireAppUser();

  try {
    const formData = await request.formData();
    const uploads = formData.getAll("files").filter((item): item is File => item instanceof File);

    if (uploads.length === 0) {
      return NextResponse.json({ error: "At least one PDF is required" }, { status: 400 });
    }

    const sourceFiles: string[] = [];
    const extractedTexts: string[] = [];

    for (const upload of uploads) {
      const bytes = new Uint8Array(await upload.arrayBuffer());
      const text = await extractTextFromPdfUpload(upload.name, bytes);
      if (text.trim()) {
        sourceFiles.push(upload.name);
        extractedTexts.push(text.trim());
      }
    }

    if (extractedTexts.length === 0) {
      throw new Error("The uploaded PDFs did not produce readable text");
    }

    const combinedText = extractedTexts.join("\n\n");
    const result = await extractCandidateProfile(combinedText, sourceFiles);

    if ("error" in result) {
      throw new Error(result.error);
    }

    const draft = await saveCandidateProfileDraft(result.data);
    const record = await saveImportRecord(
      {
        type: "cv-pdf",
        label: "CV PDF import",
        status: "success",
        counts: {
          received: uploads.length,
          imported: sourceFiles.length,
          failed: uploads.length - sourceFiles.length,
        },
        summary: `Extracted ${sourceFiles.length} CV file(s) into a candidate profile draft for review.`,
      },
      user.id
    );

    return NextResponse.json({
      success: true,
      draft,
      record,
    });
  } catch (err) {
    await saveImportRecord(
      {
        type: "cv-pdf",
        label: "CV PDF import failed",
        status: "failed",
        counts: {
          received: 0,
          imported: 0,
          failed: 1,
        },
        summary: err instanceof Error ? err.message : "CV import failed",
      },
      user.id
    );

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to import CV" },
      { status: 500 }
    );
  }
}
