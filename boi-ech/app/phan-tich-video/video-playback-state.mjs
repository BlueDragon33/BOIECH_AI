function mediaSource(video) {
  return String(video?.currentSrc || video?.src || "");
}

function clampTime(video, seconds) {
  const duration = Number(video?.duration);
  const upper = Number.isFinite(duration) && duration > 0 ? Math.max(0, duration - 0.01) : Math.max(0, Number(seconds) || 0);
  return Math.min(Math.max(0, Number(seconds) || 0), upper);
}

export function capturePlaybackState(video) {
  return {
    currentTime: Number.isFinite(Number(video?.currentTime)) ? Number(video.currentTime) : 0,
    wasPaused: Boolean(video?.paused),
    source: mediaSource(video),
  };
}

export function canRestorePlayback(video, snapshot) {
  if (!video || !snapshot) return false;
  if (video.isConnected === false) return false;
  return mediaSource(video) === snapshot.source;
}

export async function restorePlaybackState(video, snapshot, seekTo) {
  if (!canRestorePlayback(video, snapshot)) return { restored: false, resumed: false };

  const target = clampTime(video, snapshot.currentTime);
  let restored = false;
  try {
    await seekTo(video, target);
    restored = true;
  } catch {
    try {
      video.currentTime = target;
      restored = true;
    } catch {
      restored = false;
    }
  }

  let resumed = false;
  if (!snapshot.wasPaused && canRestorePlayback(video, snapshot)) {
    try {
      await video.play();
      resumed = true;
    } catch {
      // Autoplay/device policy may reject play(); restoring the timeline must still succeed.
    }
  }

  return { restored, resumed };
}
