import path from "node:path";
import { stat } from "node:fs/promises";

export interface AppConfig {
  workspaceRoot: string;
  host: string;
  port: number;
  hiddenPaths: string[];
}

function parseHiddenPaths(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
}

export async function loadConfig(): Promise<AppConfig> {
  const rawWorkspace = process.env.NOTE_MANAGER_WORKSPACE;
  if (!rawWorkspace) {
    throw new Error(
      "NOTE_MANAGER_WORKSPACE is required. Set it to the absolute path of your NoteHub directory.",
    );
  }

  const workspaceRoot = path.resolve(rawWorkspace);
  const info = await stat(workspaceRoot).catch(() => null);
  if (!info?.isDirectory()) {
    throw new Error(`Workspace does not exist or is not a directory: ${workspaceRoot}`);
  }

  const parsedPort = Number.parseInt(process.env.NOTE_MANAGER_PORT ?? "43110", 10);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new Error("NOTE_MANAGER_PORT must be a valid TCP port.");
  }

  return {
    workspaceRoot,
    host: process.env.NOTE_MANAGER_HOST ?? "127.0.0.1",
    port: parsedPort,
    hiddenPaths: parseHiddenPaths(process.env.NOTE_MANAGER_HIDDEN_PATHS),
  };
}
