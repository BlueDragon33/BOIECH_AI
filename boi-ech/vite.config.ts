import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const LOCAL_ONLY_DATABASE_ID = "00000000-0000-0000-0000-000000000004";
const PRODUCTION_DATABASE_ID = "7816425d-ce8a-4b3c-b303-7697fd4a529c";
const { d1 } = hostingConfig;
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const isProductionCloudflareBuild = process.env.BOI_ECH_PRODUCTION_BUILD === "true";
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

const bindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  vars: localVars,
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: isProductionCloudflareBuild ? "boi-ech-db" : "boi-ech-local",
          database_id: isProductionCloudflareBuild
            ? PRODUCTION_DATABASE_ID
            : process.env.BOI_ECH_LOCAL_DATABASE_ID || LOCAL_ONLY_DATABASE_ID,
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
        config: bindingConfig,
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
