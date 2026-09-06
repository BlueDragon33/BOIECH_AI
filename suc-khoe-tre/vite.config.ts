import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const HEALTH_DATABASE_ID = "6bb920e1-c4dc-4f15-96d5-07516490959b";
const { d1 } = hostingConfig;

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1 ? [{ binding: d1, database_name: "suc-khoe-tre-db", database_id: HEALTH_DATABASE_ID }] : [],
};

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    server: { host: "0.0.0.0", allowedHosts: ["terminal.local"] },
    plugins: [vinext(), sites(), cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] }, inspectorPort: false, config: localBindingConfig })],
  };
});
