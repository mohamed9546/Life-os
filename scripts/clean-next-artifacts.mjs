import { rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const nextDir = path.join(root, ".next");
const tsBuildInfoPath = path.join(root, "tsconfig.tsbuildinfo");
const mode = process.argv.includes("--all") ? "all" : "types";

const targets =
  mode === "all"
    ? [nextDir, tsBuildInfoPath]
    : [path.join(nextDir, "types"), tsBuildInfoPath];

for (const target of targets) {
  try {
    await rm(target, { recursive: true, force: true });
    console.log(`[clean-next-artifacts] removed ${path.relative(root, target)}`);
  } catch (error) {
    console.warn(
      `[clean-next-artifacts] could not remove ${path.relative(root, target)}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
