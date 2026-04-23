import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  let userId: string | null = null;

  try {
    const user = await requireAppUser();
    userId = user.id;
    const [{ extractCandidateProfile }, { extractTextFromPdfUpload }, { saveCandidateProfileDraft }, { saveImportRecord }] =
      await Promise.all([
        import("@/lib/ai"),
        import("@/lib/profile/pdf"),
        import("@/lib/profile/candidate-profile"),
        import("@/lib/imports/storage"),
      ]);

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
      userId
    );

    return NextResponse.json({
      success: true,
      draft,
      record,
    });
  } catch (err) {
    if (userId) {
      try {
        const { saveImportRecord } = await import("@/lib/imports/storage");
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
          userId
        );
      } catch (recordErr) {
        console.warn("[profile/import-cv] Failed to save failed import record.", recordErr);
      }
    }

    const status =
      err instanceof Error &&
      (err.message.toLowerCase().includes("auth") ||
        err.message.toLowerCase().includes("sign in"))
        ? 401
        : 500;

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to import CV",
      },
      { status }
    );
  }
}
