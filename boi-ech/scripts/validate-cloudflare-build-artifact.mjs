import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REDIRECT = path.join(ROOT, ".wrangler", "deploy", "config.json");
const LOCAL_D1_ID = "00000000-0000-0000-0000-000000000004";

function fail(message) { throw new Error(message); }
function value(name, required = false) {
  const result = String(process.env[name] ?? "").trim();
  if (required && !result) fail(`${name} is required.`);
  return result;
}
function readJson(file, label) {
  if (!fs.existsSync(file)) fail(`${label} missing: ${path.relative(ROOT, file)}`);
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) { fail(`${label} invalid JSON: ${error instanceof Error ? error.message : String(error)}`); }
}
function insideRoot(file, label) {
  const relative = path.relative(ROOT, file);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail(`${label} must resolve inside repository.`);
  return relative.split(path.sep).join("/");
}

const previewId = value("BOI_ECH_PREVIEW_D1_DATABASE_ID", true).toLowerCase();
const productionId = value("BOI_ECH_PRODUCTION_D1_DATABASE_ID").toLowerCase();
if (previewId === LOCAL_D1_ID) fail("Bơi ếch preview must not use local D1 identity.");
if (productionId && previewId === productionId) fail("Bơi ếch preview must not reuse production D1.");

const redirect = readJson(REDIRECT, "Wrangler generated-config redirect");
if (typeof redirect?.configPath !== "string" || !redirect.configPath.trim()) fail(".wrangler/deploy/config.json must contain configPath.");
const generatedPath = path.resolve(path.dirname(REDIRECT), redirect.configPath);
const generatedRelative = insideRoot(generatedPath, "Generated Wrangler config");
if (!generatedRelative.startsWith("dist/")) fail(`Generated Wrangler config must live under dist/, got ${generatedRelative}.`);
const generated = readJson(generatedPath, "Generated Wrangler config");

if (generated.name !== "boi-ech-preview") fail(`Unexpected Worker name: ${String(generated.name)}.`);
const db = (Array.isArray(generated.d1_databases) ? generated.d1_databases : []).find((item) => item?.binding === "DB");
if (!db) fail("Generated config missing DB binding.");
if (db.database_name !== "boi-ech-preview-db") fail("Generated config uses wrong Bơi ếch preview database name.");
if (String(db.database_id ?? "").toLowerCase() !== previewId) fail("Generated config D1 ID does not match BOI_ECH_PREVIEW_D1_DATABASE_ID.");
if (String(db.database_id ?? "").toLowerCase() === LOCAL_D1_ID) fail("Generated config references local D1.");
if (productionId && String(db.database_id ?? "").toLowerCase() === productionId) fail("Generated config references production D1.");

const bucket = (Array.isArray(generated.r2_buckets) ? generated.r2_buckets : []).find((item) => item?.binding === "BUCKET");
if (!bucket || bucket.bucket_name !== "boi-ech-preview-payments") fail("Generated config missing isolated Bơi ếch preview payment R2 bucket.");
if (generated.assets?.binding !== "ASSETS") fail("Generated config missing ASSETS binding.");
if (generated.images?.binding !== "IMAGES") fail("Generated config missing IMAGES binding.");

const vars = generated.vars ?? {};
if (vars.BOI_ECH_DEPLOYMENT_CHANNEL !== "cloudflare-preview") fail("Generated config deployment channel is not cloudflare-preview.");
if (!/^[A-Za-z0-9._-]{7,80}$/.test(String(vars.BOI_ECH_BUILD_REVISION ?? ""))) fail("Generated config is missing a valid Bơi ếch build revision.");

console.log("Bơi ếch generated Cloudflare deployment artifact PASS.");
console.log(`Redirect: .wrangler/deploy/config.json -> ${generatedRelative}`);
console.log(`Worker: ${generated.name}`);
console.log(`D1: ${db.database_name}`);
console.log(`R2: ${bucket.bucket_name}`);
