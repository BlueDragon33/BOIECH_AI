import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const runtime = fs.readFileSync(new URL("../app/api/control/runtime/route.ts", import.meta.url), "utf8");
const productionWorkflow = fs.readFileSync(new URL("../../.github/workflows/deploy-cloudflare.yml", import.meta.url), "utf8");
const repoRoot = new URL("../../", import.meta.url);

test("current Boi runtime publishes a machine-readable management identity", () => {
  for (const token of [
    'applicationId: "boi-ech"',
    'repository: "BlueDragon33/BOIECH_AI"',
    'runtime: "boi-ech"',
    'controlContract: "application-management"',
    "controlGeneration: 2",
    'sourceTrack: "main"',
    '"cache-control": "no-store, max-age=0"',
  ]) assert.ok(runtime.includes(token), `missing runtime identity token: ${token}`);
});

test("legacy V29 one-off production trigger is removed", () => {
  assert.equal(fs.existsSync(new URL("../../.github/workflows/deploy-production-v29-once.yml", import.meta.url)), false);
  assert.equal(fs.existsSync(new URL("../.deployment-v29", import.meta.url)), false);
  assert.equal(fs.existsSync(new URL("../tests/production-deploy-v29-contract.test.mjs", import.meta.url)), false);
});

test("only the generic manual production workflow remains authoritative", () => {
  assert.match(productionWorkflow, /workflow_dispatch:/);
  assert.match(productionWorkflow, /DEPLOY_PRODUCTION/);
  assert.doesNotMatch(productionWorkflow, /\bpush\s*:/);
  assert.match(productionWorkflow, /Deploy current Bơi ếch production Worker/);
});
