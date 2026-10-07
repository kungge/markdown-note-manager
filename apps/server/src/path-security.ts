import path from "node:path";
import { realpath } from "node:fs/promises";

export function toPortablePath(value: string): string {
  return value.split(path.sep).join("/");
}

export function normalizeRelativePath(value: string): string {
  const portable = value.replaceAll("\\", "/").replace(/^\/+/, "");
  const segments = portable.split("/").filter((segment) => segment && segment !== ".");
  if (segments.some((segment) => segment === "..")) {
    throw new Error("Path traversal is not allowed.");
  }
  return segments.join("/");
}

export function isHiddenPath(relativePath: string, hiddenPaths: string[]): boolean {
  const normalized = normalizeRelativePath(relativePath);
  const parentSegments = normalized.split("/").slice(0, -1);
  if (parentSegments.some((segment) => segment.startsWith("."))) return true;
  return hiddenPaths.some(
    (hidden) => normalized === hidden || normalized.startsWith(`${hidden}/`),
  );
}

export function resolveWorkspacePath(
  workspaceRoot: string,
  relativePath: string,
  hiddenPaths: string[] = [],
): string {
  const normalized = normalizeRelativePath(relativePath);
  if (isHiddenPath(normalized, hiddenPaths)) {
    throw new Error("The requested path is hidden.");
  }

  const resolved = path.resolve(workspaceRoot, ...normalized.split("/"));
  const relative = path.relative(workspaceRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("The requested path is outside the workspace.");
  }
  return resolved;
}

export async function resolveExistingWorkspacePath(
  workspaceRoot: string,
  relativePath: string,
  hiddenPaths: string[] = [],
): Promise<string> {
  const lexicalPath = resolveWorkspacePath(workspaceRoot, relativePath, hiddenPaths);
  const [realRoot, realTarget] = await Promise.all([realpath(workspaceRoot), realpath(lexicalPath)]);
  const relative = path.relative(realRoot, realTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Symbolic links outside the workspace are not allowed.");
  }
  return realTarget;
}
