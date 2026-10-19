import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import mime from "mime-types";
import type { AppConfig } from "./config.js";
import {
  DirectoryPickerUnavailableError,
  selectWorkspaceDirectory,
} from "./directory-picker.js";
import { readGitStatus } from "./git-status.js";
import {
  normalizeRelativePath,
  resolveExistingWorkspacePath,
  resolveWorkspacePath,
} from "./path-security.js";
import { WorkspaceNotConfiguredError, WorkspaceRuntime } from "./workspace-runtime.js";

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

const MAX_EXPORT_IMAGE_BYTES = 25 * 1024 * 1024;

function referencedRemoteImage(content: string, rawUrl: string): URL | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (content.includes(rawUrl)) return url;
  try {
    return content.includes(decodeURI(rawUrl)) ? url : null;
  } catch {
    return null;
  }
}

async function readLimitedResponse(response: Response): Promise<Buffer> {
  const declaredSize = Number.parseInt(response.headers.get("content-length") ?? "0", 10);
  if (declaredSize > MAX_EXPORT_IMAGE_BYTES) throw new Error("Remote image is too large.");
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_EXPORT_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error("Remote image is too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size);
}

export interface AppDependencies {
  workspace?: WorkspaceRuntime;
  selectDirectory?: () => Promise<string | null>;
}

export async function createApp(config: AppConfig, dependencies?: AppDependencies) {
  const app = Fastify({ logger: true });
  const ownsWorkspace = !dependencies?.workspace;
  const workspace = dependencies?.workspace ?? new WorkspaceRuntime(
    config.workspaceRoot,
    config.hiddenPaths,
  );
  const selectDirectory = dependencies?.selectDirectory ?? selectWorkspaceDirectory;
  await workspace.initialize();

  workspace.events.on("watcher-error", (error) => app.log.error(error, "Workspace file watcher failed."));
  workspace.events.on("rebuild-error", (error) => app.log.error(error, "Failed to rebuild the workspace index."));
  if (ownsWorkspace) app.addHook("onClose", async () => workspace.close());

  app.get("/api/health", async () => ({ status: "ok" }));

  app.get("/api/workspace", async () => workspace.snapshot());

  app.post("/api/workspace/select", async (request, reply) => {
    if (request.headers["x-note-manager-request"] !== "workspace-ui") {
      return reply.code(403).send({ message: "Workspace selection must be started from the application UI." });
    }
    try {
      const selectedPath = await selectDirectory();
      if (!selectedPath) return { selected: false, canceled: true, workspace: workspace.snapshot() };
      const snapshot = await workspace.setWorkspace(selectedPath);
      return { selected: true, canceled: false, workspace: snapshot };
    } catch (error) {
      const status = error instanceof DirectoryPickerUnavailableError ? 501 : 500;
      return reply.code(status).send({
        message: error instanceof Error ? error.message : "无法打开目录选择器。",
      });
    }
  });

  app.get("/api/documents", async () => ({
    documents: workspace.snapshot().configured ? workspace.getIndex().list() : [],
  }));

  app.get<{ Querystring: { path?: string } }>("/api/document", async (request, reply) => {
    try {
      const relativePath = normalizeRelativePath(request.query.path ?? "");
      const workspaceRoot = workspace.getRoot();
      resolveWorkspacePath(workspaceRoot, relativePath, config.hiddenPaths);
      const document = workspace.getIndex().get(relativePath);
      if (!document) return reply.code(404).send({ message: "Document not found." });
      return document;
    } catch (error) {
      const status = error instanceof WorkspaceNotConfiguredError ? 409 : 400;
      return reply.code(status).send({ message: error instanceof Error ? error.message : "Invalid path." });
    }
  });

  app.get<{ Querystring: { q?: string; scope?: string } }>("/api/search", async (request) => ({
    results: workspace.snapshot().configured
      ? workspace.getIndex().search(request.query.q ?? "", request.query.scope ?? "")
      : [],
  }));

  app.get<{ Querystring: { path?: string } }>("/api/asset", async (request, reply) => {
    try {
      const relativePath = normalizeRelativePath(request.query.path ?? "");
      const workspaceRoot = workspace.getRoot();
      const absolutePath = await resolveExistingWorkspacePath(
        workspaceRoot,
        relativePath,
        config.hiddenPaths,
      );
      const contentType = mime.lookup(absolutePath) || "application/octet-stream";
      if (!SUPPORTED_IMAGE_TYPES.has(contentType)) {
        return reply.code(415).send({ message: "Only supported image files can be served." });
      }
      const data = await readFile(absolutePath);
      return reply.header("content-type", contentType).header("cache-control", "no-store").send(data);
    } catch (error) {
      return reply.code(404).send({ message: error instanceof Error ? error.message : "Asset not found." });
    }
  });

  app.get<{ Querystring: { path?: string; url?: string } }>("/api/export-asset", async (request, reply) => {
    try {
      const relativePath = normalizeRelativePath(request.query.path ?? "");
      const workspaceRoot = workspace.getRoot();
      resolveWorkspacePath(workspaceRoot, relativePath, config.hiddenPaths);
      const document = workspace.getIndex().get(relativePath);
      if (!document) return reply.code(404).send({ message: "Document not found." });

      const remoteUrl = referencedRemoteImage(document.content, request.query.url ?? "");
      if (!remoteUrl) {
        return reply.code(403).send({ message: "The remote image is not referenced by this document." });
      }

      const response = await fetch(remoteUrl, {
        headers: { "user-agent": "MarkdownNoteManager/0.1" },
        redirect: "follow",
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        return reply.code(502).send({ message: `Remote image request failed: ${response.status}` });
      }
      const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim() ?? "";
      if (!SUPPORTED_IMAGE_TYPES.has(contentType)) {
        return reply.code(415).send({ message: "The remote resource is not a supported image." });
      }
      const data = await readLimitedResponse(response);
      return reply.header("content-type", contentType).header("cache-control", "no-store").send(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Remote image export failed.";
      const status = message.includes("too large") ? 413 : 502;
      return reply.code(status).send({ message });
    }
  });

  app.get("/api/git/status", async () => {
    if (!workspace.snapshot().configured) {
      return { available: false, branch: null, files: [], message: "请先选择工作区。" };
    }
    return readGitStatus(workspace.getRoot(), config.hiddenPaths);
  });

  app.get("/api/events", async (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    reply.raw.write("event: ready\ndata: {}\n\n");

    const onChange = (payload: string) => {
      reply.raw.write(`event: workspace-change\ndata: ${payload}\n\n`);
    };
    workspace.events.on("workspace-change", onChange);
    request.raw.on("close", () => workspace.events.off("workspace-change", onChange));
  });

  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const webDist = path.resolve(currentDirectory, "../../web/dist");
  await app.register(fastifyStatic, { root: webDist, wildcard: false });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) return reply.code(404).send({ message: "Not found." });
    return reply.sendFile("index.html");
  });

  return { app, workspace };
}
