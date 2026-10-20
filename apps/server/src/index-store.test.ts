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
});
