import path from "path";
import {
  getOpenCodeRoot,
  listOpenCodeFiles,
  readOpenCodeText,
  writeOpenCodeText,
} from "./storage";

export interface StarStoryResult {
  slug: string;
  title: string;
  tags: string[];
  situation: string;
  task: string;
  action: string;
  result: string;
  filePath: string;
  score: number;
}

export interface StarStoryInput {
  title: string;
  tags: string[];
  situation: string;
  task: string;
  action: string;
  result: string;
  slug?: string;
}

export async function listStarStories(): Promise<StarStoryResult[]> {
  const files = (await listOpenCodeFiles("stars"))
    .filter((filePath) => filePath.toLowerCase().endsWith(".md"));

  const stories = await Promise.all(
    files.map(async (filePath) =>
      parseStarStory(filePath, await readOpenCodeText(path.relative(getOpenCodeRoot(), filePath)))
    )
  );

  return stories.sort((left, right) => left.title.localeCompare(right.title));
}

export async function findStarStories(question: string): Promise<StarStoryResult[]> {
  const stories = await listStarStories();

  const queryTokens = tokenize(question);
  return stories
    .map((story) => ({
      ...story,
      score: scoreStory(story, queryTokens),
    }))
    .filter((story) => story.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}

export async function saveStarStory(input: StarStoryInput): Promise<StarStoryResult> {
  const slug = input.slug?.trim() || slugify(input.title);
  const relativePath = path.join("stars", `${slug}.md`);
  await writeOpenCodeText(relativePath, renderStarStoryMarkdown(input));
  return parseStarStory(path.join(getOpenCodeRoot(), relativePath), await readOpenCodeText(relativePath));
}

export async function deleteStarStory(slug: string): Promise<void> {
  const fs = await import("fs/promises");
  const filePath = path.join(getOpenCodeRoot(), "stars", `${slug}.md`);
  try {
    await fs.unlink(filePath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}

function parseStarStory(filePath: string, content: string): StarStoryResult {
  const slug = path.basename(filePath, path.extname(filePath));
  const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(filePath, path.extname(filePath));
  const tagsLine = content.match(/^Tags:\s*(.+)$/im)?.[1] || "";
  const tags = tagsLine.split(",").map((tag) => tag.trim()).filter(Boolean);
  return {
    slug,
    title,
    tags,
    situation: extractSection(content, "Situation"),
    task: extractSection(content, "Task"),
    action: extractSection(content, "Action"),
    result: extractSection(content, "Result"),
    filePath,
    score: 0,
  };
}

function renderStarStoryMarkdown(input: StarStoryInput): string {
  return [
    `# ${input.title.trim()}`,
    ``,
    `Tags: ${input.tags.map((tag) => tag.trim()).filter(Boolean).join(", ")}`,
    ``,
    `## Situation`,
    input.situation.trim(),
    ``,
    `## Task`,
    input.task.trim(),
    ``,
    `## Action`,
    input.action.trim(),
    ``,
    `## Result`,
    input.result.trim(),
    ``,
  ].join("\n");
}

function extractSection(content: string, section: string): string {
  const match = content.match(new RegExp(`##\\s+${section}([\\s\\S]*?)(?=\\n##\\s+|$)`, "i"));
  return match?.[1]?.trim() || "";
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function scoreStory(story: StarStoryResult, queryTokens: string[]): number {
  const haystack = [story.title, story.tags.join(" "), story.situation, story.task, story.action, story.result]
    .join(" ")
    .toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (story.tags.some((tag) => tag.toLowerCase() === token)) {
      score += 5;
    }
    if (haystack.includes(token)) {
      score += 2;
    }
  }
  return score;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "star-story";
}
