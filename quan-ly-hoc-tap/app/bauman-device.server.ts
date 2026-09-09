import { getControlDatabase } from "./control-device.server";

export type BaumanDeviceStatus = "pending" | "approved" | "blocked";

export type BaumanDeviceState = {
  deviceId: string;
  deviceCode: string;
  status: BaumanDeviceStatus;
  label: string | null;
  platform: string | null;
  browser: string | null;
  language: string | null;
  timezone: string | null;
  screen: string | null;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  blockedAt: string | null;
  blockedBy: string | null;
  lastSeenAt: string;
  active: boolean;
};

type BaumanDeviceRow = {
  device_id: string;
  display_code: string;
  public_key_jwk: string;
  status: BaumanDeviceStatus;
  label: string | null;
  platform: string | null;
  browser: string | null;
  language: string | null;
  timezone: string | null;
  screen: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  blocked_at: string | null;
  blocked_by: string | null;
  last_seen_at: string;
};

export type BaumanAuditEntry = {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

export class BaumanDeviceError extends Error {
  status: number;
  code: string;
  device?: BaumanDeviceState;

  constructor(message: string, status: number, code: string, device?: BaumanDeviceState) {
    super(message);
    this.status = status;
    this.code = code;
    this.device = device;
  }
}

const ACTIVE_TIMEOUT_MS = 180_000;

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 256) {
    throw new BaumanDeviceError("Chữ ký thiết bị không hợp lệ.", 400, "INVALID_SIGNATURE");
  }
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    throw new BaumanDeviceError("Chữ ký thiết bị không hợp lệ.", 400, "INVALID_SIGNATURE");
  }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function publicKeyShape(value: unknown): JsonWebKey {
  if (!value || typeof value !== "object") {
    throw new BaumanDeviceError("Khóa thiết bị Bauman không hợp lệ.", 400, "INVALID_DEVICE_KEY");
  }
  const source = value as Record<string, unknown>;
  const x = typeof source.x === "string" ? source.x : "";
  const y = typeof source.y === "string" ? source.y : "";
  if (source.kty !== "EC" || source.crv !== "P-256" || !/^[A-Za-z0-9_-]{42,44}$/.test(x) || !/^[A-Za-z0-9_-]{42,44}$/.test(y)) {
    throw new BaumanDeviceError("Khóa thiết bị Bauman không hợp lệ.", 400, "INVALID_DEVICE_KEY");
  }
  return { kty: "EC", crv: "P-256", x, y, ext: true, key_ops: ["verify"] };
}

function canonicalKey(value: JsonWebKey) {
  return JSON.stringify({ kty: value.kty, crv: value.crv, x: value.x, y: value.y });
}

function displayCodeFor(deviceId: string) {
  return `BM-${deviceId.slice(0, 4)}-${deviceId.slice(4, 8)}-${deviceId.slice(8, 12)}-${deviceId.slice(12, 16)}`.toUpperCase();
}

function state(row: BaumanDeviceRow): BaumanDeviceState {
  const seenAt = Date.parse(row.last_seen_at);
  return {
    deviceId: row.device_id,
    deviceCode: row.display_code,
    status: row.status,
    label: row.label,
    platform: row.platform,
    browser: row.browser,
    language: row.language,
    timezone: row.timezone,
    screen: row.screen,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    blockedAt: row.blocked_at,
    blockedBy: row.blocked_by,
    lastSeenAt: row.last_seen_at,
    active: row.status === "approved" && Number.isFinite(seenAt) && Date.now() - seenAt <= ACTIVE_TIMEOUT_MS,
  };
}

async function rowFor(deviceId: string) {
  const database = await getControlDatabase();
  return database.prepare(
    `SELECT device_id, display_code, public_key_jwk, status, label, platform, browser,
            language, timezone, screen, created_at, approved_at, approved_by,
            blocked_at, blocked_by, last_seen_at
       FROM bauman_devices WHERE device_id = ?`,
  ).bind(deviceId).first<BaumanDeviceRow>();
}

function cleanText(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) || null : null;
}

async function audit(actor: string, action: string, target: string, detail: Record<string, unknown> = {}) {
  const database = await getControlDatabase();
  await database.prepare(
    "INSERT INTO bauman_audit_log (actor, action, target, detail_json) VALUES (?, ?, ?, ?)",
  ).bind(actor.slice(0, 180), action.slice(0, 80), target.slice(0, 180), JSON.stringify(detail)).run();
}

export async function registerBaumanDevice(publicKey: unknown, metadata: Record<string, unknown> = {}) {
  const key = publicKeyShape(publicKey);
  const serialized = canonicalKey(key);
  const deviceId = await sha256(serialized);
  const database = await getControlDatabase();
  const existing = await rowFor(deviceId);
  const platform = cleanText(metadata.platform);
  const browser = cleanText(metadata.browser);
  const language = cleanText(metadata.language, 40);
  const timezone = cleanText(metadata.timezone, 80);
  const screen = cleanText(metadata.screen, 40);

  if (existing) {
    await database.prepare(
      `UPDATE bauman_devices SET platform = COALESCE(?, platform), browser = COALESCE(?, browser),
              language = COALESCE(?, language), timezone = COALESCE(?, timezone),
              screen = COALESCE(?, screen), last_seen_at = CURRENT_TIMESTAMP
        WHERE device_id = ?`,
    ).bind(platform, browser, language, timezone, screen, deviceId).run();
    const updated = await rowFor(deviceId);
    if (!updated) throw new BaumanDeviceError("Không thể đọc lại thiết bị Bauman.", 500, "DEVICE_READ_FAILED");
    return state(updated);
  }

  await database.prepare(
    `INSERT INTO bauman_devices
      (device_id, display_code, public_key_jwk, status, platform, browser, language, timezone, screen)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
  ).bind(deviceId, displayCodeFor(deviceId), serialized, platform, browser, language, timezone, screen).run();
  await audit("bauman-runtime", "device_registered", deviceId, { deviceCode: displayCodeFor(deviceId), platform, browser });
  const created = await rowFor(deviceId);
  if (!created) throw new BaumanDeviceError("Không thể tạo hồ sơ thiết bị Bauman.", 500, "DEVICE_CREATE_FAILED");
  return state(created);
}

export async function createBaumanChallenge(deviceId: unknown) {
  if (typeof deviceId !== "string" || !/^[a-f0-9]{64}$/.test(deviceId)) {
    throw new BaumanDeviceError("Mã thiết bị Bauman không hợp lệ.", 400, "INVALID_DEVICE");
  }
  const row = await rowFor(deviceId);
  if (!row) throw new BaumanDeviceError("Thiết bị Bauman chưa đăng ký.", 404, "DEVICE_NOT_FOUND");
  const publicState = state(row);
  if (row.status !== "approved") {
    throw new BaumanDeviceError(
      row.status === "blocked" ? "Thiết bị Bauman đã bị từ chối hoặc khóa." : "Thiết bị Bauman đang chờ duyệt.",
      403,
      row.status === "blocked" ? "DEVICE_BLOCKED" : "DEVICE_PENDING",
      publicState,
    );
  }

  const nonce = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = Date.now() + 2 * 60 * 1000;
  const database = await getControlDatabase();
  await database.batch([
    database.prepare("DELETE FROM bauman_challenges WHERE expires_at < ?").bind(Date.now()),
    database.prepare("INSERT INTO bauman_challenges (nonce, device_id, expires_at) VALUES (?, ?, ?)").bind(nonce, deviceId, expiresAt),
    database.prepare(
      `DELETE FROM bauman_challenges
        WHERE device_id = ? AND nonce NOT IN (
          SELECT nonce FROM bauman_challenges WHERE device_id = ? ORDER BY rowid DESC LIMIT 8
        )`,
    ).bind(deviceId, deviceId),
  ]);
  return { challenge: nonce, expiresAt, device: publicState };
}

export async function verifyBaumanProof(payload: Record<string, unknown>) {
  const deviceId = typeof payload.deviceId === "string" ? payload.deviceId : "";
  const challenge = typeof payload.challenge === "string" ? payload.challenge : "";
  const signature = typeof payload.signature === "string" ? payload.signature : "";
  if (!/^[a-f0-9]{64}$/.test(deviceId) || !/^[A-Za-z0-9_-]{40,100}$/.test(challenge)) {
    throw new BaumanDeviceError("Bằng chứng thiết bị Bauman không hợp lệ.", 400, "INVALID_DEVICE_PROOF");
  }
  const row = await rowFor(deviceId);
  if (!row) throw new BaumanDeviceError("Thiết bị Bauman chưa đăng ký.", 404, "DEVICE_NOT_FOUND");
  const publicState = state(row);
  if (row.status !== "approved") {
    throw new BaumanDeviceError(
      row.status === "blocked" ? "Thiết bị Bauman đã bị từ chối hoặc khóa." : "Thiết bị Bauman đang chờ duyệt.",
      403,
      row.status === "blocked" ? "DEVICE_BLOCKED" : "DEVICE_PENDING",
      publicState,
    );
  }

  const database = await getControlDatabase();
  const proof = await database.prepare(
    "SELECT expires_at FROM bauman_challenges WHERE nonce = ? AND device_id = ?",
  ).bind(challenge, deviceId).first<{ expires_at: number }>();
  await database.prepare("DELETE FROM bauman_challenges WHERE nonce = ? AND device_id = ?").bind(challenge, deviceId).run();
  if (!proof || proof.expires_at < Date.now()) {
    throw new BaumanDeviceError("Phiên xác thực thiết bị Bauman đã hết hạn.", 401, "DEVICE_PROOF_EXPIRED");
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    publicKeyShape(JSON.parse(row.public_key_jwk)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const message = new TextEncoder().encode(`bauman-runtime:${deviceId}:${challenge}`);
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    fromBase64Url(signature),
    message,
  );
  if (!valid) throw new BaumanDeviceError("Thiết bị không khớp quyền Bauman đã cấp.", 403, "DEVICE_MISMATCH", publicState);

  await database.prepare("UPDATE bauman_devices SET last_seen_at = CURRENT_TIMESTAMP WHERE device_id = ?").bind(deviceId).run();
  const updated = await rowFor(deviceId);
  if (!updated) throw new BaumanDeviceError("Không thể đọc trạng thái thiết bị Bauman.", 500, "DEVICE_READ_FAILED");
  return state(updated);
}

export async function listBaumanDevices() {
  const database = await getControlDatabase();
  const result = await database.prepare(
    `SELECT device_id, display_code, public_key_jwk, status, label, platform, browser,
            language, timezone, screen, created_at, approved_at, approved_by,
            blocked_at, blocked_by, last_seen_at
       FROM bauman_devices
      ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
               last_seen_at DESC LIMIT 300`,
  ).all<BaumanDeviceRow>();
  return result.results.map(state);
}

export async function baumanDeviceCounts() {
  const devices = await listBaumanDevices();
  return {
    total: devices.length,
    pending: devices.filter((item) => item.status === "pending").length,
    approved: devices.filter((item) => item.status === "approved").length,
    blocked: devices.filter((item) => item.status === "blocked").length,
    active: devices.filter((item) => item.active).length,
  };
}

export async function listBaumanAudit(): Promise<BaumanAuditEntry[]> {
  const database = await getControlDatabase();
  const result = await database.prepare(
    "SELECT id, actor, action, target, detail_json, created_at FROM bauman_audit_log ORDER BY id DESC LIMIT 150",
  ).all<{ id: number; actor: string; action: string; target: string; detail_json: string; created_at: string }>();
  return result.results.map((row) => {
    let detail: Record<string, unknown> = {};
    try { detail = JSON.parse(row.detail_json) as Record<string, unknown>; } catch { detail = {}; }
    return { id: `bauman-${row.id}`, actor: row.actor, action: row.action, target: row.target, detail, createdAt: row.created_at };
  });
}

export async function manageBaumanDevice(
  actor: string,
  operation: "approve" | "block" | "reopen" | "label",
  deviceId: string,
  label?: string | null,
) {
  if (!/^[a-f0-9]{64}$/.test(deviceId)) {
    throw new BaumanDeviceError("Thiết bị Bauman không hợp lệ.", 400, "INVALID_DEVICE");
  }
  const row = await rowFor(deviceId);
  if (!row) throw new BaumanDeviceError("Không tìm thấy thiết bị Bauman.", 404, "DEVICE_NOT_FOUND");
  const database = await getControlDatabase();
  if (operation === "approve") {
    await database.prepare(
      `UPDATE bauman_devices SET status = 'approved', approved_at = CURRENT_TIMESTAMP,
              approved_by = ?, blocked_at = NULL, blocked_by = NULL WHERE device_id = ?`,
    ).bind(actor, deviceId).run();
    await audit(actor, "device_approved", deviceId, { deviceCode: row.display_code });
  } else if (operation === "block") {
    await database.prepare(
      `UPDATE bauman_devices SET status = 'blocked', blocked_at = CURRENT_TIMESTAMP,
              blocked_by = ? WHERE device_id = ?`,
    ).bind(actor, deviceId).run();
    await database.prepare("DELETE FROM bauman_challenges WHERE device_id = ?").bind(deviceId).run();
    await audit(actor, row.status === "pending" ? "device_rejected" : "device_blocked", deviceId, { deviceCode: row.display_code });
  } else if (operation === "reopen") {
    await database.prepare(
      `UPDATE bauman_devices SET status = 'pending', approved_at = NULL, approved_by = NULL,
              blocked_at = NULL, blocked_by = NULL WHERE device_id = ?`,
    ).bind(deviceId).run();
    await audit(actor, "device_reopened", deviceId, { deviceCode: row.display_code });
  } else {
    const normalized = typeof label === "string" ? label.trim().slice(0, 120) : "";
    await database.prepare("UPDATE bauman_devices SET label = ? WHERE device_id = ?").bind(normalized || null, deviceId).run();
    await audit(actor, "device_label_updated", deviceId, { deviceCode: row.display_code, label: normalized || null });
  }
  return listBaumanDevices();
}

export function baumanDeviceErrorResponse(error: unknown, cors = false) {
  const headers: Record<string, string> = {
    "cache-control": "no-store, private",
    "x-content-type-options": "nosniff",
  };
  if (cors) {
    headers["access-control-allow-origin"] = "*";
    headers["access-control-allow-methods"] = "POST, OPTIONS";
    headers["access-control-allow-headers"] = "content-type";
  }
  if (error instanceof BaumanDeviceError) {
    return Response.json({ error: error.message, code: error.code, device: error.device }, { status: error.status, headers });
  }
  return Response.json({ error: "Dịch vụ thiết bị Bauman đang tạm gián đoạn." }, { status: 500, headers });
}