import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const LOCAL_ONLY_DATABASE_ID = "00000000-0000-0000-0000-000000000004";
const { d1 } = hostingConfig;
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const allowLan = process.env.LOCAL_CONTROL_ALLOW_LAN === "true";
const cloudflareConfigPath = process.env.CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH?.trim();

const localVars = [
  "CONTROL_SERVICE_SECRET",
  "APPLICATION_MANAGEMENT_ORIGIN",
  "LOCAL_CONTROL_PLANE",
  "LOCAL_CONTROL_ALLOW_LAN",
].reduce<Record<string, string>>((values, key) => {
  const value = process.env[key];
  if (value) values[key] = value;
  return values;
}, {});

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  vars: localVars,
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "boi-ech-local",
          database_id: process.env.BOI_ECH_LOCAL_DATABASE_ID || LOCAL_ONLY_DATABASE_ID,
        },
      ]
    : [],
};

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const { cloudflare } = await import("@cloudflare/vite-plugin");
  const cloudflareOptions = cloudflareConfigPath
    ? {
        configPath: cloudflareConfigPath,
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false as const,
      }
    : {
        config: localBindingConfig,
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false as const,
      };

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: allowLan ? true : ["terminal.local", "localhost", "127.0.0.1"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [vinext(), sites(), cloudflare(cloudflareOptions)],
  };
});
