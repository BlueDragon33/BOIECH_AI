import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../app/api/teacher/roster/route.ts", import.meta.url), "utf8");

test("duplicate teacher roster mutations are no-ops", () => {
  assert.match(route, /action === "approve" && target\.status === "approved"/);
  assert.match(route, /action === "remove" && target\.status === "blocked"/);
  assert.match(route, /if \(alreadyInRequestedState\) \{[\s\S]*?return response\(await listRoster\(teacherClasses\)\);[\s\S]*?\}/);
});

test("idempotency guard runs before mutation and audit writes", () => {
  const guard = route.indexOf("if (alreadyInRequestedState)");
  const mutation = route.indexOf('if (action === "approve")', guard + 1);
  const audit = route.indexOf("INSERT INTO course_audit_log");
  assert.ok(guard >= 0, "idempotency guard missing");
  assert.ok(mutation > guard, "mutation must follow idempotency guard");
  assert.ok(audit > mutation, "audit must happen only after a real mutation");
});
