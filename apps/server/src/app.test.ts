import { EventEmitter } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { DocumentIndex } from "./index-store.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

async function testApp(markdown: string) {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "note-manager-export-"));
  temporaryDirectories.push(workspaceRoot);
  await writeFile(path.join(workspaceRoot, "note.md"), markdown);
  const index = new DocumentIndex(workspaceRoot, []);
  await index.rebuild();
  return createApp(
    { workspaceRoot, hiddenPaths: [], host: "127.0.0.1", port: 0 },
    { index, events: new EventEmitter() },
  );
}

describe("export asset endpoint", () => {
  it("only proxies remote images referenced by the selected document", async () => {
    const imageUrl = "https://example.com/note-image.png";
    const { app } = await testApp(`![架构图](${imageUrl})`);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71]), {
      headers: { "content-type": "image/png", "content-length": "4" },
    })));

    const allowed = await app.inject({
      method: "GET",
      url: `/api/export-asset?path=note.md&url=${encodeURIComponent(imageUrl)}`,
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.headers["content-type"]).toContain("image/png");

    const denied = await app.inject({
      method: "GET",
      url: `/api/export-asset?path=note.md&url=${encodeURIComponent("https://example.com/private.png")}`,
    });
    expect(denied.statusCode).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(1);
    await app.close();
  });
});
