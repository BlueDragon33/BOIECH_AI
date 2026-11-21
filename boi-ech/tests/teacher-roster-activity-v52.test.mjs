import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const helper = fs.readFileSync(new URL("../app/teacher-roster-activity.ts",import.meta.url),"utf8");
const roster = fs.readFileSync(new URL("../app/teacher-roster-manager.tsx",import.meta.url),"utf8");
const route = fs.readFileSync(new URL("../app/api/teacher/roster/route.ts",import.meta.url),"utf8");
const css = fs.readFileSync(new URL("../app/teacher-roster-v52.css",import.meta.url),"utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx",import.meta.url),"utf8");
const moduleExports={};
new Function("exports",ts.transpileModule(helper,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
}}).outputText)(moduleExports);
const {classifyRosterActivity,parseRosterUtc,formatRosterMoment,RECENT_DEVICE_SIGNAL_MS}=moduleExports;

test("SQLite last_seen_at is interpreted as UTC, not user locale",()=>{
  assert.equal(parseRosterUtc("2026-11-12 21:39:00"),Date.parse("2026-11-12T21:39:00Z"));
  assert.equal(parseRosterUtc("2026-11-21T12:00:00Z"),Date.parse("2026-11-21T12:00:00Z"));
  assert.equal(parseRosterUtc("not-date"),null);
  assert.equal(parseRosterUtc(""),null);
  assert.match(formatRosterMoment("2026-11-12 21:39:00"),/\d{2}/);
});

test("account approval never means logged in, online or currently studying",()=>{
  const now=Date.parse("2026-11-21T15:00:00Z");
  const sync="2026-11-21T14:59:50Z";
  const recent=classifyRosterActivity("2026-11-21 14:58:00",sync,now);
  assert.equal(recent.kind,"recent");
  assert.equal(recent.label,"Có tương tác gần đây");
  assert.match(recent.explanation,/chưa chứng minh/);
  assert.equal(classifyRosterActivity("2026-11-12 21:39:00",sync,now).kind,"older");
  assert.equal(classifyRosterActivity("2026-11-12 21:39:00",sync,now).label,"Chưa có tín hiệu mới");
  assert.equal(classifyRosterActivity("2026-11-21 14:58:00","2026-11-21T14:00:00Z",now).kind,"older");
  assert.equal(classifyRosterActivity("2026-11-21 14:58:00",sync,now,false).kind,"older");
  assert.equal(classifyRosterActivity("",sync,now).kind,"unknown");
  assert.equal(classifyRosterActivity("2026-11-22 14:00:00",sync,now).kind,"unknown");
  assert.equal(RECENT_DEVICE_SIGNAL_MS,5*60_000);
  assert.doesNotMatch(roster,/>Đang học<|online\s*:\s*true|offline\s*:\s*true/i);
});

test("teacher roster displays approved ACCOUNT and separate recorded ACTIVITY",()=>{
  assert.match(roster,/teacher-roster-status approved">Đã duyệt/);
  assert.match(roster,/classifyRosterActivity\(person\.lastSeenAt,data\.syncedAt,nowMs,!error\)/);
  assert.match(roster,/formatRosterMoment\(person\.lastSeenAt\)/);
  assert.match(roster,/không phải giờ học/);
  assert.match(roster,/Không khẳng định học viên đang online/);
  assert.match(roster,/aria-pressed=\{display==="list"\}/);
  assert.match(roster,/aria-pressed=\{display==="grid"\}/);
  assert.match(roster,/data-teacher-roster-ui/);
  assert.match(roster,/onSync/);
  assert.doesNotMatch(roster,/Tình trạng trực tuyến: Online|>Đang học</);
  assert.doesNotMatch(roster,/>Loại khỏi lớp<|>Duyệt tài khoản</);
});

test("P-256 and teacher class access remain server-only, read-only and scoped",()=>{
  assert.match(route,/verifyDeviceRequest\(payload,false\)/);
  assert.match(route,/teacher\.personRole!=="teacher"/);
  assert.match(route,/person_role='learner' AND status='approved'/);
  assert.match(route,/class_name\) IN/);
  assert.match(route,/last_seen_at/);
  assert.doesNotMatch(route,/UPDATE device_access|DELETE FROM device_access|INSERT INTO/);
  assert.doesNotMatch(route,/online:true|status:"online"|isOnline/);
});

test("professional responsive roster stylesheet and layout are included",()=>{
  assert.match(layout,/import "\.\/teacher-roster-v52\.css"/);
  assert.match(css,/teacher-roster-manager\.teacher-roster-v52/);
  assert.match(css,/teacher-roster-activity\.older/);
  assert.match(css,/teacher-roster-activity\.recent/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/:focus-visible/);
});

test("pure logic TS source and roster TSX parse without errors",()=>{
  for(const [name,source,kind] of [
    ["teacher-roster-activity.ts",helper,ts.ScriptKind.TS],
    ["teacher-roster-manager.tsx",roster,ts.ScriptKind.TSX],
  ]) {
    const parsed=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,kind);
    assert.equal(parsed.parseDiagnostics.length,0,name+":"+parsed.parseDiagnostics.map(x=>x.messageText).join(" "));
  }
});
