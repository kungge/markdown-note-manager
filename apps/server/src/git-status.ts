import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { GitStatusResult } from "./types.js";
import { isHiddenPath, toPortablePath } from "./path-security.js";

const execFileAsync = promisify(execFile);

function stripWorkspacePrefix(filePath: string, workspaceRelative: string): string | null {
  const portable = filePath.replace(/^"|"$/g, "").replaceAll("\\", "/");
  if (!workspaceRelative || workspaceRelative === ".") return portable;
  const prefix = `${workspaceRelative.replaceAll("\\", "/")}/`;
  return portable.startsWith(prefix) ? portable.slice(prefix.length) : null;
}

export async function readGitStatus(
  workspaceRoot: string,
  hiddenPaths: string[] = [],
): Promise<GitStatusResult> {
  try {
    const { stdout: rootOutput } = await execFileAsync(
      "git",
      ["-C", workspaceRoot, "rev-parse", "--show-toplevel"],
      { encoding: "utf8" },
    );
    const gitRoot = rootOutput.trim();
    const workspaceRelative = toPortablePath(path.relative(gitRoot, workspaceRoot)) || ".";
    const { stdout } = await execFileAsync(
      "git",
      [
        "-C",
        gitRoot,
        "-c",
        "core.quotePath=false",
        "status",
        "--porcelain=v1",
        "--branch",
        "--untracked-files=all",
        "--",
        workspaceRelative,
      ],
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
    );

    const lines = stdout.split(/\r?\n/).filter(Boolean);
    const branchLine = lines.find((line) => line.startsWith("## "));
    const branch = branchLine?.slice(3).split("...")[0].trim() || null;
    const files = lines
      .filter((line) => !line.startsWith("## ") && line.length >= 4)
      .map((line) => {
        const rawPath = line.slice(3);
        const targetPath = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1)! : rawPath;
        const relativePath = stripWorkspacePrefix(targetPath, workspaceRelative);
        if (!relativePath || isHiddenPath(relativePath, hiddenPaths)) return null;
        return {
          path: relativePath,
          indexStatus: line[0],
          workTreeStatus: line[1],
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return { available: true, branch, files };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Git status is unavailable.";
    return { available: false, branch: null, files: [], message };
  }
}
