import path from "path";
import { getOpenCodeRoot, listOpenCodeFiles, readOpenCodeText } from "./storage";

export interface StarStoryResult {
  title: string;
  tags: string[];
  situation: string;
  task: string;
  action: string;
  result: string;
  filePath: string;
  score: number;
}

export async function findStarStories(question: string): Promise<StarStoryResult[]> {
  const files = (await listOpenCodeFiles("stars"))
    .filter((filePath) => filePath.toLowerCase().endsWith(".md"));

  const stories = await Promise.all(
    files.map(async (filePath) =>
      parseStarStory(filePath, await readOpenCodeText(path.relative(getOpenCodeRoot(), filePath)))
    )
  );

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

function parseStarStory(filePath: string, content: string): StarStoryResult {
  const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(filePath, path.extname(filePath));
  const tagsLine = content.match(/^Tags:\s*(.+)$/im)?.[1] || "";
  const tags = tagsLine.split(",").map((tag) => tag.trim()).filter(Boolean);
  return {
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
