import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const [tool, ...args] = process.argv.slice(2);
if (!tool) {
  console.error("Missing command to run.");
  process.exit(1);
}

const logPath = process.env.WRANGLER_LOG_PATH || ".wrangler/wrangler.log";
mkdirSync(dirname(logPath), { recursive: true });

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(npx, ["--no-install", tool, ...args], {
  stdio: "inherit",
  env: {
    ...process.env,
    WRANGLER_LOG_PATH: logPath,
  },
  cwd: join(process.cwd()),
});

child.on("error", (error) => {
  console.error(`Failed to start ${tool}:`, error.message);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
