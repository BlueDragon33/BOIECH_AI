import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");

const scanRoots = ["app", "worker", "drizzle"];
const scanFiles = ["vite.config.ts", "wrangler.d1.jsonc"];
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".jsonc", ".sql"]);

const forbidden = [
  {
    label: "Bơi ếch Worker URL",
    pattern: /boi-ech\.boiech-ai\.workers\.dev/i,
  },
  {
    label: "Bơi ếch D1 database",
    pattern: /\bboi-ech-db\b/i,
  },
  {
    label: "legacy BOI_ECH_BASE_URL",
    pattern: /\bBOI_ECH_BASE_URL\b/,
  },
  {
    label: "direct import from Bơi ếch runtime",
    pattern: /(?:from\s+|import\s*\()\s*["'][^"']*boi-ech[^"']*["']/i,
  },
];

async function collect(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await collect(absolute));
    else if (entry.isFile() && textExtensions.has(extname(entry.name))) files.push(absolute);
  }
  return files;
}

const files = [];
for (const root of scanRoots) files.push(...await collect(join(projectRoot, root)));
for (const file of scanFiles) files.push(join(projectRoot, file));

const violations = [];
for (const file of files) {
  const content = await readFile(file, "utf8");
  for (const rule of forbidden) {
    if (rule.pattern.test(content)) {
      violations.push(`${relative(projectRoot, file)}: ${rule.label}`);
    }
  }
}

const wrangler = await readFile(join(projectRoot, "wrangler.d1.jsonc"), "utf8");
if (!/"name"\s*:\s*"suc-khoe-tre"/.test(wrangler)) {
  violations.push("wrangler.d1.jsonc: Worker phải có tên suc-khoe-tre");
}
if (!/"database_name"\s*:\s*"suc-khoe-tre-db"/.test(wrangler)) {
  violations.push("wrangler.d1.jsonc: D1 phải là suc-khoe-tre-db");
}
if (!/"binding"\s*:\s*"DB"/.test(wrangler)) {
  violations.push("wrangler.d1.jsonc: thiếu binding DB riêng cho Sức khỏe trẻ");
}

if (violations.length > 0) {
  console.error("Child Health boundary gate FAILED:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Child Health boundary gate PASS (${files.length} files checked).`);
console.log("- Worker: suc-khoe-tre");
console.log("- D1: suc-khoe-tre-db");
console.log("- No Bơi ếch runtime/API/D1 dependency detected.");
