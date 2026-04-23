// ============================================================
// PDF text extraction — pure JavaScript, no Python dependency.
// Uses pdf-parse which works on Cloud Run and Windows alike.
// ============================================================

/* eslint-disable */
const pdfParse = require("pdf-parse");
/* eslint-enable */

export async function extractTextFromPdfUpload(
  _fileName: string,
  bytes: Uint8Array
): Promise<string> {
  const buffer = Buffer.from(bytes);
  const result = await pdfParse(buffer);
  return result.text.trim();
}
