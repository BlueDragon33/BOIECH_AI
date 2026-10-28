const activeRuns = new Set();
const videoOwners = new WeakMap();

function abortError() {
  return new DOMException("Đã dừng phân tích video.", "AbortError");
}

export function cancelVideoAnalysisRuns() {
  for (const run of [...activeRuns]) run.cancel();
}

export function createVideoAnalysisRun(video) {
  if (video) videoOwners.get(video)?.cancel();
  const controller = new AbortController();
  const source = video?.currentSrc || video?.src || "";
  const cleanups = new Set();
  let finished = false;

  function finish() {
    if (finished) return;
    finished = true;
    activeRuns.delete(run);
    if (video && videoOwners.get(video) === run) videoOwners.delete(video);
    for (const cleanup of cleanups) {
      try { cleanup(); } catch { /* one failed cleanup must not retain the rest */ }
    }
    cleanups.clear();
  }

  const run = {
    signal: controller.signal,
    check() {
      if (finished || (video && (!video.isConnected || (video.currentSrc || video.src || "") !== source))) run.cancel();
      controller.signal.throwIfAborted();
    },
    async acquire(promise) {
      const resource = await promise;
      if (finished || controller.signal.aborted) {
        resource.dispose();
        throw abortError();
      }
      cleanups.add(() => resource.dispose());
      run.check();
      return resource;
    },
    cancel() {
      controller.abort();
      finish();
    },
    finish,
  };
  activeRuns.add(run);
  if (video) videoOwners.set(video, run);
  return run;
}

export function seekVideoFrame(video, seconds, signal) {
  if (signal?.aborted) return Promise.reject(abortError());
  const target = Math.min(Math.max(0, seconds), Math.max(0, video.duration - 0.01));
  if (!video.seeking && Math.abs(video.currentTime - target) < 0.001) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", failed);
      signal?.removeEventListener("abort", aborted);
    };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("Không đọc được khung hình video.")); };
    const aborted = () => { cleanup(); reject(abortError()); };
    const timer = window.setTimeout(failed, 5000);
    video.addEventListener("seeked", done, { once: true });
    video.addEventListener("error", failed, { once: true });
    signal?.addEventListener("abort", aborted, { once: true });
    try { video.currentTime = target; } catch (error) { cleanup(); reject(error); }
  });
}
