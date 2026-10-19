import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { WorkspaceRuntime } from "./workspace-runtime.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

async function testApp(markdown: string) {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "note-manager-export-"));
  temporaryDirectories.push(workspaceRoot);
  await writeFile(path.join(workspaceRoot, "note.md"), markdown);
  const workspace = new WorkspaceRuntime(workspaceRoot, [], false);
  return createApp(
    { workspaceRoot, hiddenPaths: [], host: "127.0.0.1", port: 0 },
    { workspace },
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

describe("workspace selection endpoint", () => {
  it("starts without a workspace and switches after an explicit UI selection", async () => {
    const selectedRoot = await mkdtemp(path.join(tmpdir(), "note-manager-selected-"));
    temporaryDirectories.push(selectedRoot);
    await mkdir(path.join(selectedRoot, "notes"));
    await writeFile(path.join(selectedRoot, "notes", "welcome.md"), "# 新工作区\n正文");

    const workspace = new WorkspaceRuntime(null, [], false);
    let pickerResult: string | null = null;
    const { app } = await createApp(
      { workspaceRoot: null, hiddenPaths: [], host: "127.0.0.1", port: 0 },
      { workspace, selectDirectory: async () => pickerResult },
    );

    const before = await app.inject({ method: "GET", url: "/api/workspace" });
    expect(before.json()).toMatchObject({ configured: false, documentCount: 0 });

    const forbidden = await app.inject({ method: "POST", url: "/api/workspace/select" });
    expect(forbidden.statusCode).toBe(403);

    const canceled = await app.inject({
      method: "POST",
      url: "/api/workspace/select",
      headers: { "x-note-manager-request": "workspace-ui" },
    });
    expect(canceled.json()).toMatchObject({ selected: false, canceled: true });

    pickerResult = selectedRoot;
    const selected = await app.inject({
      method: "POST",
      url: "/api/workspace/select",
      headers: { "x-note-manager-request": "workspace-ui" },
    });
    expect(selected.statusCode).toBe(200);
    expect(selected.json()).toMatchObject({
      selected: true,
      workspace: { configured: true, name: path.basename(selectedRoot), documentCount: 1 },
    });

    const documents = await app.inject({ method: "GET", url: "/api/documents" });
    expect(documents.json().documents[0]).toMatchObject({
      path: "notes/welcome.md",
      title: "新工作区",
    });
    await app.close();
  });
});
