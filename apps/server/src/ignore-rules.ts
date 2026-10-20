import { readFile } from "node:fs/promises";
import path from "node:path";
import createIgnore from "ignore";
import { toPortablePath } from "./path-security.js";
import type { ScanSkipReason } from "./types.js";

type IgnoreReason = Extract<ScanSkipReason, "gitignore" | "configured-ignore">;
type IgnoreMatcher = ReturnType<typeof createIgnore>;

interface IgnoreLayer {
  basePath: string;
  matcher: IgnoreMatcher;
}

export interface IgnoreMatch {
  ignored: boolean;
  reason: IgnoreReason | null;
}

function candidatePath(relativePath: string, isDirectory: boolean): string {
  const normalized = toPortablePath(relativePath).replace(/^\/+|\/+$/g, "");
  return isDirectory && normalized ? `${normalized}/` : normalized;
}

function applyMatcher(
  matcher: IgnoreMatcher,
  candidate: string,
  reason: IgnoreReason,
  current: IgnoreMatch,
): IgnoreMatch {
  if (!candidate) return current;
  const result = matcher.test(candidate);
  if (result.ignored) return { ignored: true, reason };
  if (result.unignored) return { ignored: false, reason: null };
  return current;
}

/**
 * Applies Git-compatible ignore files from the workspace root down to the
 * current directory, then applies application-level patterns last.
 */
export class WorkspaceIgnoreRules {
  private readonly gitignoreLayers: IgnoreLayer[] = [];
  private readonly configuredMatcher: IgnoreMatcher;

  constructor(private readonly workspaceRoot: string, configuredPatterns: string[]) {
    this.configuredMatcher = createIgnore().add(configuredPatterns);
  }

  async loadGitIgnore(directory: string): Promise<void> {
    const gitignorePath = path.join(directory, ".gitignore");
    let content: string;
    try {
      content = await readFile(gitignorePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }

    const basePath = toPortablePath(path.relative(this.workspaceRoot, directory));
    this.gitignoreLayers.push({ basePath, matcher: createIgnore().add(content) });
    this.gitignoreLayers.sort((left, right) => {
      const leftDepth = left.basePath ? left.basePath.split("/").length : 0;
      const rightDepth = right.basePath ? right.basePath.split("/").length : 0;
      const depth = leftDepth - rightDepth;
      return depth || left.basePath.localeCompare(right.basePath);
    });
  }

  match(relativePath: string, isDirectory: boolean): IgnoreMatch {
    const candidate = candidatePath(relativePath, isDirectory);
    let result: IgnoreMatch = { ignored: false, reason: null };

    for (const layer of this.gitignoreLayers) {
      const scoped = layer.basePath
        ? candidate.startsWith(`${layer.basePath}/`)
          ? candidate.slice(layer.basePath.length + 1)
          : ""
        : candidate;
      result = applyMatcher(layer.matcher, scoped, "gitignore", result);
    }

    return applyMatcher(this.configuredMatcher, candidate, "configured-ignore", result);
  }
}
