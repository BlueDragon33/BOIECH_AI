import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const analyzerUrl = new URL("../app/phan-tich-video/video-analyzer-impl.tsx", import.meta.url);
const analyzerComposerUrl = new URL("../app/phan-tich-video/video-analyzer.tsx", import.meta.url);
const phaseAnalyzerUrl = new URL("../app/phan-tich-video/phase-cycle-analyzer.tsx", import.meta.url);
const phaseCoreUrl = new URL("../app/phan-tich-video/phase-cycle-core.mjs", import.meta.url);
const analysisPageUrl = new URL("../app/phan-tich-video/page.tsx", import.meta.url);
const consentUrl = new URL("../app/phan-tich-video/privacy-consent.tsx", import.meta.url);
const analysisRouteUrl = new URL("../app/api/video-analysis/route.ts", import.meta.url);
const overviewRouteUrl = new URL("../app/api/control/overview/route.ts", import.meta.url);

test("video AI keeps original media on the learner device", async () => {
  const source = await readFile(analyzerUrl, "utf8");
  assert.match(source, /const MAX_VIDEO_BYTES = 50 \* 1024 \* 1024/);
  assert.match(source, /const MAX_VIDEO_SECONDS = 30/);
  assert.match(source, /URL\.createObjectURL\(next\)/);
  assert.doesNotMatch(source, /body:\s*(?:file|next|objectUrl)/);
  assert.match(source, /analysis:\s*serverPayload\(analysis\)/);
  assert.match(source, /const MAX_LOCAL_ANALYSES = 10/);
  assert.match(source, /const MAX_ERROR_FRAMES = 4/);
  assert.match(source, /function assessCaptureQuality/);
  assert.match(source, /captureQuality\.level === "retry"/);
  assert.match(source, /Chưa chấm điểm vì chất lượng nhận diện chưa đủ/);
  assert.match(source, /const stored = \{ \.\.\.value, localFrames: \[\] \}/);
  assert.match(source, /Xem đúng khung hình/);
  assert.match(source, /ctx\.createLinearGradient/);
});

test("MediaPipe cannot start before informed telemetry consent", async () => {
  const [page, consent] = await Promise.all([
    readFile(analysisPageUrl, "utf8"),
    readFile(consentUrl, "utf8"),
  ]);
  assert.match(page, /<MediaPipeConsentGate>/);
  assert.match(page, /<VideoAnalyzer lessonNumber="03" \/>/);
  assert.match(consent, /boi-ech-mediapipe-metrics-consent-v1/);
  assert.match(consent, /MediaPipe Tasks có thể gửi số liệu/);
  assert.match(consent, /Video, ảnh khung hình và pose landmarks/);
  assert.match(consent, /Đồng ý và mở AI video/);
  assert.match(consent, /Thu hồi/);
  assert.match(consent, /removeItem\(CONSENT_KEY\)/);
});

test("experimental v2 recognizes a local five-phase breaststroke cycle without changing v1 scoring", async () => {
  const [composer, phase, core] = await Promise.all([
    readFile(analyzerComposerUrl, "utf8"),
    readFile(phaseAnalyzerUrl, "utf8"),
    readFile(phaseCoreUrl, "utf8"),
  ]);
  assert.match(composer, /data-breaststroke-vision/);
  assert.match(composer, /<VideoAnalyzerImpl lessonNumber=\{lessonNumber\} \/>/);
  assert.match(composer, /<PhaseCycleAnalyzer \/>/);
  assert.match(phase, /type StrokePhase = "pull" \| "breath" \| "leg-recovery" \| "kick" \| "glide" \| "unclear"/);
  assert.match(phase, /from "\.\/phase-cycle-core\.mjs"/);
  assert.match(core, /const EXPECTED_PHASES = \["pull", "breath", "leg-recovery", "kick", "glide"\]/);
  assert.match(phase, /phaseMetrics/);
  assert.match(phase, /analyzePhaseSequence/);
  assert.match(core, /completeCycles/);
  assert.match(core, /orderScore/);
  assert.match(phase, /Engine này chưa tham gia điểm chính/);
  assert.match(phase, /document\.querySelector<HTMLVideoElement>\("\[data-breaststroke-vision\] video\[playsinline\]"\)/);
  assert.doesNotMatch(phase, /\/api\/video-analysis/);
  assert.doesNotMatch(core, /\/api\/video-analysis/);
});

test("video analysis API rejects binary-looking payload fields", async () => {
  const source = await readFile(analysisRouteUrl, "utf8");
  assert.match(source, /hasForbiddenBinaryField/);
  assert.match(source, /video\|frame\|image\|base64\|blob\|dataurl\|objecturl\|thumbnail/i);
  assert.match(source, /MAX_DETAIL_BYTES = 24 \* 1024/);
  assert.match(source, /MAX_REQUEST_BYTES = 32 \* 1024/);
  assert.match(source, /request\.body\.getReader\(\)/);
  assert.match(source, /SAFE_FRAME_COUNT_FIELDS/);
  assert.match(source, /"sampledframes", "detectedframes"/);
  assert.match(source, /captureQuality:/);
  assert.match(source, /'video_ai_analysis'/);
});

test("control overview exposes only a media-free assistive analysis summary", async () => {
  const source = await readFile(overviewRouteUrl, "utf8");
  assert.match(source, /attachVideoAnalyses/);
  assert.match(source, /event_type = 'video_ai_analysis'/);
  assert.match(source, /trust: "client-attested-assistive"/);
  assert.match(source, /mediaStored: false/);
  assert.match(source, /captureQuality:/);
  assert.doesNotMatch(source, /videoAnalysisSummary[\s\S]*?dataUrl/);
});
