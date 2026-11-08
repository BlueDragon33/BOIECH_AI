import fs from "node:fs";
import path from "node:path";

const read = (relative) => fs.readFileSync(path.resolve(process.cwd(), relative), "utf8");
const exists = (relative) => fs.existsSync(path.resolve(process.cwd(), relative));

for (const file of [
  "wrangler.cloudflare.preview.example.jsonc",
  "scripts/prepare-cloudflare-preview.mjs",
  "scripts/validate-cloudflare-build-artifact.mjs",
  "app/api/control/status/route.ts",
  "../.github/workflows/deploy-boi-ech-preview.yml",
  "../.github/workflows/deploy-cloudflare.yml",
]) {
  if (!exists(file)) throw new Error(`Thiếu Cloudflare deployment scaffold: ${file}`);
}
if (exists("../.github/workflows/deploy-control-center.yml")) {
  throw new Error("BOIECH_AI không được tiếp tục deploy control-center cũ; Application-Management là control-plane canonical.");
}

const template = read("wrangler.cloudflare.preview.example.jsonc");
const prepare = read("scripts/prepare-cloudflare-preview.mjs");
const artifact = read("scripts/validate-cloudflare-build-artifact.mjs");
const auth = read("app/control-auth.server.ts");
const status = read("app/api/control/status/route.ts");
const vite = read("vite.config.ts");
const previewWorkflow = read("../.github/workflows/deploy-boi-ech-preview.yml");
const productionWorkflow = read("../.github/workflows/deploy-cloudflare.yml");
const LOCAL_D1_ID = "00000000-0000-0000-0000-000000000004";
const LEGACY_PRODUCTION_D1_ID = "7816425d-ce8a-4b3c-b303-7697fd4a529c";

for (const token of [
  '"name": "boi-ech-preview"',
  '"database_name": "boi-ech-preview-db"',
  '"binding": "DB"',
  '"binding": "ASSETS"',
  '"binding": "IMAGES"',
  '__BOI_ECH_PREVIEW_D1_DATABASE_ID__',
  '__BOI_ECH_PREVIEW_ORIGIN__',
  '"BOI_ECH_ACCOUNT_ORIGIN": "__BOI_ECH_PREVIEW_ORIGIN__"',
  '"BOI_ECH_ACCOUNT_FIRST": "true"',
  '"BOI_ECH_ACCOUNT_V2": "true"',
]) {
  if (!template.includes(token)) throw new Error(`Preview template thiếu: ${token}`);
}
const templateConfig = JSON.parse(template);
if (templateConfig.r2_buckets !== undefined && (!Array.isArray(templateConfig.r2_buckets) || templateConfig.r2_buckets.length > 0)) {
  throw new Error("Account-first FREE Preview must not configure R2.");
}
if (template.includes(LEGACY_PRODUCTION_D1_ID)) throw new Error("Preview template chứa production D1 ID.");
if (!prepare.includes('d1Uuid("BOI_ECH_PRODUCTION_D1_DATABASE_ID")') || !prepare.includes(LOCAL_D1_ID)) {
  throw new Error("Prepare script phải bắt buộc production D1 guard và chặn D1 local.");
}
if (prepare.includes(LEGACY_PRODUCTION_D1_ID)) throw new Error("Prepare script không được hard-code production D1 ID.");
if (!prepare.includes(".chatgpt.site")) throw new Error("Prepare script phải chặn fallback về ChatGPT Sites.");
for (const marker of [
  'optionalHttpsOrigin("BOI_ECH_PREVIEW_ORIGIN")',
  'optionalHttpsOrigin("APPLICATION_MANAGEMENT_PREVIEW_ORIGIN")',
  'if (!boiPreviewOrigin || !applicationManagementOrigin)',
  'if (boiPreviewOrigin === applicationManagementOrigin)',
]) {
  if (!prepare.includes(marker)) throw new Error(`V2 Preview thiếu kiểm tra origins: ${marker}`);
}
if (!vite.includes("CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH") || !vite.includes("boi-ech-local")) {
  throw new Error("Vite phải tách local binding khỏi Cloudflare preview config.");
}

for (const marker of ["redirect.configPath", "BOI_ECH_PREVIEW_D1_DATABASE_ID", "BOI_ECH_PRODUCTION_D1_DATABASE_ID", "boi-ech-preview-db", "BOI_ECH_DEPLOYMENT_CHANNEL", "Account-first FREE Preview must not configure R2"]) {
  if (!artifact.includes(marker)) throw new Error(`Generated artifact validator thiếu guard: ${marker}`);
}

if (/CONTROL_CENTER_ORIGIN|learning-management\.boiech-ai\.workers\.dev|\.chatgpt\.site/.test(auth)) {
  throw new Error("Bơi ếch Control Auth còn hard-code control center cũ.");
}
for (const marker of ["APPLICATION_MANAGEMENT_ORIGIN", "trustedControlOrigin", "CONTROL_ORIGIN_FORBIDDEN", "LOCAL_CONTROL_PLANE"]) {
  if (!auth.includes(marker)) throw new Error(`Control Auth thiếu exact-origin guard: ${marker}`);
}
for (const marker of ["BOI_ECH_DEPLOYMENT_CHANNEL", "BOI_ECH_BUILD_REVISION", 'application: "boi-ech"', 'paymentStorageReady']) {
  if (!status.includes(marker)) throw new Error(`Control status thiếu deployment/liveness marker: ${marker}`);
}

if (!previewWorkflow.includes("workflow_dispatch")) throw new Error("Preview deployment phải manual-only.");
if (/\n\s*push\s*:/.test(previewWorkflow)) throw new Error("Preview chưa được auto-deploy theo push.");
for (const token of ["DEPLOY_PREVIEW", "BOI_ECH_PREVIEW_D1_DATABASE_ID", "BOI_ECH_PRODUCTION_D1_DATABASE_ID", "boi-ech-preview-db --remote", "npm run cloudflare:artifact:check", "wrangler.cloudflare.preview.jsonc"]) {
  if (!previewWorkflow.includes(token)) throw new Error(`Preview workflow thiếu: ${token}`);
}
if (previewWorkflow.includes("boi-ech-db --remote")) throw new Error("Preview workflow không được migrate production D1.");
for (const marker of [
  'CONTROL_SERVICE_SECRET: ${{ secrets.CONTROL_SERVICE_SECRET }}',
  'missing+=("CONTROL_SERVICE_SECRET")',
  'missing+=("BOI_ECH_PREVIEW_ORIGIN")',
  'missing+=("APPLICATION_MANAGEMENT_PREVIEW_ORIGIN")',
  'npx wrangler secret put CONTROL_SERVICE_SECRET',
  'Protected Preview environment is incomplete',
]) {
  if (!previewWorkflow.includes(marker)) throw new Error(`Preview chưa có fail-closed Owner bridge: ${marker}`);
}
const artifactGuard = previewWorkflow.indexOf("name: Verify generated Preview artifact before any remote D1 mutation");
const sqlMutation = previewWorkflow.indexOf("name: Apply isolated Preview migrations");
if (artifactGuard < 0 || sqlMutation < artifactGuard) {
  throw new Error("Preview phải build+verify trước khi ghi D1 từ xa.");
}
if (/Development preview skipped; missing:/.test(previewWorkflow)) {
  throw new Error("Preview không được báo workflow thành công khi thiếu bí mật.");
}
if (previewWorkflow.includes(LEGACY_PRODUCTION_D1_ID)) throw new Error("Preview workflow không được hard-code production D1 ID.");
if (previewWorkflow.includes("grep -R") && previewWorkflow.includes(".wrangler/deploy/config.json")) {
  throw new Error("Preview workflow không được grep redirect file như generated config.");
}

if (!productionWorkflow.includes("workflow_dispatch") || !productionWorkflow.includes("DEPLOY_PRODUCTION")) {
  throw new Error("Production Bơi ếch phải bị khóa sau xác nhận thủ công.");
}
if (/\n\s*push\s*:/.test(productionWorkflow)) throw new Error("Production không được auto-deploy khi push main trong giai đoạn migration.");

console.log("Boi Ech Cloudflare scaffold gate PASS: canonical central separated, production frozen, fail-closed production D1 guard, FREE Account-first Preview excludes R2. Remote and payment acceptance remain separate.");
