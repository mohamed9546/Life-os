// ============================================================
// PDF text extraction — pure JavaScript, no Python dependency.
// Uses pdf-parse which works on Cloud Run and Windows alike.
// ============================================================

export async function extractTextFromPdfUpload(
  fileName: string,
  bytes: Uint8Array
): Promise<string> {
  if (!bytes || bytes.byteLength === 0) {
    throw new Error(`Could not extract text from ${fileName}: file is empty`);
  }

  // pdf-parse v2 wraps PDF.js. Internal failures (encrypted PDFs, broken
  // xref tables, scanned-image-only PDFs) bubble up as raw V8 messages
  // such as "Object.defineProperty called on non-object" which surface
  // verbatim in the candidate profile UI. Wrap them so the user sees the
  // file name + a clear cause instead of a confusing engine string.
  let parser: Awaited<ReturnType<typeof createPdfParser>> | null = null;

  try {
    parser = await createPdfParser(bytes);

    // pdf-parse accepts the Uint8Array directly. Going through Buffer
    // here breaks under strict TS configs because Buffer's typed-array
    // backing isn't assignable to the SDK's ArrayBuffer-only typing.
    const result = await parser.getText();
    const text = (result?.text || "").trim();
    if (!text) {
      throw new Error(
        `Could not extract text from ${fileName}: PDF returned no readable text. The file may be scanned, image-only, or empty.`
      );
    }
    return text;
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.startsWith(`Could not extract text from ${fileName}`)
    ) {
      throw err;
    }
    const wrapped = new Error(
      `Could not extract text from ${fileName}: PDF parser failed. The PDF may be encrypted, scanned, or unsupported.`
    );
    if (err instanceof Error) {
      (wrapped as Error & { cause?: unknown }).cause = err;
    }
    throw wrapped;
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}

async function createPdfParser(bytes: Uint8Array) {
  const { PDFParse } = await import("pdf-parse");
  return new PDFParse({ data: bytes });
}
