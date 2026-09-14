import assert from "node:assert/strict";
import test from "node:test";

import { capturePlaybackState, restorePlaybackState } from "../app/phan-tich-video/video-playback-state.mjs";

function fakeVideo(overrides = {}) {
  return {
    currentTime: 4.2,
    duration: 12,
    paused: true,
    currentSrc: "blob:clip-a",
    src: "",
    isConnected: true,
    playCalls: 0,
    async play() {
      this.playCalls += 1;
    },
    ...overrides,
  };
}

test("restores the original timestamp and keeps an originally paused video paused", async () => {
  const video = fakeVideo();
  const snapshot = capturePlaybackState(video);
  video.currentTime = 10;

  const result = await restorePlaybackState(video, snapshot, async (target, time) => {
    target.currentTime = time;
  });

  assert.equal(video.currentTime, 4.2);
  assert.equal(video.playCalls, 0);
  assert.deepEqual(result, { restored: true, resumed: false });
});

test("resumes playback only when the video was playing before analysis", async () => {
  const video = fakeVideo({ paused: false });
  const snapshot = capturePlaybackState(video);
  video.currentTime = 11;
  video.paused = true;

  const result = await restorePlaybackState(video, snapshot, async (target, time) => {
    target.currentTime = time;
  });

  assert.equal(video.currentTime, 4.2);
  assert.equal(video.playCalls, 1);
  assert.deepEqual(result, { restored: true, resumed: true });
});

test("does not seek or resume if the learner changed to a different video", async () => {
  const video = fakeVideo({ paused: false });
  const snapshot = capturePlaybackState(video);
  video.currentSrc = "blob:clip-b";
  video.currentTime = 1.5;
  let seekCalls = 0;

  const result = await restorePlaybackState(video, snapshot, async () => {
    seekCalls += 1;
  });

  assert.equal(video.currentTime, 1.5);
  assert.equal(video.playCalls, 0);
  assert.equal(seekCalls, 0);
  assert.deepEqual(result, { restored: false, resumed: false });
});

test("falls back to direct currentTime restoration when seek rejects", async () => {
  const video = fakeVideo({ currentTime: 3, duration: 5 });
  const snapshot = capturePlaybackState(video);
  video.currentTime = 4.8;

  const result = await restorePlaybackState(video, snapshot, async () => {
    throw new Error("seek failed");
  });

  assert.equal(video.currentTime, 3);
  assert.deepEqual(result, { restored: true, resumed: false });
});
