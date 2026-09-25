import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(new URL("../app/api/application-management/contract/route.ts", import.meta.url), "utf8");

test("Bơi ếch publishes a public Universal Management Contract v1", () => {
  assert.ok(route.includes('schema: "application-management.contract/v1"'));
  assert.ok(route.includes('id: "boi-ech"'));
  assert.ok(route.includes('category: "Học tập"'));
  assert.ok(route.includes('status: "/api/control/status"'));
  assert.ok(route.includes("contentReview: true"));
  assert.ok(route.includes("payments: true"));
  assert.ok(route.includes("webLaunch: true"));
});

test("Bơi ếch keeps special access semantics fail-closed for generic mutation", () => {
  assert.ok(route.includes("deviceApproval: false"));
  assert.ok(route.includes("deviceBlock: false"));
  assert.ok(route.includes("deviceIdempotentCommands: false"));
  assert.ok(route.includes("optimisticConcurrency: false"));
  assert.ok(route.includes("remoteAdminReady: false"));
  assert.ok(route.includes('specialAccessFlow: "free-or-paid-access-must-be-explicit"'));
  assert.ok(route.includes("paymentBackedApprovalMustUseBoiAccessFlow: true"));
});
