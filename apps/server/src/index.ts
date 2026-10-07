import { EventEmitter } from "node:events";
import { watch } from "node:fs";
import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { DocumentIndex } from "./index-store.js";
import { isHiddenPath } from "./path-security.js";

async function main(): Promise<void> {
  const config = await loadConfig();
  const index = new DocumentIndex(config.workspaceRoot, config.hiddenPaths);
  await index.rebuild();

  const events = new EventEmitter();
  const { app } = await createApp(config, { index, events });
  let rebuildTimer: NodeJS.Timeout | undefined;
  const watcher = watch(config.workspaceRoot, { recursive: true }, (_eventType, fileName) => {
    const portableName = fileName?.toString().replaceAll("\\", "/") ?? "";
    if (!portableName.toLocaleLowerCase().endsWith(".md")) return;
    if (isHiddenPath(portableName, config.hiddenPaths)) return;
    if (portableName.split("/").some((segment) => segment === "node_modules")) return;
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(async () => {
      try {
        await index.rebuild();
        events.emit("workspace-change", JSON.stringify({ changedAt: new Date().toISOString() }));
      } catch (error) {
        app.log.error(error, "Failed to rebuild the workspace index.");
      }
    }, 350);
  });
  watcher.on("error", (error) => app.log.error(error, "Workspace file watcher failed."));

  const close = async () => {
    clearTimeout(rebuildTimer);
    watcher.close();
    await app.close();
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  await app.listen({ host: config.host, port: config.port });
  app.log.info(
    { workspace: config.workspaceRoot, documents: index.list().length },
    "Markdown Note Manager is ready.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
