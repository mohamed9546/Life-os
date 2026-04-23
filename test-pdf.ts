import { extractTextFromPdfUpload } from "./src/lib/profile/pdf";
import fs from "fs";

async function main() {
  const bytes = fs.readFileSync("test.pdf");
  const text = await extractTextFromPdfUpload("test.pdf", new Uint8Array(bytes));
  console.log("Extracted:", text.substring(0, 100));
}

main().catch(console.error);
