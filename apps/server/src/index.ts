import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

// pnpm --filter 会把脚本工作目录切到 apps/server，dotenv 默认只读取 cwd 下的 .env，
// 导致项目根目录的 .env 不生效。这里显式从 monorepo 根目录加载。
loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

async function main(): Promise<void> {
  const config = await loadConfig();
  const { app, workspace } = await createApp(config);

  const close = async () => app.close();
  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  await app.listen({ host: config.host, port: config.port });
  app.log.info(
    { workspace: workspace.snapshot().root, documents: workspace.snapshot().documentCount },
    "Markdown Note Manager is ready.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
