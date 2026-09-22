import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const roster = fs.readFileSync(new URL("../app/teacher-roster-manager.tsx", import.meta.url), "utf8");

test("teacher roster new badge counts identities rather than status transitions", () => {
  assert.match(roster, /function rosterIdentitySignature\(items: RosterItem\[\]\)/);
  assert.match(roster, /items\.map\(\(item\) => item\.personCode\)\.filter\(Boolean\)\.sort\(\)\.join\("\\|"/);
  assert.match(roster, /function countNewRosterMembers\(previousSignature: string, items: RosterItem\[\]\)/);
  assert.match(roster, /new Set\(previousSignature\.split\("\\|"\)\.filter\(Boolean\)\)/);
  assert.doesNotMatch(roster, /\`\$\{item\.personCode\}:\$\{item\.status\}\`/);
});

test("auto refresh accumulates only genuinely new learners until acknowledgement", () => {
  assert.match(roster, /const additions = countNewRosterMembers\(rosterIdentitySignatureRef\.current, next\.roster\)/);
  assert.match(roster, /setChangedCount\(\(current\) => current \+ additions\)/);
  assert.match(roster, /rosterIdentitySignatureRef\.current = nextRosterIdentitySignature/);
  assert.match(roster, /onSync=\{\(\) => \{ setChangedCount\(0\); void syncRoster\("manual"\); \}\}/);
});
