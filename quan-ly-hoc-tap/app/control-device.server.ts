import { getChatGPTUser, type ChatGPTUser } from "./chatgpt-auth";

export type ControlRole = "viewer" | "reviewer" | "publisher" | "owner";
export type ControlDeviceStatus = "pending" | "approved" | "blocked";

type DeviceRow = {
  device_id: string;
  display_code: string;
  public_key_jwk: string;
  email: string;
  status: ControlDeviceStatus;
  label: string | null;
  created_at: string;
  approved_at: string | null;
  blocked_at: string | null;
  last_seen_at: string;
  role: ControlRole | null;
  member_status: string | null;
  display_name: string | null;
};

export type ControlDeviceState = {
  deviceId: string;
  deviceCode: string;
  email: string;
  displayName: string;
  status: ControlDeviceStatus;
  role: ControlRole;
  label: string | null;
  owner: boolean;
};

export class ControlAccessError extends Error {
  status: number;
  code: string;
  device?: ControlDeviceState;

  constructor(message: string, status: number, code: string, device?: ControlDeviceState) {
    super(message);
    this.status = status;
    this.code = code;
    this.device = device;
  }
}

export async function getControlDatabase() {
  const workers = await import("cloudflare:workers");
  if (!workers.env.DB) throw new ControlAccessError("Cơ sở dữ liệu quản trị chưa sẵn sàng.", 503, "CONTROL_DATABASE_UNAVAILABLE");
  return workers.env.DB;
}

async function ownerEmails() {
  const workers = await import("cloudflare:workers");
  const value = (workers.env as unknown as Record<string, unknown>).CONTROL_OWNER_EMAILS;
  return typeof value === "string" ? value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean) : [];
}

export async function isOwnerEmail(email: string) {
  return (await ownerEmails()).includes(email.trim().toLowerCase());
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 256) throw new ControlAccessError("Chữ ký không hợp lệ.", 400, "INVALID_SIGNATURE");
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try { return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)); }
  catch { throw new ControlAccessError("Chữ ký không hợp lệ.", 400, "INVALID_SIGNATURE"); }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function publicKeyShape(value: unknown): JsonWebKey {
  if (!value || typeof value !== "object") throw new ControlAccessError("Khóa thiết bị không hợp lệ.", 400, "INVALID_DEVICE_KEY");
  const source = value as Record<string, unknown>;
  const x = typeof source.x === "string" ? source.x : "";
  const y = typeof source.y === "string" ? source.y : "";
  if (source.kty !== "EC" || source.crv !== "P-256" || !/^[A-Za-z0-9_-]{42,44}$/.test(x) || !/^[A-Za-z0-9_-]{42,44}$/.test(y)) {
    throw new ControlAccessError("Khóa thiết bị không hợp lệ.", 400, "INVALID_DEVICE_KEY");
  }
  return { kty: "EC", crv: "P-256", x, y, ext: true, key_ops: ["verify"] };
}

function canonicalKey(value: JsonWebKey) {
  return JSON.stringify({ kty: value.kty, crv: value.crv, x: value.x, y: value.y });
}

function displayCodeFor(deviceId: string) {
  return `QT-${deviceId.slice(0, 4)}-${deviceId.slice(4, 8)}-${deviceId.slice(8, 12)}-${deviceId.slice(12, 16)}`.toUpperCase();
}

function state(row: DeviceRow, owner: boolean): ControlDeviceState {
  return {
    deviceId: row.device_id,
    deviceCode: row.display_code,
    email: row.email,
    displayName: row.display_name ?? row.email,
    status: row.status,
    role: owner ? "owner" : row.role ?? "viewer",
    label: row.label,
    owner,
  };
}

async function rowFor(deviceId: string) {
  const database = await getControlDatabase();
  return database.prepare(
    `SELECT d.device_id, d.display_code, d.public_key_jwk, d.email, d.status, d.label,
            d.created_at, d.approved_at, d.blocked_at, d.last_seen_at,
            m.role, m.status AS member_status, m.display_name
       FROM control_devices d LEFT JOIN control_members m ON m.email = d.email
      WHERE d.device_id = ?`,
  ).bind(deviceId).first<DeviceRow>();
}

export async function registerControlDevice(publicKey: unknown, user: ChatGPTUser) {
  const key = publicKeyShape(publicKey);
  const serialized = canonicalKey(key);
  const deviceId = await sha256(serialized);
  const email = user.email.trim().toLowerCase();
  const owner = await isOwnerEmail(email);
  const database = await getControlDatabase();
  const existing = await rowFor(deviceId);
  if (existing) {
    if (existing.email !== email) throw new ControlAccessError("Thiết bị này đã gắn với một người dùng khác.", 403, "DEVICE_BOUND_TO_OTHER_USER");
    return state(existing, owner);
  }

  if (owner) {
    await database.prepare(
      `INSERT INTO control_members (email, display_name, role, status, created_by)
       VALUES (?, ?, 'owner', 'active', ?)
       ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, role = 'owner', status = 'active', updated_at = CURRENT_TIMESTAMP`,
    ).bind(email, user.displayName, email).run();
  }
  await database.prepare(
    `INSERT INTO control_devices
      (device_id, display_code, public_key_jwk, email, status, approved_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(deviceId, displayCodeFor(deviceId), serialized, email, owner ? "approved" : "pending", owner ? new Date().toISOString() : null).run();
  const created = await rowFor(deviceId);
  if (!created) throw new ControlAccessError("Không thể tạo hồ sơ thiết bị.", 500, "DEVICE_CREATE_FAILED");
  return state(created, owner);
}

export async function createControlChallenge(deviceId: unknown, user: ChatGPTUser) {
  if (typeof deviceId !== "string" || !/^[a-f0-9]{64}$/.test(deviceId)) throw new ControlAccessError("Mã thiết bị không hợp lệ.", 400, "INVALID_DEVICE");
  const row = await rowFor(deviceId);
  if (!row || row.email !== user.email.trim().toLowerCase()) throw new ControlAccessError("Thiết bị không thuộc tài khoản đang đăng nhập.", 403, "DEVICE_USER_MISMATCH");
  const owner = await isOwnerEmail(row.email);
  const publicState = state(row, owner);
  if (row.status !== "approved") throw new ControlAccessError(row.status === "blocked" ? "Thiết bị đã bị khóa." : "Thiết bị đang chờ cấp quyền.", 403, row.status === "blocked" ? "DEVICE_BLOCKED" : "DEVICE_PENDING", publicState);
  if (!owner && (row.member_status !== "active" || !row.role)) throw new ControlAccessError("Tài khoản quản trị chưa được kích hoạt.", 403, "MEMBER_INACTIVE", publicState);
  const nonce = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = Date.now() + 2 * 60 * 1000;
  const database = await getControlDatabase();
  await database.batch([
    database.prepare("DELETE FROM control_challenges WHERE expires_at < ?").bind(Date.now()),
    database.prepare("INSERT INTO control_challenges (nonce, device_id, expires_at) VALUES (?, ?, ?)").bind(nonce, deviceId, expiresAt),
    database.prepare(
      `DELETE FROM control_challenges
        WHERE device_id = ?
          AND nonce NOT IN (
            SELECT nonce FROM control_challenges
             WHERE device_id = ? ORDER BY rowid DESC LIMIT 8
          )`,
    ).bind(deviceId, deviceId),
  ]);
  return { challenge: nonce, expiresAt, device: publicState };
}

export async function verifyControlProof(payload: Record<string, unknown>, user?: ChatGPTUser | null, skipSignature = false) {
  const identity = user ?? await getChatGPTUser();
  if (!identity) throw new ControlAccessError("Cần đăng nhập để tiếp tục.", 401, "SIGN_IN_REQUIRED");
  const deviceId = typeof payload.deviceId === "string" ? payload.deviceId : "";
  const challenge = typeof payload.challenge === "string" ? payload.challenge : "";
  const signature = typeof payload.signature === "string" ? payload.signature : "";
  if (!/^[a-f0-9]{64}$/.test(deviceId) || !/^[A-Za-z0-9_-]{40,100}$/.test(challenge)) throw new ControlAccessError("Bằng chứng thiết bị không hợp lệ.", 400, "INVALID_DEVICE_PROOF");
  const row = await rowFor(deviceId);
  const email = identity.email.trim().toLowerCase();
  if (!row || row.email !== email) throw new ControlAccessError("Thiết bị không khớp tài khoản.", 403, "DEVICE_USER_MISMATCH");
  const owner = await isOwnerEmail(email);
  const publicState = state(row, owner);
  if (row.status !== "approved") throw new ControlAccessError(row.status === "blocked" ? "Thiết bị đã bị khóa." : "Thiết bị đang chờ cấp quyền.", 403, row.status === "blocked" ? "DEVICE_BLOCKED" : "DEVICE_PENDING", publicState);
  if (!owner && (row.member_status !== "active" || !row.role)) throw new ControlAccessError("Tài khoản chưa được kích hoạt.", 403, "MEMBER_INACTIVE", publicState);
  const database = await getControlDatabase();
  const proof = await database.prepare("SELECT expires_at FROM control_challenges WHERE nonce = ? AND device_id = ?").bind(challenge, deviceId).first<{ expires_at: number }>();
  await database.prepare("DELETE FROM control_challenges WHERE nonce = ? AND device_id = ?").bind(challenge, deviceId).run();
  if (!proof || proof.expires_at < Date.now()) throw new ControlAccessError("Không thể hoàn tất xác thực thiết bị.", 401, "DEVICE_PROOF_EXPIRED");
  if (!skipSignature) {
    const key = await crypto.subtle.importKey("jwk", publicKeyShape(JSON.parse(row.public_key_jwk)), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const message = new TextEncoder().encode(`learning-control:${deviceId}:${challenge}`);
    const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, fromBase64Url(signature), message);
    if (!valid) throw new ControlAccessError("Thiết bị không khớp quyền được cấp.", 403, "DEVICE_MISMATCH", publicState);
  }
  await database.prepare(
    "UPDATE control_devices SET last_seen_at = CURRENT_TIMESTAMP WHERE device_id = ?",
  ).bind(deviceId).run();
  return publicState;
}

export function controlErrorResponse(error: unknown) {
  if (error instanceof ControlAccessError) {
    return Response.json({ error: error.message, code: error.code, device: error.device }, { status: error.status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
  }
  return Response.json({ error: "Dịch vụ quản trị đang tạm gián đoạn." }, { status: 500, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
}
