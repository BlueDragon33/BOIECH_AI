import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const control = fs.readFileSync(new URL("../app/api/control/overview/route.ts", import.meta.url), "utf8");

test("verified payment opens paid access with a bounded term and an audit trail", () => {
  const block = control.match(/\} else if \(action === "verify-payment"\) \{([\s\S]*?)\} else if \(action === "reject-payment"\)/)?.[1];
  assert.ok(block, "verify-payment block exists");
  assert.match(block, /current\.payment_status !== "proof_submitted"/);
  assert.match(block, /current\.payment_proof_key/);
  assert.match(block, /paidAccessDays/);
  assert.match(block, /access_expires_at = \?/);
  assert.match(block, /accessExpiryAfterDays\(paidAccessDays\)/);
  assert.match(block, /learning_device_payment_verified/);
});
