import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { isHiddenPath, toPortablePath } from "./path-security.js";
import { parseMarkdown } from "./markdown.js";
import type {
  DocumentSummary,
  IndexedDocument,
  ScanSkipReason,
  ScanStatus,
  SearchHit,
} from "./types.js";

const DEFAULT_IGNORED_DIRECTORIES = new Set([
  ".git",
  ".idea",
  ".vscode",
  "node_modules",
  "dist",
  "build",
  "coverage",
]);

const MAX_REPORTED_ISSUES = 100;

export function createIdleScanStatus(): ScanStatus {
  return {
    status: "idle",
    workspaceName: null,
    scannedEntries: 0,
    indexedFiles: 0,
    skippedEntries: 0,
    errorEntries: 0,
    skippedByReason: {
      "configured-hidden": 0,
      "dot-directory": 0,
      "default-ignored": 0,
      "symbolic-link": 0,
      "non-markdown": 0,
    },
    issues: [],
    truncatedIssues: 0,
    currentPath: null,
    startedAt: null,
    finishedAt: null,
  };
}

function cloneScanStatus(status: ScanStatus): ScanStatus {
  return {
    ...status,
    skippedByReason: { ...status.skippedByReason },
    issues: [...status.issues],
  };
}

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

  async rebuild(onProgress?: (status: ScanStatus) => void): Promise<ScanStatus> {
    const nextDocuments = new Map<string, IndexedDocument>();
    const report: ScanStatus = {
      ...createIdleScanStatus(),
      status: "scanning",
      workspaceName: path.basename(this.workspaceRoot),
      startedAt: new Date().toISOString(),
    };

    const publish = () => onProgress?.(cloneScanStatus(report));
    const recordSkip = (reason: ScanSkipReason) => {
      report.skippedEntries += 1;
      report.skippedByReason[reason] += 1;
    };
    const recordError = (relativePath: string, error: unknown) => {
      report.errorEntries += 1;
      const rawMessage = error instanceof Error ? error.message : "Unknown scan error.";
      const message = rawMessage.replaceAll(this.workspaceRoot, ".");
      if (report.issues.length < MAX_REPORTED_ISSUES) {
        report.issues.push({ path: relativePath || ".", message });
      } else {
        report.truncatedIssues += 1;
      }
    };

    publish();

    const visit = async (directory: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        recordError(toPortablePath(path.relative(this.workspaceRoot, directory)) || ".", error);
        publish();
        return;
      }
      await Promise.all(
        entries.map(async (entry) => {
          const absolutePath = path.join(directory, entry.name);
          const relativePath = toPortablePath(path.relative(this.workspaceRoot, absolutePath));
          report.scannedEntries += 1;
          report.currentPath = relativePath;

          if (entry.isSymbolicLink()) {
            recordSkip("symbolic-link");
            publish();
            return;
          }

          if (entry.isDirectory()) {
            if (entry.name.startsWith(".")) {
              recordSkip("dot-directory");
            } else if (DEFAULT_IGNORED_DIRECTORIES.has(entry.name)) {
              recordSkip("default-ignored");
            } else if (isHiddenPath(relativePath, this.hiddenPaths)) {
              recordSkip("configured-hidden");
            } else {
              await visit(absolutePath);
            }
            publish();
            return;
          }

          if (isHiddenPath(relativePath, this.hiddenPaths)) {
            recordSkip("configured-hidden");
          } else if (!entry.isFile() || !entry.name.toLocaleLowerCase().endsWith(".md")) {
            recordSkip("non-markdown");
          } else {
            try {
              const [content, info] = await Promise.all([
                readFile(absolutePath, "utf8"),
                stat(absolutePath),
              ]);
              nextDocuments.set(
                relativePath,
                parseMarkdown(relativePath, content, info.size, info.mtime),
              );
              report.indexedFiles += 1;
            } catch (error) {
              recordError(relativePath, error);
            }
          }
          publish();
        }),
      );
    };

    await visit(this.workspaceRoot);
    this.documents.clear();
    for (const [key, value] of nextDocuments) this.documents.set(key, value);
    report.status = "completed";
    report.currentPath = null;
    report.finishedAt = new Date().toISOString();
    publish();
    return cloneScanStatus(report);
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
