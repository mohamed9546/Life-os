import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { execFile } from "child_process";

const execFileAsync = promisify(execFile);

export async function extractTextFromPdfUpload(
  fileName: string,
  bytes: Uint8Array
): Promise<string> {
  const tempPath = path.join(
    os.tmpdir(),
    `life-os-${Date.now()}-${sanitizeFileName(fileName || "upload")}.pdf`
  );

  await fs.writeFile(tempPath, bytes);

  try {
    const { stdout, stderr } = await execFileAsync(
      process.env.PYTHON_PATH || "python",
      [path.join(process.cwd(), "scripts", "extract_pdf_text.py"), tempPath],
      {
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    if (stderr?.trim()) {
      console.warn("[profile/pdf] extraction stderr:", stderr.trim());
    }

    return stdout.trim();
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}
