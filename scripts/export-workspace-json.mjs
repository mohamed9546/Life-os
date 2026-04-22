import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, opendir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

const textDecoder = new TextDecoder("utf-8", { fatal: true });

function parseArgs(argv) {
  let output = "life-os-workspace.json";
  let pretty = false;
  let includeNodeModules = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--pretty") {
      pretty = true;
      continue;
    }

    if (arg === "--output") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --output");
      }
      output = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--output=")) {
      output = arg.slice("--output=".length);
      continue;
    }

    if (arg === "--include-node-modules") {
      includeNodeModules = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { output, pretty, includeNodeModules };
}

function toPosixRelative(rootPath, filePath) {
  return path.relative(rootPath, filePath).split(path.sep).join("/");
}

function isExcludedPath(filePath, exportOptions) {
  for (const excludedPath of exportOptions.excludedPaths) {
    if (filePath === excludedPath) {
      return true;
    }
  }
  return false;
}

async function* walkFiles(rootPath, exportOptions) {
  const queue = [rootPath];
  let index = 0;

  while (index < queue.length) {
    const currentDir = queue[index];
    index += 1;
    const directory = await opendir(currentDir);

    for await (const entry of directory) {
      const fullPath = path.join(currentDir, entry.name);

      if (isExcludedPath(fullPath, exportOptions)) {
        continue;
      }

      if (entry.isDirectory()) {
        if (entry.name === "node_modules" && !exportOptions.includeNodeModules) {
          continue;
        }
        queue.push(fullPath);
        continue;
      }

      if (!entry.isFile() && !entry.isSymbolicLink()) {
        continue;
      }

      const fileStat = await stat(fullPath);
      if (!fileStat.isFile()) {
        continue;
      }

      yield {
        fullPath,
        relativePath: toPosixRelative(rootPath, fullPath),
        size: fileStat.size,
        mtime: fileStat.mtime.toISOString(),
      };
    }
  }
}

async function collectManifestStats(rootPath, exportOptions) {
  let entryCount = 0;
  let totalBytes = 0;

  for await (const file of walkFiles(rootPath, exportOptions)) {
    entryCount += 1;
    totalBytes += file.size;
  }

  return { entryCount, totalBytes };
}

function detectEncoding(buffer) {
  try {
    textDecoder.decode(buffer);
    return "utf8";
  } catch {
    return "base64";
  }
}

function bufferToContent(buffer, encoding) {
  return encoding === "utf8"
    ? textDecoder.decode(buffer)
    : buffer.toString("base64");
}

async function writeChunk(stream, chunk) {
  await new Promise((resolve, reject) => {
    stream.write(chunk, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function streamManifest({
  rootPath,
  outputPath,
  exportOptions,
  entryCount,
  totalBytes,
  pretty,
}) {
  const stream = createWriteStream(outputPath, { encoding: "utf8" });
  const spacing = pretty ? 2 : 0;
  const indentUnit = pretty ? " ".repeat(spacing) : "";
  const newline = pretty ? "\n" : "";
  const rootPathForJson = rootPath.split(path.sep).join("/");

  const headerObject = {
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    rootPath: rootPathForJson,
    entryCount,
    totalBytes,
  };

  const headerEntries = Object.entries(headerObject);

  try {
    await new Promise((resolve, reject) => {
      stream.once("open", resolve);
      stream.once("error", reject);
    });

    await writeChunk(stream, `{${newline}`);

    for (let index = 0; index < headerEntries.length; index += 1) {
      const [key, value] = headerEntries[index];
      const line = pretty
        ? `${indentUnit}${JSON.stringify(key)}: ${JSON.stringify(value)},${newline}`
        : `${JSON.stringify(key)}:${JSON.stringify(value)},`;
      await writeChunk(stream, line);
    }

    const entriesPrefix = pretty
      ? `${indentUnit}"entries": [${newline}`
      : `"entries":[`;
    await writeChunk(stream, entriesPrefix);

    let isFirstEntry = true;

    for await (const file of walkFiles(rootPath, exportOptions)) {
      const baseEntry = {
        path: file.relativePath,
        size: file.size,
        mtime: file.mtime,
      };

      let entry;

      try {
        const buffer = await readFile(file.fullPath);
        const encoding = detectEncoding(buffer);
        entry = {
          ...baseEntry,
          sha256: createHash("sha256").update(buffer).digest("hex"),
          encoding,
          content: bufferToContent(buffer, encoding),
        };
      } catch (error) {
        entry = {
          ...baseEntry,
          readError: error instanceof Error ? error.message : String(error),
        };
      }

      const serializedEntry = JSON.stringify(entry, null, spacing);
      const entryChunk = pretty
        ? `${isFirstEntry ? "" : `,${newline}`}${indentUnit}${serializedEntry.replace(/\n/g, `\n${indentUnit}`)}`
        : `${isFirstEntry ? "" : ","}${serializedEntry}`;

      await writeChunk(stream, entryChunk);
      isFirstEntry = false;
    }

    const closing = pretty ? `${newline}]${newline}}${newline}` : "]}";
    await writeChunk(stream, closing);

    await new Promise((resolve, reject) => {
      stream.end(() => resolve());
      stream.once("error", reject);
    });
  } catch (error) {
    stream.destroy();
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootPath = await realpath(process.cwd());
  const outputPath = path.resolve(rootPath, args.output);
  const exportOptions = {
    excludedPaths: [outputPath],
    includeNodeModules: args.includeNodeModules,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });

  console.log("[export-workspace] scanning workspace...");
  const { entryCount, totalBytes } = await collectManifestStats(
    rootPath,
    exportOptions
  );

  console.log(
    `[export-workspace] found ${entryCount} files totalling ${totalBytes} bytes`
  );
  console.log(
    `[export-workspace] writing manifest to ${toPosixRelative(rootPath, outputPath)}`
  );

  await streamManifest({
    rootPath,
    outputPath,
    exportOptions,
    entryCount,
    totalBytes,
    pretty: args.pretty,
  });

  console.log("[export-workspace] done");
}

main().catch((error) => {
  console.error(
    `[export-workspace] failed: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
  process.exitCode = 1;
});
