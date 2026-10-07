import matter from "gray-matter";
import type { Heading, IndexedDocument } from "./types.js";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, "-")
    .replace(/[^\p{Letter}\p{Number}\-_]/gu, "");
}

function extractHeadings(body: string): Heading[] {
  const headings: Heading[] = [];
  let fenced = false;

  body.split(/\r?\n/).forEach((line, index) => {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) return;
    const text = match[2].trim();
    headings.push({
      level: match[1].length,
      text,
      slug: slugify(text),
      line: index + 1,
    });
  });

  return headings;
}

function extractTags(data: Record<string, unknown>): string[] {
  const raw = data.tags;
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(/[，,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

export function parseMarkdown(
  relativePath: string,
  rawContent: string,
  size: number,
  modifiedAt: Date,
): IndexedDocument {
  let body = rawContent;
  let data: Record<string, unknown> = {};

  try {
    const parsed = matter(rawContent);
    body = parsed.content;
    data = parsed.data as Record<string, unknown>;
  } catch {
    // Malformed front matter must not make the document unreadable.
  }

  const headings = extractHeadings(body);
  const fileName = relativePath.split("/").at(-1)?.replace(/\.md$/i, "") ?? relativePath;
  const frontMatterTitle = typeof data.title === "string" ? data.title.trim() : "";
  const title = frontMatterTitle || headings.find((heading) => heading.level === 1)?.text || fileName;

  return {
    path: relativePath,
    title,
    size,
    modifiedAt: modifiedAt.toISOString(),
    headings,
    tags: extractTags(data),
    content: rawContent,
    body,
    frontMatter: data,
  };
}
