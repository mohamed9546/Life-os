import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  let userId: string | null = null;
  let receivedCount = 0;
  let importedCount = 0;
  let failedCount = 0;

  try {
    const user = await requireAppUser();
    userId = user.id;
    const formData = await request.formData();
    const uploads = formData.getAll("files").filter((item): item is File => item instanceof File);
    receivedCount = uploads.length;

    if (uploads.length === 0) {
      return NextResponse.json({ error: "At least one PDF is required" }, { status: 400 });
    }

    const { extractTextFromPdfUpload } = await import("@/lib/profile/pdf");
    const sourceFiles: string[] = [];
    const extractedTexts: string[] = [];
    const extractionFailures: string[] = [];

    for (const upload of uploads) {
      try {
        const bytes = new Uint8Array(await upload.arrayBuffer());
        const text = await extractTextFromPdfUpload(upload.name, bytes);
        if (!text.trim()) {
          throw new Error(`Could not extract text from ${upload.name}: PDF returned no readable text.`);
        }

        sourceFiles.push(upload.name);
        extractedTexts.push(text.trim());
        importedCount = sourceFiles.length;
      } catch (err) {
        failedCount += 1;
        extractionFailures.push(err instanceof Error ? err.message : `${upload.name}: PDF extraction failed`);
      }
    }

    if (extractedTexts.length === 0) {
      const reason =
        extractionFailures.length > 0
          ? extractionFailures.join(" ")
          : "The uploaded PDFs did not produce readable text.";
      throw new Error(reason);
    }

    const [{ extractCandidateProfile }, { saveCandidateProfileDraft }, { saveImportRecord }] =
      await Promise.all([
        import("@/lib/ai"),
        import("@/lib/profile/candidate-profile"),
        import("@/lib/imports/storage"),
      ]);

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
          received: receivedCount,
          imported: importedCount,
          failed: failedCount,
        },
        summary:
          failedCount > 0
            ? `Extracted ${importedCount} CV file(s) into a candidate profile draft for review. ${failedCount} file(s) could not be read.`
            : `Extracted ${importedCount} CV file(s) into a candidate profile draft for review.`,
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
              received: receivedCount,
              imported: importedCount,
              failed: failedCount || Math.max(1, receivedCount - importedCount),
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
