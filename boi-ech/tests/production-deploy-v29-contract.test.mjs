import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(new URL("../../.github/workflows/deploy-production-v29-once.yml", import.meta.url), "utf8");

test("production V29 build uses the stable Vite binding path with the production D1 id", () => {
  assert.match(workflow, /BOI_ECH_LOCAL_DATABASE_ID:\s*7816425d-ce8a-4b3c-b303-7697fd4a529c/);
  assert.doesNotMatch(workflow, /CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH:\s*wrangler\.d1\.jsonc/);
});

test("production V29 still verifies generated artifact before deploy", () => {
  assert.match(workflow, /Verify production D1 binding in generated artifact/);
  assert.match(workflow, /grep -q '7816425d-ce8a-4b3c-b303-7697fd4a529c' dist\/server\/wrangler\.json/);
  assert.match(workflow, /Deploy current Bơi ếch production Worker/);
});
