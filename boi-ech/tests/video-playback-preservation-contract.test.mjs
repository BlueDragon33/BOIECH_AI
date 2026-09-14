import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const analyzerUrl = new URL("../app/phan-tich-video/phase-cycle-analyzer.tsx", import.meta.url);
const helperUrl = new URL("../app/phan-tich-video/video-playback-state.mjs", import.meta.url);

test("phase analysis snapshots, pauses and restores the same learner video", async () => {
  const analyzer = await readFile(analyzerUrl, "utf8");

  assert.match(analyzer, /capturePlaybackState\(video\)/);
  assert.match(analyzer, /video\.pause\(\)/);
  assert.match(analyzer, /finally\s*\{[\s\S]*restorePlaybackState\(video, playbackState, seek\)/);
  assert.match(analyzer, /Math\.abs\(video\.currentTime - target\) < 0\.001/);
  assert.match(analyzer, /removeEventListener\("seeked", done\)/);
});

test("playback restoration is source-aware, local-only and tolerant of autoplay rejection", async () => {
  const helper = await readFile(helperUrl, "utf8");

  assert.match(helper, /mediaSource\(video\) === snapshot\.source/);
  assert.match(helper, /!snapshot\.wasPaused/);
  assert.match(helper, /await video\.play\(\)/);
  assert.doesNotMatch(helper, /fetch\(|localStorage|indexedDB|\/api\//i);
});
