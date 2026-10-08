import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Boi has an authenticated, read-only automation endpoint", () => {
  const route = read("app/api/control/automation/route.ts");
  assert.match(route, /export async function GET\(request: Request\)/);
  assert.match(route, /await requireControlService\(request\)/);
  assert.match(route, /getAccessAutomationSettings\(\)/);
  assert.match(route, /controlResponse\(\{ automation: await getAccessAutomationSettings\(\) \}, 200, request\)/);
  assert.doesNotMatch(route, /export async function POST|rows\(|deletedDeviceRows|auditRows|course_audit_log|device_access/);
  assert.match(route, /withControlCors\(request, deviceErrorResponse\(error\)\)/);
});

test("Boi status advertises the focused automation endpoint", () => {
  const status = read("app/api/control/status/route.ts");
  assert.match(status, /automation: "\/api\/control\/automation"/);
});
