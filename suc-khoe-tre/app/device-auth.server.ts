export type SiteDeviceStatus = "pending" | "approved" | "blocked";
export type SiteDeviceType = "desktop" | "phone" | "tablet";

export type SiteDeviceState = {
  deviceId: string;
  deviceCode: string;
  status: SiteDeviceStatus;
  deviceType: SiteDeviceType;
  platform: string | null;
  browser: string | null;
  label: string | null;
  editEnabled: boolean;
};

type SiteDeviceRow = {
  device_id: string;
  display_code: string;
  public_key_jwk: string;
  status: SiteDeviceStatus;
  device_type: SiteDeviceType;
  platform: string | null;
  browser: string | null;
  user_agent: string | null;
  screen_width: number | null;
  screen_height: number | null;
  label: string | null;
  edit_enabled: number;
  created_at: string;
  approved_at: string | null;
  blocked_at: string | null;
  last_seen_at: string;
  last_activity_at: string;
};

export class DeviceAccessError extends Error {
  status: number;
  code: string;
  device?: SiteDeviceState;
  constructor(message: string, status: number, code: string, device?: SiteDeviceState) {
    super(message);
    this.status = status;
    this.code = code;
    this.device = device;
  }
}

export async function getCourseDatabase() {
  const workers = await import("cloudflare:workers");
  if (!workers.env.DB) throw new DeviceAccessError("Cơ sở dữ liệu Sức khỏe trẻ chưa sẵn sàng.", 503, "HEALTH_DATABASE_UNAVAILABLE");
  return workers.env.DB;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 256) {
    throw new DeviceAccessError("Chữ ký thiết bị không hợp lệ.", 400, "INVALID_DEVICE_SIGNATURE");
  }
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try { return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)); }
  catch { throw new DeviceAccessError("Chữ ký thiết bị không hợp lệ.", 400, "INVALID_DEVICE_SIGNATURE"); }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function publicKeyShape(value: unknown): JsonWebKey {
  if (!value || typeof value !== "object") throw new DeviceAccessError("Khóa thiết bị không hợp lệ.", 400, "INVALID_DEVICE_KEY");
  const source = value as Record<string, unknown>;
  const x = typeof source.x === "string" ? source.x : "";
  const y = typeof source.y === "string" ? source.y : "";
  if (source.kty !== "EC" || source.crv !== "P-256" || !/^[A-Za-z0-9_-]{42,44}$/.test(x) || !/^[A-Za-z0-9_-]{42,44}$/.test(y)) {
    throw new DeviceAccessError("Khóa thiết bị không hợp lệ.", 400, "INVALID_DEVICE_KEY");
  }
  return { kty: "EC", crv: "P-256", x, y, ext: true, key_ops: ["verify"] };
}

function canonicalKey(value: JsonWebKey) {
  return JSON.stringify({ kty: value.kty, crv: value.crv, x: value.x, y: value.y });
}

function displayCodeFor(deviceId: string) {
  return `SK-${deviceId.slice(0, 4)}-${deviceId.slice(4, 8)}-${deviceId.slice(8, 12)}-${deviceId.slice(12, 16)}`.toUpperCase();
}

function cleanText(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function classifyDevice(metadata: Record<string, unknown>): SiteDeviceType {
  const ua = cleanText(metadata.userAgent, 500).toLowerCase();
  const platform = cleanText(metadata.platform, 80).toLowerCase();
  const mobileHint = metadata.mobile === true;
  const touchPoints = Math.max(0, Math.min(20, Number(metadata.maxTouchPoints) || 0));
  const ipad = ua.includes("ipad") || (platform.includes("mac") && touchPoints > 1);
  if (ipad || ua.includes("tablet") || (ua.includes("android") && !ua.includes("mobile"))) return "tablet";
  if (mobileHint || ua.includes("iphone") || ua.includes("ipod") || ua.includes("mobile") || /android.+mobile/.test(ua)) return "phone";
  return "desktop";
}

function detectBrowser(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("crios/") || ua.includes("chrome/")) return "Chrome";
  if (ua.includes("fxios/") || ua.includes("firefox/")) return "Firefox";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  return "Khác";
}

function state(row: SiteDeviceRow): SiteDeviceState {
  return {
    deviceId: row.device_id,
    deviceCode: row.display_code,
    status: row.status,
    deviceType: row.device_type,
    platform: row.platform,
    browser: row.browser,
    label: row.label,
    editEnabled: row.edit_enabled === 1,
  };
}

async function rowFor(deviceId: string) {
  const database = await getCourseDatabase();
  return database.prepare(
    `SELECT device_id, display_code, public_key_jwk, status, device_type, platform, browser,
            user_agent, screen_width, screen_height, label, edit_enabled, created_at,
            approved_at, blocked_at, last_seen_at, last_activity_at
       FROM site_access_devices WHERE device_id = ?`,
  ).bind(deviceId).first<SiteDeviceRow>();
}

export async function registerSiteDevice(publicKey: unknown, metadataValue: unknown, autoApprove = false) {
  const key = publicKeyShape(publicKey);
  const serialized = canonicalKey(key);
  const deviceId = await sha256(serialized);
  const metadata = metadataValue && typeof metadataValue === "object" ? metadataValue as Record<string, unknown> : {};
  const userAgent = cleanText(metadata.userAgent, 500);
  const platform = cleanText(metadata.platform, 80) || null;
  const browser = detectBrowser(userAgent);
  const deviceType = classifyDevice(metadata);
  const screenWidth = Math.max(0, Math.min(10000, Math.round(Number(metadata.screenWidth) || 0))) || null;
  const screenHeight = Math.max(0, Math.min(10000, Math.round(Number(metadata.screenHeight) || 0))) || null;
  const database = await getCourseDatabase();
  const existing = await rowFor(deviceId);
  if (existing) {
    await database.prepare(
      `UPDATE site_access_devices SET device_type = ?, platform = ?, browser = ?, user_agent = ?,
              screen_width = ?, screen_height = ?, last_seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE device_id = ?`,
    ).bind(deviceType, platform, browser, userAgent || null, screenWidth, screenHeight, deviceId).run();
    const updated = await rowFor(deviceId);
    return state(updated ?? existing);
  }
  const status: SiteDeviceStatus = autoApprove ? "approved" : "pending";
  await database.prepare(
    `INSERT INTO site_access_devices
      (device_id, display_code, public_key_jwk, status, device_type, platform, browser, user_agent,
       screen_width, screen_height, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${autoApprove ? "CURRENT_TIMESTAMP" : "NULL"})`,
  ).bind(deviceId, displayCodeFor(deviceId), serialized, status, deviceType, platform, browser, userAgent || null, screenWidth, screenHeight).run();
  const created = await rowFor(deviceId);
  if (!created) throw new DeviceAccessError("Không thể đăng ký thiết bị Sức khỏe trẻ.", 500, "DEVICE_CREATE_FAILED");
  return state(created);
}

export async function createSiteDeviceChallenge(deviceIdValue: unknown) {
  const deviceId = typeof deviceIdValue === "string" ? deviceIdValue : "";
  if (!/^[a-f0-9]{64}$/.test(deviceId)) throw new DeviceAccessError("Mã thiết bị không hợp lệ.", 400, "INVALID_DEVICE");
  const row = await rowFor(deviceId);
  if (!row) throw new DeviceAccessError("Không tìm thấy thiết bị.", 404, "DEVICE_NOT_FOUND");
  const nonce = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = Date.now() + 2 * 60 * 1000;
  const database = await getCourseDatabase();
  await database.batch([
    database.prepare("DELETE FROM site_access_challenges WHERE expires_at < ?").bind(Date.now()),
    database.prepare("DELETE FROM site_access_challenges WHERE device_id = ?").bind(deviceId),
    database.prepare("INSERT INTO site_access_challenges (nonce, device_id, expires_at) VALUES (?, ?, ?)").bind(nonce, deviceId, expiresAt),
  ]);
  return { challenge: nonce, expiresAt, device: state(row) };
}

export async function verifySiteDeviceProof(payload: Record<string, unknown>, previewRequest = false) {
  const deviceId = typeof payload.deviceId === "string" ? payload.deviceId : "";
  const challenge = typeof payload.challenge === "string" ? payload.challenge : "";
  const signature = typeof payload.signature === "string" ? payload.signature : "";
  if (!/^[a-f0-9]{64}$/.test(deviceId) || !/^[A-Za-z0-9_-]{40,100}$/.test(challenge)) {
    throw new DeviceAccessError("Bằng chứng thiết bị không hợp lệ.", 400, "INVALID_DEVICE_PROOF");
  }
  const row = await rowFor(deviceId);
  if (!row) throw new DeviceAccessError("Thiết bị chưa được đăng ký.", 404, "DEVICE_NOT_FOUND");
  if (!previewRequest && row.status !== "approved") {
    const current = state(row);
    throw new DeviceAccessError(row.status === "blocked" ? "Thiết bị này đã bị khóa." : "Thiết bị đang chờ Trung tâm cấp quyền.", 403, row.status === "blocked" ? "DEVICE_BLOCKED" : "DEVICE_PENDING", current);
  }
  const database = await getCourseDatabase();
  const proof = await database.prepare(
    "SELECT expires_at FROM site_access_challenges WHERE nonce = ? AND device_id = ?",
  ).bind(challenge, deviceId).first<{ expires_at: number }>();
  await database.prepare("DELETE FROM site_access_challenges WHERE nonce = ? AND device_id = ?").bind(challenge, deviceId).run();
  if (!proof || proof.expires_at < Date.now()) throw new DeviceAccessError("Phiên xác thực thiết bị đã hết hạn.", 401, "DEVICE_PROOF_EXPIRED", state(row));
  const key = await crypto.subtle.importKey("jwk", publicKeyShape(JSON.parse(row.public_key_jwk)), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const message = new TextEncoder().encode(`child-health-device:${deviceId}:${challenge}`);
  const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, fromBase64Url(signature), message);
  if (!valid) throw new DeviceAccessError("Thiết bị không khớp khóa truy cập.", 403, "DEVICE_MISMATCH", state(row));
  await database.prepare(
    "UPDATE site_access_devices SET last_seen_at = CURRENT_TIMESTAMP, last_activity_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?",
  ).bind(deviceId).run();
  return state(row);
}

export function deviceErrorResponse(error: unknown) {
  if (error instanceof DeviceAccessError) {
    return Response.json({ error: error.message, code: error.code, device: error.device }, { status: error.status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
  }
  return Response.json({ error: "Dịch vụ Sức khỏe trẻ đang tạm gián đoạn.", code: "HEALTH_SERVICE_ERROR" }, { status: 500, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
}
