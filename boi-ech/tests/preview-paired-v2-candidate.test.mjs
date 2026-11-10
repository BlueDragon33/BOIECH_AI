import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(new URL("../../.github/workflows/deploy-boi-ech-preview.yml", import.meta.url), "utf8");
const appSha = "7f2e2e40fdae99cc483112c5eba94c59df74a4ec";

test("protected paired Preview candidate uses the exact tested App SHA everywhere", () => {
  const pins = workflow.match(/[a-f0-9]{40}/g) ?? [];
  assert.deepEqual(pins, [appSha, appSha, appSha], "App checkout, revision and artifact must all pin the same reviewed candidate");
  assert.match(workflow, /repository: BlueDragon33\/Application-Management/);
  assert.match(workflow, /environment: boi-ech-preview/);
  assert.match(workflow, /DEPLOY_PREVIEW/);
  assert.match(workflow, /INSTALL_PREVIEW_BRIDGE/);
});

test("G3 source/read-only D1 gates precede ANY remote Preview SQL or Worker deployment", () => {
  const paired = workflow.indexOf("Fail-closed paired Account-first V2 source contract");
  const d1 = workflow.indexOf("Confirm approved D1 identities");
  const migrations = workflow.indexOf("Apply isolated Preview migrations");
  const deploy = workflow.indexOf("Deploy preview\n");
  assert.ok(paired >= 0 && d1 > paired && migrations > d1 && deploy > migrations);
  assert.match(workflow, /Paired V2 source contract mismatch\. STOP before D1 migration/);
  assert.match(workflow, /BOI_ECH_PRODUCTION_D1_DATABASE_ID/);
  assert.match(workflow, /APPLICATION_MANAGEMENT_PRODUCTION_D1_DATABASE_ID/);
  assert.doesNotMatch(workflow, /DEPLOY_PRODUCTION/);
});
