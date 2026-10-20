import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { DocumentIndex } from "./index-store.js";

const createdDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("DocumentIndex", () => {
  it("indexes Chinese content and skips hidden directories", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "note-manager-test-"));
    createdDirectories.push(root);
    await mkdir(path.join(root, "20-knowledge"));
    await mkdir(path.join(root, "60-work"));
    await mkdir(path.join(root, ".private"));
    await mkdir(path.join(root, "build"));
    await writeFile(path.join(root, "20-knowledge", "java.md"), "# Java 排障\n处理线程池问题");
    await writeFile(path.join(root, "60-work", "secret.md"), "# 内部项目\n敏感内容");
    await writeFile(path.join(root, ".private", "hidden.md"), "# 隐藏笔记");
    await writeFile(path.join(root, "build", "generated.md"), "# 构建产物");
    await writeFile(path.join(root, "cover.png"), "not an image");

    const index = new DocumentIndex(root, ["60-work"]);
    const progress: string[] = [];
    const report = await index.rebuild((status) => progress.push(status.status));

    expect(index.list()).toHaveLength(1);
    expect(index.search("线程池")[0]?.path).toBe("20-knowledge/java.md");
    expect(index.search("敏感内容")).toHaveLength(0);
    expect(report).toMatchObject({
      status: "completed",
      indexedFiles: 1,
      skippedEntries: 4,
      errorEntries: 0,
      skippedByReason: {
        "configured-hidden": 1,
        "dot-directory": 1,
        "default-ignored": 1,
        "non-markdown": 1,
      },
    });
    expect(progress[0]).toBe("scanning");
    expect(progress.at(-1)).toBe("completed");
  });

  it("respects root and nested .gitignore files plus configured glob rules", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "note-manager-ignore-test-"));
    createdDirectories.push(root);
    await mkdir(path.join(root, "drafts"));
    await mkdir(path.join(root, "nested"));
    await mkdir(path.join(root, "custom"));
    await writeFile(path.join(root, ".gitignore"), "drafts/\n*.tmp.md\n!keep.tmp.md\n");
    await writeFile(path.join(root, "note.md"), "# 保留");
    await writeFile(path.join(root, "keep.tmp.md"), "# 反向包含");
    await writeFile(path.join(root, "drafts", "ignored.md"), "# 草稿");
    await writeFile(path.join(root, "nested", ".gitignore"), "*.md\n!visible.md\n");
    await writeFile(path.join(root, "nested", "private.md"), "# 被嵌套规则忽略");
    await writeFile(path.join(root, "nested", "visible.md"), "# 嵌套反向包含");
    await writeFile(path.join(root, "custom", "drop.md"), "# 自定义忽略");
    await writeFile(path.join(root, "custom", "keep.md"), "# 自定义反向包含");

    const index = new DocumentIndex(root, [], ["custom/**", "!custom/keep.md"]);
    const report = await index.rebuild();

    expect(index.list().map((document) => document.path)).toEqual([
      "custom/keep.md",
      "keep.tmp.md",
      "nested/visible.md",
      "note.md",
    ]);
    expect(report.skippedByReason.gitignore).toBe(2);
    expect(report.skippedByReason["configured-ignore"]).toBe(1);
    expect(index.isIgnored("nested/private.md", false)).toBe(true);
    expect(index.isIgnored("nested/visible.md", false)).toBe(false);
  });
});
