import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { isHiddenPath, toPortablePath } from "./path-security.js";
import { parseMarkdown } from "./markdown.js";
import type { DocumentSummary, IndexedDocument, SearchHit } from "./types.js";

const DEFAULT_IGNORED_DIRECTORIES = new Set([
  ".git",
  ".idea",
  ".vscode",
  "node_modules",
  "dist",
  "build",
  "coverage",
]);

function summary(document: IndexedDocument): DocumentSummary {
  const { content: _content, body: _body, frontMatter: _frontMatter, ...rest } = document;
  return rest;
}

function countOccurrences(value: string, query: string): number {
  if (!query) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = value.indexOf(query, offset)) !== -1) {
    count += 1;
    offset += query.length;
  }
  return count;
}

function createSnippet(body: string, query: string): string {
  const normalizedBody = body.toLocaleLowerCase();
  const index = normalizedBody.indexOf(query);
  const compact = body.replace(/\s+/g, " ").trim();
  if (index === -1) return compact.slice(0, 180);

  const start = Math.max(0, index - 70);
  const end = Math.min(body.length, index + query.length + 110);
  return `${start > 0 ? "…" : ""}${body.slice(start, end).replace(/\s+/g, " ")}${end < body.length ? "…" : ""}`;
}

export class DocumentIndex {
  private readonly documents = new Map<string, IndexedDocument>();

  constructor(
    private readonly workspaceRoot: string,
    private readonly hiddenPaths: string[],
  ) {}

  async rebuild(): Promise<void> {
    const nextDocuments = new Map<string, IndexedDocument>();

    const visit = async (directory: string): Promise<void> => {
      const entries = await readdir(directory, { withFileTypes: true });
      await Promise.all(
        entries.map(async (entry) => {
          if (entry.isSymbolicLink()) return;
          const absolutePath = path.join(directory, entry.name);
          const relativePath = toPortablePath(path.relative(this.workspaceRoot, absolutePath));
          if (isHiddenPath(relativePath, this.hiddenPaths)) return;

          if (entry.isDirectory()) {
            if (!entry.name.startsWith(".") && !DEFAULT_IGNORED_DIRECTORIES.has(entry.name)) {
              await visit(absolutePath);
            }
            return;
          }

          if (!entry.isFile() || !entry.name.toLocaleLowerCase().endsWith(".md")) return;
          const [content, info] = await Promise.all([readFile(absolutePath, "utf8"), stat(absolutePath)]);
          nextDocuments.set(
            relativePath,
            parseMarkdown(relativePath, content, info.size, info.mtime),
          );
        }),
      );
    };

    await visit(this.workspaceRoot);
    this.documents.clear();
    for (const [key, value] of nextDocuments) this.documents.set(key, value);
  }

  list(): DocumentSummary[] {
    return [...this.documents.values()]
      .map(summary)
      .sort((left, right) => left.path.localeCompare(right.path, "zh-CN"));
  }

  get(relativePath: string): IndexedDocument | undefined {
    return this.documents.get(relativePath);
  }

  search(rawQuery: string, rawScope = ""): SearchHit[] {
    const query = rawQuery.trim().toLocaleLowerCase();
    const scope = rawScope.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    if (!query) return [];

    return [...this.documents.values()]
      .filter((document) => !scope || document.path === scope || document.path.startsWith(`${scope}/`))
      .map((document) => {
        const title = document.title.toLocaleLowerCase();
        const documentPath = document.path.toLocaleLowerCase();
        const body = document.body.toLocaleLowerCase();
        const score =
          countOccurrences(title, query) * 30 +
          countOccurrences(documentPath, query) * 12 +
          Math.min(countOccurrences(body, query), 20) * 2;
        if (score === 0) return null;
        return { ...summary(document), score, snippet: createSnippet(document.body, query) };
      })
      .filter((hit): hit is SearchHit => hit !== null)
      .sort((left, right) => right.score - left.score || right.modifiedAt.localeCompare(left.modifiedAt))
      .slice(0, 100);
  }
}
