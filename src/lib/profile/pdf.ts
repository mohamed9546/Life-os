// ============================================================
// PDF text extraction — pure JavaScript, no Python dependency.
// Uses pdf-parse which works on Cloud Run and Windows alike.
// ============================================================

import { PDFParse } from "pdf-parse";

export async function extractTextFromPdfUpload(
  _fileName: string,
  bytes: Uint8Array
): Promise<string> {
  const buffer = Buffer.from(bytes);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text.trim();
}
