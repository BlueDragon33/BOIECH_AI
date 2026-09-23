import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const manual = fs.readFileSync(new URL("../../.github/workflows/deploy-cloudflare.yml", import.meta.url), "utf8");

test("manual production build uses the proven production D1 binding path", () => {
  assert.match(manual, /workflow_dispatch:/);
  assert.doesNotMatch(manual, /\bpush\s*:/);
  assert.match(manual, /BOI_ECH_LOCAL_DATABASE_ID:\s*7816425d-ce8a-4b3c-b303-7697fd4a529c/);
  assert.doesNotMatch(manual, /CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH:\s*wrangler\.d1\.jsonc/);
  assert.match(manual, /grep -q '7816425d-ce8a-4b3c-b303-7697fd4a529c' dist\/server\/wrangler\.json/);
  assert.match(manual, /00000000-0000-0000-0000-000000000004/);
  assert.match(manual, /wrangler d1 migrations apply boi-ech-db --remote --config wrangler\.d1\.jsonc/);
  assert.match(manual, /npx wrangler deploy/);
});

test("temporary one-shot production publish artifacts are removed after deployment", () => {
  assert.equal(fs.existsSync(new URL("../../.github/workflows/deploy-current-production-once.yml", import.meta.url)), false);
  assert.equal(fs.existsSync(new URL("../.publish-current-production-once", import.meta.url)), false);
});
