import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const inbox = fs.readFileSync(new URL("../app/student-teacher-inbox.tsx", import.meta.url), "utf8");
const adaptive = fs.readFileSync(new URL("../app/student-adaptive-coach.tsx", import.meta.url), "utf8");
const inboxRoute = fs.readFileSync(new URL("../app/api/course/teacher-actions/route.ts", import.meta.url), "utf8");
const replyRoute = fs.readFileSync(new URL("../app/api/course/teacher-actions/reply/route.ts", import.meta.url), "utf8");
const statusRoute = fs.readFileSync(new URL("../app/api/course/teacher-actions/status/route.ts", import.meta.url), "utf8");

test("learner experience surfaces remain mounted", () => {
  assert.ok(layout.includes("<StudentRoleShell />"));
  assert.ok(layout.includes("<StudentTeacherInbox />"));
  assert.ok(layout.includes("<StudentAdaptiveCoach />"));
});

test("learner signed clients require real keys and canonical device ids", () => {
  for (const source of [inbox, adaptive]) {
    assert.ok(source.includes("if (!credential.privateKey || !crypto.subtle)"));
    assert.ok(source.includes("Không tìm thấy khóa ký của thiết bị Học viên."));
    assert.ok(source.includes("if (/^[a-f0-9]{64}$/i.test(direct)) return direct;"));
    assert.ok(source.includes("crypto.subtle.sign"));
    assert.doesNotMatch(source, /crypto\.getRandomValues/);
  }
});

test("learner inbox remains signed, learner-only and device-scoped", () => {
  assert.ok(inboxRoute.includes("verifyDeviceRequest(payload, previewRequest)"));
  assert.ok(inboxRoute.includes('learner.personRole !== "learner"'));
  assert.ok(inboxRoute.includes("WHERE device_id = ?"));
  assert.ok(inboxRoute.includes("LIMIT 20"));
  assert.ok(inboxRoute.includes("LIMIT 100"));
});

test("learner replies remain bounded, idempotent and bound to the original action", () => {
  assert.ok(replyRoute.includes("verifyDeviceRequest(payload, previewRequest)"));
  assert.ok(replyRoute.includes('learner.personRole !== "learner"'));
  assert.ok(replyRoute.includes("WHERE id = ? AND device_id = ?"));
  assert.ok(replyRoute.includes(">= 5"));
  assert.ok(replyRoute.includes("client_event_id = ?"));
  assert.ok(replyRoute.includes("messageLength: message.length"));
  assert.ok(replyRoute.includes("learner_teacher_reply"));
});

test("assignment status updates remain bounded, idempotent and device-bound", () => {
  assert.ok(statusRoute.includes("MAX_STATUS_EVENTS_PER_ASSIGNMENT = 24"));
  assert.ok(statusRoute.includes("verifyDeviceRequest(payload, previewRequest)"));
  assert.ok(statusRoute.includes('learner.personRole !== "learner"'));
  assert.ok(statusRoute.includes("AND device_id = ?"));
  assert.ok(statusRoute.includes("AND event_type = 'teacher_assignment'"));
  assert.ok(statusRoute.includes("client_event_id = ?"));
  assert.ok(statusRoute.includes("if (latestStatus === status)"));
  assert.ok(statusRoute.includes("learner_assignment_status"));
});

test("learner inbox stays visible-tab synchronized without duplicate signed loads", () => {
  assert.ok(inbox.includes("window.setInterval(refreshVisibleInbox, 60_000)"));
  assert.ok(inbox.includes('document.visibilityState === "visible"'));
  assert.ok(inbox.includes("if (inFlightDeviceRef.current === deviceId) return;"));
  assert.ok(inbox.includes("requestRef.current === requestId && deviceRef.current === deviceId"));
});

test("learner communication APIs remain media-free", () => {
  const communication = [inboxRoute, replyRoute, statusRoute].join("\n");
  assert.doesNotMatch(communication, /videoBlob|frameData|imageData|thumbnailBase64|data:image\//i);
});
