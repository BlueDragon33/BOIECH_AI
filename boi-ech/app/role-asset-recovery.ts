"use client";

/**
 * Deployment-safe recovery for a versioned lazy role chunk disappearing while
 * an already-open page survives a Worker/asset release. This is NOT an auth
 * retry, does not alter account cookies, device keys, IDB or local progress.
 */
const RETRY_KEY = "boi-ech:role-asset-recovery:v1";
const RECOVERY_WINDOW_MS = 3 * 60_000;
const ASSET_REFRESH_PARAM = "boi_asset_refresh";

export function isRoleChunkLoadFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message || "";
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk [\w-]+ failed|Failed to load module script/i.test(message)
    || /(?:\/assets\/|learner-enhancements|teacher-enhancements)[^\s]*\.js/i.test(message)
       && /failed|fetch|load|404|network/i.test(message);
}

export function roleChunkFailureMessage(error: unknown): string {
  if (!isRoleChunkLoadFailure(error)) return error instanceof Error
    ? error.message : "Không tải được không gian học tập. Vui lòng thử lại.";
  return "Phiên và quyền truy cập đã được xác nhận, nhưng phiên bản giao diện đang mở không còn khớp bản máy chủ. Hãy chọn Tải bản ứng dụng mới. Hệ thống không xóa tài khoản, khóa thiết bị hay tiến độ học.";
}

function reloadWithFreshDocument(): boolean {
  if (typeof window === "undefined" || !navigator.onLine) return false;
  try {
    // Updating a registered SW is best-effort. No unregister, storage deletion,
    // cookie reset or account mutation: progress/media caches remain intact.
    void navigator.serviceWorker?.getRegistration().then(r => r?.update()).catch(() => undefined);
    const url = new URL(window.location.href);
    url.searchParams.set(ASSET_REFRESH_PARAM, String(Date.now()));
    window.location.replace(url.pathname + url.search + url.hash);
    return true;
  } catch {
    return false;
  }
}

/** Auto-reload at most once per tab in a short window; no infinite reload loop. */
export function recoverRoleChunkOnce(error: unknown): boolean {
  if (!isRoleChunkLoadFailure(error) || typeof window === "undefined" || !navigator.onLine) return false;
  try {
    const now = Date.now();
    const last = Number(window.sessionStorage.getItem(RETRY_KEY) || "0");
    if (Number.isFinite(last) && now - last >= 0 && now - last < RECOVERY_WINDOW_MS) return false;
    window.sessionStorage.setItem(RETRY_KEY, String(now));
    if (reloadWithFreshDocument()) return true;
    window.sessionStorage.removeItem(RETRY_KEY);
  } catch { /* Restricted session storage: fail closed, expose manual refresh. */ }
  return false;
}

/** Explicit click by the user can retry even if the automatic attempt failed. */
export function refreshRoleAssetsManually(): boolean {
  return reloadWithFreshDocument();
}

/** Clear only the ephemeral reload guard when this role bundle loads correctly. */
export function roleChunkReady(): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(RETRY_KEY); } catch { /* no storage required */ }
}
