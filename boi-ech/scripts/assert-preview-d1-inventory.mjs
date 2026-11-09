import fs from "node:fs";
import { previewD1Policy } from "./preview-d1-policy.mjs";

const [file] = process.argv.slice(2);
const previewName = previewD1Policy().name;
const previewId = String(process.env.BOI_ECH_PREVIEW_D1_DATABASE_ID ?? "").toLowerCase().trim();
const productionId = String(process.env.BOI_ECH_PRODUCTION_D1_DATABASE_ID ?? "").toLowerCase().trim();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function block(message) { throw new Error("CLOUDFLARE_D1_PREVIEW_BLOCKED: " + message); }
if (!file) block("Wrangler D1 inventory path is required.");
if (!uuid.test(previewId) || !uuid.test(productionId) || previewId === productionId) {
  block("Preview and Production D1 UUIDs must be real and different.");
}
let list;
try { list = JSON.parse(fs.readFileSync(file, "utf8")); }
catch { block("Cannot read the Cloudflare D1 inventory JSON; no migration is allowed."); }
if (!Array.isArray(list) || list.some(item => !item || typeof item !== "object"
   || typeof item.name !== "string" || typeof item.uuid !== "string")) {
  block("Cloudflare D1 list --json returned an unexpected shape.");
}
const previews = list.filter(item => item.name === previewName);
if (previews.length !== 1) {
  block(`Expected exactly one approved ${previewName}, found ${previews.length} of ${list.length} D1 databases. Do not auto-delete or select another database.`);
}
if (previews[0].uuid.toLowerCase() !== previewId) {
  block("Dedicated Preview D1 UUID does not match the protected environment secret.");
}
if (!list.some(item => item.uuid.toLowerCase() === productionId)) {
  block("Production D1 ID is not present in the selected Cloudflare account; refusing to guess account boundaries.");
}
if (previews[0].uuid.toLowerCase() === productionId) block("Preview D1 unexpectedly matches Production.");
console.log(`Remote read-only D1 inventory PASS: ${previewName} is present and distinct from Production (${list.length} D1 databases). No mutations performed.`);
