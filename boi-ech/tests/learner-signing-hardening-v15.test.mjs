import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const inbox = fs.readFileSync(new URL("../app/student-teacher-inbox.tsx", import.meta.url), "utf8");
const adaptive = fs.readFileSync(new URL("../app/student-adaptive-coach.tsx", import.meta.url), "utf8");

for (const [name, source] of [["student teacher inbox", inbox], ["student adaptive coach", adaptive]]) {
  test(`${name} requires the real learner private key before requesting a challenge`, () => {
    assert.match(source, /if \(!credential\.privateKey \|\| !crypto\.subtle\) \{/);
    assert.match(source, /Không tìm thấy khóa ký của thiết bị Học viên/);
    assert.doesNotMatch(source, /crypto\.getRandomValues/);
    const keyGuard = source.indexOf("if (!credential.privateKey || !crypto.subtle)");
    const challenge = source.indexOf('fetch("/api/device"', keyGuard);
    const sign = source.indexOf("crypto.subtle.sign", challenge);
    assert.ok(keyGuard >= 0, "private-key guard missing");
    assert.ok(challenge > keyGuard, "challenge must be requested only after key validation");
    assert.ok(sign > challenge, "real ECDSA signing must follow the challenge");
  });
}
