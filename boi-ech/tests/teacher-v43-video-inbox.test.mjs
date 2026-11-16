import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source=readFileSync(resolve("app/api/teacher/overview/route.ts"),"utf8");
const shell=readFileSync(resolve("app/teacher-role-shell.tsx"),"utf8");
const result=readFileSync(resolve("app/teacher-video-result-details.tsx"),"utf8");
const coaching=readFileSync(resolve("app/teacher-video-priority-v42.ts"),"utf8");
const intervention=readFileSync(resolve("app/teacher-intervention-engine.server.ts"),"utf8");
test("legacy video metrics absent versus recorded zero: true null at API and UI",()=>{
 assert.match(source,/score: measured\(source\.score\)/);
 assert.match(source,/confidence: measured\(source\.confidence\)/);
 assert.doesNotMatch(source,/Math\.round\(Number\(source\.score\) \|\| 0\)/);
 assert.doesNotMatch(source,/Math\.round\(Number\(source\.confidence\) \|\| 0\)/);
 assert.match(result,/score:number\|null;confidence:number\|null/);
 assert.match(result,/analysis\.score===null\?"Chưa có dữ liệu"/);
 assert.match(result,/analysis\.confidence===null\?"Chưa có dữ liệu"/);
 assert.match(result,/analysis\.score===null\?null:technicalLevel\(analysis\.score\)/);
 assert.match(coaching,/!valid\(analysis\.confidence\)/);
 assert.match(intervention,/confidence === null/);
});
test("per-video inbox is built only from already class-scoped authenticated teacher events",()=>{
 assert.match(source,/await verifyDeviceRequest\(payload, previewRequest\)/);
 assert.match(source,/teacher\.personRole !== "teacher"/);
 assert.match(source,/lower\(trim\(da\.class_name\)\) IN \(\$\{classPlaceholders\}\)/);
 assert.match(source,/SELECT e\.id, e\.device_id, e\.event_type/);
 assert.match(source,/const scopedLearnerIndex = new Map\(/);
 assert.match(source,/event\.event_type === "video_ai_analysis"/);
 assert.match(source,/Number\.isSafeInteger\(event\.id\)/);
 assert.match(source,/scopedLearnerIndex\.has\(event\.device_id\)/);
 assert.match(source,/analysisSummary\(event\.detail_json, event\.created_at\)/);
 assert.match(source,/detail\.analysisAt === analysis\.analyzedAt/);
 assert.match(source,/eventId: event\.id!/);
 assert.match(source,/state: review\?\.action === "review"/);
 assert.match(source,/\.slice\(0, 40\)/);
 assert.match(source,/\s+videoInbox,/);
 assert.doesNotMatch(source,/originalVideo|rawVideo|videoBase64|videoBytes|videoBlob/);
});
test("teacher inbox never performs automated send or claims push and retains human action modal",()=>{
 assert.match(shell,/data-teacher-video-inbox="v43"/);
 assert.match(shell,/TeacherVideoEventInbox entries=\{overview\?\.videoInbox \?\? \[\]\}/);
 assert.match(shell,/data-video-inbox-summary/);
 assert.match(shell,/entries\.flatMap\(entry=>/);
 assert.match(shell,/visibleLearners\.includes\(learner\)/);
 assert.match(shell,/analysisAt:entry\.analysis\.analyzedAt/);
 assert.match(shell,/mode:"review",learner:previewLearner/);
 assert.match(shell,/mode:"assignment",learner:previewLearner/);
 assert.match(shell,/chưa phải thông báo push/);
 assert.match(shell,/data-mark-video-seen/);
 assert.match(shell,/markVideoInboxSeen\(deviceId,entry\.eventId,entry\.receiptRevision\)/);
 assert.match(shell,/api\/teacher\/video-inbox/);
 assert.doesNotMatch(shell.slice(shell.indexOf("function TeacherVideoEventInbox"),shell.indexOf("function AnalysisQueue")),/\bfetch\(|\bwindow\.localStorage|localStorage/);
});
test("completed review of exact video is not inferred for a later video",()=>{
 assert.match(source,/return detail\.analysisAt === analysis\.analyzedAt/);
 assert.match(shell,/entry\.state==="needs-review"/);
 assert.match(shell,/entry\.state==="reviewed"/);
});
