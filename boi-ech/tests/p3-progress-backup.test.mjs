import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../app/progress-backup.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("exports", "module", code)(module.exports, module);
const { parseLocalQuizBackup } = module.exports;
const current = "Nguyễn Văn A";
const create = (draft, extra = {}) => JSON.stringify({
  hoc_vien: current, mon_hoc: "Ứng dụng AI trong dạy và học môn Bơi ếch",
  ngay_sao_luu: "2026-11-12T09:00:00Z",
  tien_do: draft, ...extra,
});

test("P3 reads legacy and version-2 portable local drafts without claiming scores or completion", () => {
  const progress = { answers: {0:1,9:3}, lessonAnswers:{"01-0":2,"08-9":1},
    lessonFlags:{"01":[1,2,2]}, lessonChecked:{"08":[0,9]},
    flags:[0,1,1], checked:[5],
    completed:["bai-01","bai-02"], submitted:true,
    lessonSubmitted:["01","02"], scores:{"01":10},
    entitlementActive:true, certificate:{"verificationCode":"FAKE"} };
  const expected = {
    answers:{0:1,9:3}, lessonAnswers:{"01-0":2,"08-9":1},
    lessonFlags:{"01":[1,2]}, lessonChecked:{"08":[0,9]},
    flags:[0,1], checked:[5],
  };
  assert.deepEqual(parseLocalQuizBackup(create(progress), current),expected);
  assert.deepEqual(parseLocalQuizBackup(create(progress,{backup_version:2,backup_purpose:"local-quiz-drafts"}),current),expected);
  for(const forbidden of ["completed","submitted","lessonSubmitted","scores","certificate","entitlementActive"])
    assert.ok(!(forbidden in expected));
});

test("P3 rejects corrupt JSON, oversized files, wrong learner and incorrect course format", () => {
  const good = {answers:{0:1}};
  for (const value of ["", "not-json", "{}", " ".repeat(262145),
    create(good,{hoc_vien:"Nguyễn Văn B"}),
    create(good,{hoc_vien:""}),
    create(good,{mon_hoc:"Another course"}),
    create(good,{backup_version:999}),
    create(null),
  ]) assert.throws(()=>parseLocalQuizBackup(value,current));
});

test("P3 rejects malformed answer indexes and pollution keys", () => {
  const variants=[
    {answers:{"10":1}},
    {answers:{"__proto__":1}},
    {lessonAnswers:{"01-10":0}},
    {lessonAnswers:{"09-0":0}},
    {lessonAnswers:{"01-0":-1}},
    {lessonAnswers:{"01-0":"1"}},
    {lessonFlags:{"__proto__":[1]}},
    {lessonChecked:{"01":[10]}},
    {flags:[0,NaN]},
    {checked:Array(12).fill(0)},
  ];
  for(const value of variants) {
    // JSON.stringify object literal __proto__ is not an own data property:
    // convert this one case explicitly below.
    if(Object.keys(value).length===0) continue;
    assert.throws(()=>parseLocalQuizBackup(create(value),current),
      'must fail malformed draft '+JSON.stringify(value));
  }
  assert.throws(()=>parseLocalQuizBackup(create({answers:JSON.parse('{"__proto__":1}')}),current));
  assert.throws(()=>parseLocalQuizBackup(create({lessonFlags:JSON.parse('{"__proto__":[1]}')}),current));
});

test("P3 restores only local unanswered quiz draft and never imports certificate authority",()=>{
 assert.match(page,/parseLocalQuizBackup\(await file\.text\(\), learnerFullName\)/);
 assert.match(page,/window\.confirm\("Chỉ khôi phục câu trả lời nháp/);
 assert.match(page,/const submitted = new Set\(\[\.\.\.current\.lessonSubmitted, \.\.\.completed\]\)/);
 assert.match(page,/answers: submitted\.has\("03"\) \? current\.answers : restored\.answers/);
 assert.match(page,/lessonAnswers: \{ \.\.\.current\.lessonAnswers, \.\.\.Object\.fromEntries\(allowed\) \}/);
 const fn=page.slice(page.indexOf("async function restoreLocalQuizDraft("),page.indexOf("const managerDeviceId ="));
 for(const forbidden of ["restored.completed","restored.submitted","restored.lessonSubmitted","setServerScores(", "issueCertificate(", "postCourse(", "queueCourseAction(", "setDeviceAccess("])
  assert.ok(!fn.includes(forbidden),forbidden+" must not be imported into trusted state");
 assert.match(page,/type="file" accept="\.json,application\/json"/);
 assert.match(css,/\.backup-panel \.backup-actions input\[type="file"\]/);
});
