import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const analytics = fs.readFileSync(new URL("../app/teacher-learning-analytics.server.ts", import.meta.url), "utf8");
const analyticsUi = fs.readFileSync(new URL("../app/teacher-learning-analytics.tsx", import.meta.url), "utf8");
const teacherApi = fs.readFileSync(new URL("../app/api/teacher/overview/route.ts", import.meta.url), "utf8");
const teacherShell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/teacher-learning-analytics-l7.css", import.meta.url), "utf8");

test("L7 builds before-intervention-after analytics from bounded learning events", () => {
  assert.match(analytics, /teacher_feedback/);
  assert.match(analytics, /teacher_assignment/);
  assert.match(analytics, /teacher_analysis_review/);
  assert.match(analytics, /quiz_submit/);
  assert.match(analytics, /video_ai_analysis/);
  assert.match(analytics, /30 \* 86_400_000/);
  assert.match(analytics, /14 \* 86_400_000/);
  assert.match(analytics, /beforeQuiz/);
  assert.match(analytics, /afterQuiz/);
  assert.match(analytics, /beforeVideo/);
  assert.match(analytics, /afterVideo/);
});

test("L7 does not treat weak video evidence as a score-change signal", () => {
  assert.match(analytics, /confidence >= 70 && quality\.level === "good"/);
  assert.match(analytics, /!after\.usable \|\| !before\.usable/);
  assert.match(analytics, /không khẳng định quan hệ nhân quả/);
  assert.doesNotMatch(analytics, /videoBlob|frameData|imageData|thumbnail|base64/);
});

test("teacher overview scopes analytics to approved learners in the signed teacher class", () => {
  assert.match(teacherApi, /verifyDeviceRequest\(payload, previewRequest\)/);
  assert.match(teacherApi, /teacher\.personRole !== "teacher"/);
  assert.match(teacherApi, /JOIN device_access da ON da\.device_id = e\.device_id/);
  assert.match(teacherApi, /da\.person_role = 'learner'/);
  assert.match(teacherApi, /da\.status = 'approved'/);
  assert.match(teacherApi, /lower\(trim\(da\.class_name\)\) = lower\(trim\(\?\)\)/);
  assert.match(teacherApi, /buildLearningAnalytics/);
  assert.match(teacherApi, /learningAnalytics/);
});

test("L7 teacher UI shows temporal evidence without claiming causality", () => {
  assert.match(analyticsUi, /Trước → can thiệp → sau/);
  assert.match(analyticsUi, /không tự chứng minh can thiệp là nguyên nhân/);
  assert.match(analyticsUi, /Kiểm tra/);
  assert.match(analyticsUi, /Video AI/);
  assert.match(analyticsUi, /Hoạt động sau can thiệp/);
  assert.match(teacherShell, /TeacherLearningAnalyticsPanel/);
  assert.match(teacherShell, /learningAnalytics\.latest/);
  assert.match(teacherShell, /Không suy diễn quan hệ nhân quả/);
});

test("L7 extends reports and CSV while leaving official scoring and media boundaries untouched", () => {
  assert.match(teacherShell, /Thay đổi quan sát/);
  assert.match(teacherShell, /Δ kiểm tra/);
  assert.match(teacherShell, /Δ video AI/);
  assert.doesNotMatch(analytics, /UPDATE device_profiles|scores_json\s*=|PHASE_THRESHOLDS|qualityScore/);
  assert.doesNotMatch(analyticsUi, /fetch\(|localStorage|sessionStorage/);
});

test("L7 styles load after the V8 visual layer and remain responsive", () => {
  const v8 = layout.indexOf('import "./teacher-dashboard-visual-v8.css"');
  const l7 = layout.indexOf('import "./teacher-learning-analytics-l7.css"');
  assert.ok(v8 >= 0);
  assert.ok(l7 > v8);
  assert.match(css, /\.teacher-learning-analytics/);
  assert.match(css, /\.teacher-loop-evidence-grid/);
  assert.match(css, /@media \(max-width: 760px\)/);
});
