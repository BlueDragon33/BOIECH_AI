import { getChatGPTUser, type ChatGPTUser } from "./chatgpt-auth";
import { getCourseDatabase } from "./device-auth.server";

type EditorDeviceRow = {
  device_id: string;
  display_code: string;
  public_key_jwk: string;
  email: string;
  created_at: string;
  last_seen_at: string;
};

export type EditorDeviceState = {
  deviceId: string;
  deviceCode: string;
  email: string;
  displayName: string;
};

export class EditorAccessError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 256) {
    throw new EditorAccessError("Chữ ký laptop biên tập không hợp lệ.", 400, "INVALID_EDITOR_SIGNATURE");
  }
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try { return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)); }
  catch { throw new EditorAccessError("Chữ ký laptop biên tập không hợp lệ.", 400, "INVALID_EDITOR_SIGNATURE"); }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function publicKeyShape(value: unknown): JsonWebKey {
  if (!value || typeof value !== "object") throw new EditorAccessError("Khóa laptop không hợp lệ.", 400, "INVALID_EDITOR_KEY");
  const source = value as Record<string, unknown>;
  const x = typeof source.x === "string" ? source.x : "";
  const y = typeof source.y === "string" ? source.y : "";
  if (source.kty !== "EC" || source.crv !== "P-256" || !/^[A-Za-z0-9_-]{42,44}$/.test(x) || !/^[A-Za-z0-9_-]{42,44}$/.test(y)) {
    throw new EditorAccessError("Khóa laptop không hợp lệ.", 400, "INVALID_EDITOR_KEY");
  }
  return { kty: "EC", crv: "P-256", x, y, ext: true, key_ops: ["verify"] };
}

function canonicalKey(value: JsonWebKey) {
  return JSON.stringify({ kty: value.kty, crv: value.crv, x: value.x, y: value.y });
}

function displayCodeFor(deviceId: string) {
  return `BT-${deviceId.slice(0, 4)}-${deviceId.slice(4, 8)}-${deviceId.slice(8, 12)}-${deviceId.slice(12, 16)}`.toUpperCase();
}

async function rowFor(deviceId: string) {
  const database = await getCourseDatabase();
  return database.prepare(
    `SELECT device_id, display_code, public_key_jwk, email, created_at, last_seen_at
       FROM content_editor_devices WHERE device_id = ?`,
  ).bind(deviceId).first<EditorDeviceRow>();
}

function state(row: EditorDeviceRow, user: ChatGPTUser): EditorDeviceState {
  return { deviceId: row.device_id, deviceCode: row.display_code, email: row.email, displayName: user.displayName };
}

export async function registerEditorDevice(publicKey: unknown, user: ChatGPTUser) {
  const key = publicKeyShape(publicKey);
  const serialized = canonicalKey(key);
  const deviceId = await sha256(serialized);
  const email = user.email.trim().toLowerCase();
  const database = await getCourseDatabase();
  const existing = await rowFor(deviceId);
  if (existing) {
    if (existing.email !== email) throw new EditorAccessError("Laptop này đã gắn với một người dùng khác.", 403, "EDITOR_DEVICE_BOUND");
    await database.prepare("UPDATE content_editor_devices SET last_seen_at = CURRENT_TIMESTAMP WHERE device_id = ?").bind(deviceId).run();
    return state(existing, user);
  }
  const displayCode = displayCodeFor(deviceId);
  await database.prepare(
    `INSERT INTO content_editor_devices (device_id, display_code, public_key_jwk, email)
     VALUES (?, ?, ?, ?)`,
  ).bind(deviceId, displayCode, serialized, email).run();
  const created = await rowFor(deviceId);
  if (!created) throw new EditorAccessError("Không thể đăng ký laptop biên tập.", 500, "EDITOR_DEVICE_CREATE_FAILED");
  return state(created, user);
}

export async function createEditorChallenge(deviceId: unknown, user: ChatGPTUser) {
  if (typeof deviceId !== "string" || !/^[a-f0-9]{64}$/.test(deviceId)) {
    throw new EditorAccessError("Mã laptop biên tập không hợp lệ.", 400, "INVALID_EDITOR_DEVICE");
  }
  const row = await rowFor(deviceId);
  if (!row || row.email !== user.email.trim().toLowerCase()) {
    throw new EditorAccessError("Laptop không thuộc tài khoản đang đăng nhập.", 403, "EDITOR_DEVICE_USER_MISMATCH");
  }
  const nonce = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = Date.now() + 2 * 60 * 1000;
  const database = await getCourseDatabase();
  await database.batch([
    database.prepare("DELETE FROM content_editor_challenges WHERE expires_at < ?").bind(Date.now()),
    database.prepare("DELETE FROM content_editor_challenges WHERE device_id = ?").bind(deviceId),
    database.prepare("INSERT INTO content_editor_challenges (nonce, device_id, expires_at) VALUES (?, ?, ?)").bind(nonce, deviceId, expiresAt),
    database.prepare("UPDATE content_editor_devices SET last_seen_at = CURRENT_TIMESTAMP WHERE device_id = ?").bind(deviceId),
  ]);
  return { challenge: nonce, expiresAt, device: state(row, user) };
}

export async function verifyEditorProof(payload: Record<string, unknown>) {
  const user = await getChatGPTUser();
  if (!user) throw new EditorAccessError("Cần đăng nhập ChatGPT để chỉnh sửa.", 401, "EDITOR_SIGN_IN_REQUIRED");
  const deviceId = typeof payload.deviceId === "string" ? payload.deviceId : "";
  const challenge = typeof payload.challenge === "string" ? payload.challenge : "";
  const signature = typeof payload.signature === "string" ? payload.signature : "";
  if (!/^[a-f0-9]{64}$/.test(deviceId) || !/^[A-Za-z0-9_-]{40,100}$/.test(challenge)) {
    throw new EditorAccessError("Bằng chứng laptop không hợp lệ.", 400, "INVALID_EDITOR_PROOF");
  }
  const row = await rowFor(deviceId);
  const email = user.email.trim().toLowerCase();
  if (!row || row.email !== email) throw new EditorAccessError("Laptop không khớp tài khoản.", 403, "EDITOR_DEVICE_USER_MISMATCH");
  const database = await getCourseDatabase();
  const proof = await database.prepare(
    "SELECT expires_at FROM content_editor_challenges WHERE nonce = ? AND device_id = ?",
  ).bind(challenge, deviceId).first<{ expires_at: number }>();
  await database.prepare("DELETE FROM content_editor_challenges WHERE nonce = ? AND device_id = ?").bind(challenge, deviceId).run();
  if (!proof || proof.expires_at < Date.now()) throw new EditorAccessError("Phiên xác thực laptop đã hết hạn.", 401, "EDITOR_PROOF_EXPIRED");
  const key = await crypto.subtle.importKey("jwk", publicKeyShape(JSON.parse(row.public_key_jwk)), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const message = new TextEncoder().encode(`boi-ech-editor:${deviceId}:${challenge}`);
  const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, fromBase64Url(signature), message);
  if (!valid) throw new EditorAccessError("Laptop không khớp quyền chỉnh sửa.", 403, "EDITOR_DEVICE_MISMATCH");
  return state(row, user);
}

export function editorErrorResponse(error: unknown) {
  if (error instanceof EditorAccessError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
  }
  return Response.json({ error: "Dịch vụ chỉnh sửa đang tạm gián đoạn.", code: "EDITOR_SERVICE_ERROR" }, { status: 500, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
}
