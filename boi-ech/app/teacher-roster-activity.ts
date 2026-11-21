/**
 * Teacher roster activity signals.
 *
 * device_access.status='approved' is authorization, never attendance.
 * device_access.last_seen_at is the most recent verified DEVICE interaction,
 * not an active web socket, foreground tab, current login or lesson event.
 * Do not infer 'online', 'offline' or 'đang học' from either field.
 */
export type RosterActivityKind = "recent" | "older" | "unknown";
export type RosterActivity = {
  kind: RosterActivityKind;
  label: string;
  explanation: string;
  recordedAt: number | null;
};

export const RECENT_DEVICE_SIGNAL_MS = 5 * 60_000;
export const SNAPSHOT_FRESH_MS = 3 * 60_000;
const MAX_CLOCK_SKEW_MS = 2 * 60_000;

/** SQLite CURRENT_TIMESTAMP is UTC but omits its timezone suffix. */
export function parseRosterUtc(value: string | null | undefined): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const utcValue = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(trimmed)
    ? trimmed.replace(" ", "T") + "Z" : trimmed;
  const parsed = Date.parse(utcValue);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Only classifies **recorded device activity**, not real-time presence.
 * A stale/failed roster sync cannot be used to assert activity "now".
 */
export function classifyRosterActivity(
  lastSeenAt: string | null | undefined,
  syncedAt: string | null | undefined,
  nowMs: number,
  syncHealthy = true,
): RosterActivity {
  const recordedAt = parseRosterUtc(lastSeenAt);
  if (recordedAt === null || recordedAt > nowMs + MAX_CLOCK_SKEW_MS) {
    return { kind: "unknown", label: "Chưa xác định",
      explanation: "Không có mốc xác minh thiết bị hợp lệ.", recordedAt: null };
  }

  const ageMs = Math.max(0, nowMs - recordedAt);
  const syncedMs = parseRosterUtc(syncedAt);
  const freshSnapshot = syncHealthy && syncedMs !== null &&
    syncedMs <= nowMs + MAX_CLOCK_SKEW_MS &&
    nowMs - syncedMs <= SNAPSHOT_FRESH_MS;

  if (freshSnapshot && ageMs <= RECENT_DEVICE_SIGNAL_MS) {
    return { kind: "recent", label: "Có tương tác gần đây",
      explanation: "Thiết bị có xác minh gần đây; chưa chứng minh đang trực tuyến hay đang học.",
      recordedAt };
  }

  return { kind: "older", label: "Chưa có tín hiệu mới",
    explanation: "Chưa có bằng chứng học viên đang trực tuyến; mốc cuối chỉ phản ánh xác minh thiết bị.",
    recordedAt };
}

export function formatRosterMoment(value: string | null | undefined): string {
  const instant = parseRosterUtc(value);
  if (instant === null) return "Chưa ghi nhận";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
    year: "numeric", hour12: false,
  }).format(instant);
}
