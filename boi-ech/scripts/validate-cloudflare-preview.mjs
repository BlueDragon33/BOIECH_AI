import fs from "node:fs";
import path from "node:path";

const read = (relative) => fs.readFileSync(path.resolve(process.cwd(), relative), "utf8");
const exists = (relative) => fs.existsSync(path.resolve(process.cwd(), relative));

for (const file of [
  "wrangler.cloudflare.preview.example.jsonc",
  "scripts/prepare-cloudflare-preview.mjs",
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
const auth = read("app/control-auth.server.ts");
const vite = read("vite.config.ts");
const previewWorkflow = read("../.github/workflows/deploy-boi-ech-preview.yml");
const productionWorkflow = read("../.github/workflows/deploy-cloudflare.yml");

for (const token of [
  '"name": "boi-ech-preview"',
  '"database_name": "boi-ech-preview-db"',
  '"binding": "DB"',
  '"binding": "ASSETS"',
  '"binding": "IMAGES"',
  '"binding": "BUCKET"',
  '"bucket_name": "boi-ech-preview-payments"',
  '__BOI_ECH_PREVIEW_D1_DATABASE_ID__',
]) {
  if (!template.includes(token)) throw new Error(`Preview template thiếu: ${token}`);
}
if (template.includes("7816425d-ce8a-4b3c-b303-7697fd4a529c")) throw new Error("Preview template chứa production D1 ID.");
if (!prepare.includes("PRODUCTION_D1_ID") || !prepare.includes("Preview tuyệt đối không được dùng D1 local/production")) {
  throw new Error("Prepare script chưa chặn D1 local/production.");
}
if (!prepare.includes(".chatgpt.site")) throw new Error("Prepare script phải chặn fallback về ChatGPT Sites.");
if (!vite.includes("CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH") || !vite.includes("boi-ech-local")) {
  throw new Error("Vite phải tách local binding khỏi Cloudflare preview config.");
}

if (/CONTROL_CENTER_ORIGIN|learning-management\.boiech-ai\.workers\.dev|\.chatgpt\.site/.test(auth)) {
  throw new Error("Bơi ếch Control Auth còn hard-code control center cũ.");
}
for (const marker of ["APPLICATION_MANAGEMENT_ORIGIN", "trustedControlOrigin", "CONTROL_ORIGIN_FORBIDDEN", "LOCAL_CONTROL_PLANE"]) {
  if (!auth.includes(marker)) throw new Error(`Control Auth thiếu exact-origin guard: ${marker}`);
}

if (!previewWorkflow.includes("workflow_dispatch")) throw new Error("Preview deployment phải manual-only.");
if (/\n\s*push\s*:/.test(previewWorkflow)) throw new Error("Preview chưa được auto-deploy theo push.");
for (const token of ["DEPLOY_PREVIEW", "BOI_ECH_PREVIEW_D1_DATABASE_ID", "boi-ech-preview-db --remote", "boi-ech-preview-payments", "wrangler.cloudflare.preview.jsonc"]) {
  if (!previewWorkflow.includes(token)) throw new Error(`Preview workflow thiếu: ${token}`);
}
if (previewWorkflow.includes("boi-ech-db --remote")) throw new Error("Preview workflow không được migrate production D1.");

if (!productionWorkflow.includes("workflow_dispatch") || !productionWorkflow.includes("DEPLOY_PRODUCTION")) {
  throw new Error("Production Bơi ếch phải bị khóa sau xác nhận thủ công.");
}
if (/\n\s*push\s*:/.test(productionWorkflow)) throw new Error("Production không được auto-deploy khi push main trong giai đoạn migration.");

console.log("Boi Ech Cloudflare migration gate PASS: canonical central separated, production frozen, preview isolated D1/R2, exact control origin enforced.");
