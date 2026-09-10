import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const COURSE_DATABASE_ID = "7816425d-ce8a-4b3c-b303-7697fd4a529c";

const { d1 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const allowLan = process.env.LOCAL_CONTROL_ALLOW_LAN === "true";

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
          database_name: "boi-ech-db",
          database_id: COURSE_DATABASE_ID,
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: allowLan ? true : ["terminal.local", "localhost", "127.0.0.1"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
