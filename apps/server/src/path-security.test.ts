import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  isHiddenPath,
  normalizeRelativePath,
  resolveExistingWorkspacePath,
  resolveWorkspacePath,
} from "./path-security.js";

describe("workspace path security", () => {
  const root = path.resolve(path.sep, "notes", "NoteHub");

  it("normalizes Windows separators for API paths", () => {
    expect(normalizeRelativePath("20-knowledge\\tech\\java.md")).toBe(
      "20-knowledge/tech/java.md",
    );
  });

  it("rejects traversal segments", () => {
    expect(() => normalizeRelativePath("../secret.md")).toThrow(/traversal/i);
    expect(() => normalizeRelativePath("notes/../../secret.md")).toThrow(/traversal/i);
  });

  it("recognizes hidden directory descendants", () => {
    expect(isHiddenPath("30-finance/review.md", ["30-finance"])).toBe(true);
    expect(isHiddenPath("20-knowledge/finance.md", ["30-finance"])).toBe(false);
    expect(isHiddenPath(".workbuddy/memory/today.md", [])).toBe(true);
    expect(isHiddenPath("notes/.private/draft.md", [])).toBe(true);
    expect(isHiddenPath(".gitignore", [])).toBe(false);
  });

  it("rejects hidden paths before resolving", () => {
    expect(() => resolveWorkspacePath(root, "60-work/private.md", ["60-work"])).toThrow(
      /hidden/i,
    );
  });

  it("rejects a symlink whose real target is outside the workspace", async () => {
    const { mkdtemp, rm, symlink, writeFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const testRoot = await mkdtemp(path.join(tmpdir(), "note-path-root-"));
    const outsideRoot = await mkdtemp(path.join(tmpdir(), "note-path-outside-"));
    const outsideFile = path.join(outsideRoot, "outside.png");
    try {
      await writeFile(outsideFile, "not really an image");
      await symlink(outsideFile, path.join(testRoot, "linked.png"));

      await expect(resolveExistingWorkspacePath(testRoot, "linked.png")).rejects.toThrow(
        /symbolic links/i,
      );
    } finally {
      await Promise.all([rm(testRoot, { recursive: true }), rm(outsideRoot, { recursive: true })]);
    }
  });
});
