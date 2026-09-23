import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const manual = read("../../.github/workflows/deploy-cloudflare.yml");
const once = read("../../.github/workflows/deploy-current-production-once.yml");

for (const [name, workflow] of [["manual", manual], ["one-shot", once]]) {
  test(`${name} production build uses the proven production D1 binding path`, () => {
    assert.match(workflow, /BOI_ECH_LOCAL_DATABASE_ID:\s*7816425d-ce8a-4b3c-b303-7697fd4a529c/);
    assert.doesNotMatch(workflow, /CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH:\s*wrangler\.d1\.jsonc/);
    assert.match(workflow, /grep -q '7816425d-ce8a-4b3c-b303-7697fd4a529c' dist\/server\/wrangler\.json/);
    assert.match(workflow, /00000000-0000-0000-0000-000000000004/);
    assert.match(workflow, /wrangler d1 migrations apply boi-ech-db --remote --config wrangler\.d1\.jsonc/);
    assert.match(workflow, /npx wrangler deploy/);
  });
}
