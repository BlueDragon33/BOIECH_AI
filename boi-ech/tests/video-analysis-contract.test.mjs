import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const analyzerUrl = new URL("../app/phan-tich-video/video-analyzer-impl.tsx", import.meta.url);
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
  assert.match(source, /const stored = \{ \.\.\.value, localFrames: \[\] \}/);
  assert.match(source, /Xem đúng khung hình/);
  assert.match(source, /ctx\.createLinearGradient/);
});

test("video analysis API rejects binary-looking payload fields", async () => {
  const source = await readFile(analysisRouteUrl, "utf8");
  assert.match(source, /hasForbiddenBinaryField/);
  assert.match(source, /video\|frame\|image\|base64\|blob\|dataurl\|objecturl\|thumbnail/i);
  assert.match(source, /MAX_DETAIL_BYTES = 24 \* 1024/);
  assert.match(source, /MAX_REQUEST_BYTES = 32 \* 1024/);
  assert.match(source, /request\.body\.getReader\(\)/);
  assert.match(source, /'video_ai_analysis'/);
});

test("control overview exposes only a media-free assistive analysis summary", async () => {
  const source = await readFile(overviewRouteUrl, "utf8");
  assert.match(source, /attachVideoAnalyses/);
  assert.match(source, /event_type = 'video_ai_analysis'/);
  assert.match(source, /trust: "client-attested-assistive"/);
  assert.match(source, /mediaStored: false/);
  assert.doesNotMatch(source, /videoAnalysisSummary[\s\S]*?dataUrl/);
});
