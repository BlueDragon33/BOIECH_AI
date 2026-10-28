import assert from "node:assert/strict";

const origin = process.argv[2];
assert.equal(origin, "https://boi-ech.boiech-ai.workers.dev", "Pass the canonical production origin explicitly.");

async function post(payload) {
  const response = await fetch(`${origin}/api/device`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(response.status, 200, `Device ${payload.action} returned HTTP ${response.status}.`);
  return response.json();
}

// Fresh browser identities, without fabricated learner registration or approval.
// Never print keys, identifiers, or database records into CI logs.
for (let index = 0; index < 2; index++) {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicKey = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const { device } = await post({ action: "register", publicKey });
  assert.equal(device.status, "pending", "Fresh devices require registration and policy classification.");
  assert.equal(device.registrationComplete, false);
  assert.equal(device.accessGroup, "unassigned");
  assert.equal(device.personCode, null);
  assert.equal(device.phone, null);
  const { challenge } = await post({ action: "challenge", deviceId: device.deviceId });
  const bytes = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(`boi-ech:${device.deviceId}:${challenge}`));
  const result = await post({ action: "presence", deviceId: device.deviceId, challenge, signature: Buffer.from(bytes).toString("base64url") });
  assert.equal(result.device.deviceId, device.deviceId);
  assert.equal(result.device.status, "pending");
  const repeat = await post({ action: "register", publicKey });
  assert.equal(repeat.device.deviceId, device.deviceId, "Repeat registration must be stable.");
  console.log(`Live device ${index + 1}: registration, challenge, signature, presence, repeat registration PASS.`);
}
