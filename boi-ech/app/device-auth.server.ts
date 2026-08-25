import { getChatGPTUser } from "./chatgpt-auth";

export type DeviceStatus = "pending" | "approved" | "blocked";
export type AccessGroup = "unassigned" | "free" | "paid";
export type PaymentStatus = "unassigned" | "awaiting_payment" | "proof_submitted" | "free_approved" | "paid_verified";
export type PersonRole = "learner" | "teacher";

type DeviceAccessRow = {
  device_id: string;
  display_code: string;
  public_key_jwk: string;
  status: DeviceStatus;
  label: string | null;
  learner_name?: string | null;
  learner_family_name?: string | null;
  learner_given_name?: string | null;
  person_role?: PersonRole | null;
  person_code?: string | null;
  class_name?: string | null;
  phone?: string | null;
  registration_submitted_at?: string | null;
  access_group?: AccessGroup | null;
  payment_status?: PaymentStatus | null;
  payment_proof_key?: string | null;
  payment_proof_name?: string | null;
  payment_proof_content_type?: string | null;
  payment_proof_size?: number | null;
  payment_submitted_at?: string | null;
  payment_verified_at?: string | null;
  payment_rejected_at?: string | null;
  payment_review_note?: string | null;
  access_expires_at?: string | null;
  personal_edit_enabled?: number | null;
  auto_confirmed_at?: string | null;
  created_at: string;
  approved_at: string | null;
  blocked_at: string | null;
  last_seen_at: string;
};

type LegacyCourseRow = {
  user_key: string;
  completed_json: string;
  scores_json: string;
};

export type PublicDeviceState = {
  deviceId: string;
  deviceCode: string;
  status: DeviceStatus;
  label: string | null;
  learnerName: string | null;
  learnerFamilyName: string | null;
  learnerGivenName: string | null;
  personRole: PersonRole | null;
  personCode: string | null;
  className: string | null;
  phone: string | null;
  registrationComplete: boolean;
  accessGroup: AccessGroup;
  paymentStatus: PaymentStatus;
  paymentAmount: number;
  paymentSubmittedAt: string | null;
  paymentRejectedAt: string | null;
  paymentReviewNote: string | null;
  accessExpiresAt: string | null;
  accessExpired: boolean;
  accessExpiringSoon: boolean;
  accessDaysRemaining: number | null;
  personalEditEnabled: boolean;
  autoConfirmedAt: string | null;
};

export type AccessAutomationSettings = {
  deviceApprovalEnabled: boolean;
  teacherEditEnabled: boolean;
  defaultAccessDays: number;
  updatedBy: string | null;
  updatedAt: string | null;
};

export class DeviceAccessError extends Error {
  status: number;
  code: string;
  device?: PublicDeviceState;

  constructor(message: string, status: number, code: string, device?: PublicDeviceState) {
    super(message);
    this.status = status;
    this.code = code;
    this.device = device;
  }
}

let deviceSchemaReady: Promise<unknown> | null = null;

export async function getCourseDatabase() {
  const workers = await import("cloudflare:workers");
  if (!workers.env.DB) throw new Error("Kho tiến độ chưa sẵn sàng.");
  const database = workers.env.DB;
  deviceSchemaReady ??= database.batch([
    database.prepare(
      `CREATE TABLE IF NOT EXISTS device_access (
        device_id TEXT PRIMARY KEY NOT NULL,
        display_code TEXT NOT NULL UNIQUE,
        public_key_jwk TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        label TEXT,
        learner_name TEXT,
        learner_family_name TEXT,
        learner_given_name TEXT,
        person_role TEXT,
        person_code TEXT,
        class_name TEXT,
        phone TEXT,
        registration_submitted_at TEXT,
        access_group TEXT NOT NULL DEFAULT 'unassigned',
        payment_status TEXT NOT NULL DEFAULT 'unassigned',
        payment_proof_key TEXT,
        payment_proof_name TEXT,
        payment_proof_content_type TEXT,
        payment_proof_size INTEGER,
        payment_submitted_at TEXT,
        payment_verified_at TEXT,
        payment_rejected_at TEXT,
        payment_review_note TEXT,
        access_expires_at TEXT,
        personal_edit_enabled INTEGER NOT NULL DEFAULT 0,
        auto_confirmed_at TEXT,
        migrated_from_user_key TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        approved_at TEXT,
        blocked_at TEXT,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT
      )`,
    ),
    database.prepare(
      `CREATE TABLE IF NOT EXISTS access_automation_settings (
        id TEXT PRIMARY KEY NOT NULL,
        auto_confirm_new_devices INTEGER NOT NULL DEFAULT 1,
        auto_enable_teacher_local_edit INTEGER NOT NULL DEFAULT 1,
        default_access_days INTEGER NOT NULL DEFAULT 60,
        updated_by TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ),
    database.prepare(
      `INSERT INTO access_automation_settings
        (id, auto_confirm_new_devices, auto_enable_teacher_local_edit, default_access_days)
       VALUES ('global', 1, 1, 60)
       ON CONFLICT(id) DO NOTHING`,
    ),
    database.prepare(
      `CREATE TABLE IF NOT EXISTS device_profiles (
        device_id TEXT PRIMARY KEY NOT NULL,
        completed_json TEXT NOT NULL DEFAULT '[]',
        scores_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ),
    database.prepare(
      `CREATE TABLE IF NOT EXISTS device_challenges (
        nonce TEXT PRIMARY KEY NOT NULL,
        device_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ),
    database.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS device_access_display_code_unique ON device_access(display_code)",
    ),
    database.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS device_access_person_identity_unique ON device_access(person_role, person_code)",
    ),
  ]);
  await deviceSchemaReady;
  return database;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 256) {
    throw new DeviceAccessError("Chữ ký thiết bị không hợp lệ.", 400, "INVALID_SIGNATURE");
  }
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    throw new DeviceAccessError("Chữ ký thiết bị không hợp lệ.", 400, "INVALID_SIGNATURE");
  }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function publicKeyShape(value: unknown): JsonWebKey {
  if (!value || typeof value !== "object") {
    throw new DeviceAccessError("Khóa thiết bị không hợp lệ.", 400, "INVALID_DEVICE_KEY");
  }
  const source = value as Record<string, unknown>;
  const x = typeof source.x === "string" ? source.x : "";
  const y = typeof source.y === "string" ? source.y : "";
  if (source.kty !== "EC" || source.crv !== "P-256" || !/^[A-Za-z0-9_-]{42,44}$/.test(x) || !/^[A-Za-z0-9_-]{42,44}$/.test(y)) {
    throw new DeviceAccessError("Khóa thiết bị không hợp lệ.", 400, "INVALID_DEVICE_KEY");
  }
  return { kty: "EC", crv: "P-256", x, y, ext: true, key_ops: ["verify"] };
}

function canonicalPublicKey(value: JsonWebKey) {
  return JSON.stringify({ kty: value.kty, crv: value.crv, x: value.x, y: value.y });
}

async function importVerificationKey(value: JsonWebKey) {
  return crypto.subtle.importKey(
    "jwk",
    value,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
}

function publicState(row: DeviceAccessRow): PublicDeviceState {
  const legacyName = row.learner_name?.trim().replace(/\s+/g, " ") || null;
  const legacyParts = legacyName?.split(" ") ?? [];
  const learnerGivenName = row.learner_given_name?.trim()
    || (legacyParts.length > 0 ? legacyParts.at(-1)! : null);
  const learnerFamilyName = row.learner_family_name?.trim()
    || (legacyParts.length > 1 ? legacyParts.slice(0, -1).join(" ") : null);
  const learnerName = [learnerFamilyName, learnerGivenName].filter(Boolean).join(" ") || legacyName;
  const personRole = row.person_role === "learner" || row.person_role === "teacher" ? row.person_role : null;
  const personCode = row.person_code?.trim() || null;
  const className = row.class_name?.trim() || null;
  const phone = row.phone?.trim() || null;
  const accessExpiresAt = row.access_expires_at ?? null;
  const expiryTime = accessExpiresAt ? Date.parse(accessExpiresAt) : Number.NaN;
  const accessExpired = Number.isFinite(expiryTime) && expiryTime <= Date.now();
  const accessExpiringSoon = !accessExpired && Number.isFinite(expiryTime) && expiryTime - Date.now() <= 7 * 24 * 60 * 60 * 1000;
  const accessDaysRemaining = Number.isFinite(expiryTime)
    ? Math.max(0, Math.ceil((expiryTime - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;
  return {
    deviceId: row.device_id,
    deviceCode: row.display_code,
    status: row.status,
    label: row.label,
    learnerName,
    learnerFamilyName,
    learnerGivenName,
    personRole,
    personCode,
    className,
    phone,
    registrationComplete: Boolean(learnerName && personRole && personCode && className && phone && row.registration_submitted_at),
    accessGroup: row.access_group ?? "unassigned",
    paymentStatus: row.payment_status ?? "unassigned",
    paymentAmount: 50_000,
    paymentSubmittedAt: row.payment_submitted_at ?? null,
    paymentRejectedAt: row.payment_rejected_at ?? null,
    paymentReviewNote: row.payment_review_note ?? null,
    accessExpiresAt,
    accessExpired,
    accessExpiringSoon,
    accessDaysRemaining,
    personalEditEnabled: row.personal_edit_enabled === 1 && !accessExpired,
    autoConfirmedAt: row.auto_confirmed_at ?? null,
  };
}

const deviceColumns = `device_id, display_code, public_key_jwk, status, label, learner_name,
  learner_family_name, learner_given_name, person_role, person_code,
  class_name, phone, registration_submitted_at, access_group, payment_status,
  payment_proof_key, payment_proof_name, payment_proof_content_type, payment_proof_size,
  payment_submitted_at, payment_verified_at, payment_rejected_at, payment_review_note,
  access_expires_at, personal_edit_enabled, auto_confirmed_at, created_at,
  approved_at, blocked_at, last_seen_at`;

export async function getAccessAutomationSettings(): Promise<AccessAutomationSettings> {
  const database = await getCourseDatabase();
  const row = await database.prepare(
    `SELECT auto_confirm_new_devices, auto_enable_teacher_local_edit, default_access_days, updated_by, updated_at
       FROM access_automation_settings WHERE id = 'global'`,
  ).first<{ auto_confirm_new_devices: number; auto_enable_teacher_local_edit: number; default_access_days: number; updated_by: string | null; updated_at: string | null }>();
  return {
    deviceApprovalEnabled: row?.auto_confirm_new_devices !== 0,
    teacherEditEnabled: row?.auto_enable_teacher_local_edit !== 0,
    defaultAccessDays: Math.max(1, Math.min(365, Number(row?.default_access_days) || 60)),
    updatedBy: row?.updated_by ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

export function accessExpiryAfterDays(days: number) {
  return new Date(Date.now() + Math.max(1, Math.min(365, Math.floor(days))) * 24 * 60 * 60 * 1000).toISOString();
}

function displayCodeFor(deviceId: string) {
  return `BE-${deviceId.slice(0, 4)}-${deviceId.slice(4, 8)}-${deviceId.slice(8, 12)}-${deviceId.slice(12, 16)}`.toUpperCase();
}

async function hashLegacyToken(token: string) {
  if (token.length < 32 || token.length > 256) return null;
  return sha256(token);
}

export async function registerDevice(publicKey: unknown, legacyToken: unknown, autoApprove = false) {
  const normalizedKey = publicKeyShape(publicKey);
  if (!autoApprove) await importVerificationKey(normalizedKey);
  const serializedKey = canonicalPublicKey(normalizedKey);
  const deviceId = await sha256(serializedKey);
  const database = await getCourseDatabase();

  const existing = await database.prepare(
    `SELECT ${deviceColumns} FROM device_access WHERE device_id = ?`,
  ).bind(deviceId).first<DeviceAccessRow>();
  if (existing) {
    return publicState(existing);
  }

  let legacy: LegacyCourseRow | null = null;
  if (typeof legacyToken === "string") {
    const legacyHash = await hashLegacyToken(legacyToken);
    if (legacyHash) {
      legacy = await database.prepare(
        `SELECT user_key, completed_json, scores_json
           FROM course_profiles WHERE device_hash = ?
          ORDER BY updated_at DESC LIMIT 1`,
      ).bind(legacyHash).first<LegacyCourseRow>();
    }
  }

  const status: DeviceStatus = legacy || autoApprove ? "approved" : "pending";
  const displayCode = displayCodeFor(deviceId);
  await database.batch([
    database.prepare(
      `INSERT INTO device_access
        (device_id, display_code, public_key_jwk, status, migrated_from_user_key, approved_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      deviceId,
      displayCode,
      serializedKey,
      status,
      legacy?.user_key ?? null,
      status === "approved" ? new Date().toISOString() : null,
    ),
    database.prepare(
      `INSERT INTO device_profiles (device_id, completed_json, scores_json)
       VALUES (?, ?, ?)
       ON CONFLICT(device_id) DO NOTHING`,
    ).bind(deviceId, legacy?.completed_json ?? "[]", legacy?.scores_json ?? "{}"),
  ]);
  return {
    deviceId,
    deviceCode: displayCode,
    status,
    label: null,
    learnerName: null,
    learnerFamilyName: null,
    learnerGivenName: null,
    personRole: null,
    personCode: null,
    className: null,
    phone: null,
    registrationComplete: false,
    accessGroup: status === "approved" ? "free" : "unassigned",
    paymentStatus: status === "approved" ? "free_approved" : "unassigned",
    paymentAmount: 50_000,
    paymentSubmittedAt: null,
    paymentRejectedAt: null,
    paymentReviewNote: null,
    accessExpiresAt: null,
    accessExpired: false,
    accessExpiringSoon: false,
    accessDaysRemaining: null,
    personalEditEnabled: false,
    autoConfirmedAt: null,
  } satisfies PublicDeviceState;
}

export async function createDeviceChallenge(deviceId: unknown) {
  if (typeof deviceId !== "string" || !/^[a-f0-9]{64}$/.test(deviceId)) {
    throw new DeviceAccessError("Mã thiết bị không hợp lệ.", 400, "INVALID_DEVICE");
  }
  const database = await getCourseDatabase();
  const row = await database.prepare(
    `SELECT ${deviceColumns} FROM device_access WHERE device_id = ?`,
  ).bind(deviceId).first<DeviceAccessRow>();
  if (!row) throw new DeviceAccessError("Thiết bị chưa được đăng ký.", 404, "DEVICE_NOT_REGISTERED");
  const device = publicState(row);
  if (row.status === "blocked") {
    throw new DeviceAccessError("Quyền truy cập của thiết bị này đã bị khóa.", 403, "DEVICE_BLOCKED", device);
  }
  const nonce = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = Date.now() + 2 * 60 * 1000;
  await database.batch([
    database.prepare("DELETE FROM device_challenges WHERE expires_at < ?").bind(Date.now()),
    database.prepare(
      "INSERT INTO device_challenges (nonce, device_id, expires_at) VALUES (?, ?, ?)",
    ).bind(nonce, deviceId, expiresAt),
    database.prepare(
      `DELETE FROM device_challenges
        WHERE device_id = ?
          AND nonce NOT IN (
            SELECT nonce FROM device_challenges
             WHERE device_id = ? ORDER BY rowid DESC LIMIT 8
          )`,
    ).bind(deviceId, deviceId),
  ]);
  return { challenge: nonce, expiresAt, device };
}

export async function verifyDeviceIdentityRequest(payload: Record<string, unknown>, skipSignatureCheck = false) {
  const deviceId = typeof payload.deviceId === "string" ? payload.deviceId : "";
  const challenge = typeof payload.challenge === "string" ? payload.challenge : "";
  const signature = typeof payload.signature === "string" ? payload.signature : "";
  if (!/^[a-f0-9]{64}$/.test(deviceId) || !/^[A-Za-z0-9_-]{40,100}$/.test(challenge)) {
    throw new DeviceAccessError("Xác thực thiết bị không hợp lệ.", 400, "INVALID_DEVICE_PROOF");
  }

  const database = await getCourseDatabase();
  const row = await database.prepare(
    `SELECT ${deviceColumns} FROM device_access WHERE device_id = ?`,
  ).bind(deviceId).first<DeviceAccessRow>();
  if (!row) throw new DeviceAccessError("Thiết bị chưa được đăng ký.", 403, "DEVICE_NOT_REGISTERED");
  const device = publicState(row);
  if (row.status === "blocked") throw new DeviceAccessError("Quyền truy cập của thiết bị này đã bị khóa.", 403, "DEVICE_BLOCKED", device);

  const proof = await database.prepare(
    "SELECT expires_at FROM device_challenges WHERE nonce = ? AND device_id = ?",
  ).bind(challenge, deviceId).first<{ expires_at: number }>();
  await database.prepare(
    "DELETE FROM device_challenges WHERE nonce = ? AND device_id = ?",
  ).bind(challenge, deviceId).run();
  if (!proof || proof.expires_at < Date.now()) {
    throw new DeviceAccessError("Không thể hoàn tất xác thực thiết bị.", 401, "DEVICE_PROOF_EXPIRED");
  }

  if (!skipSignatureCheck) {
    const publicKey = publicKeyShape(JSON.parse(row.public_key_jwk) as unknown);
    const verificationKey = await importVerificationKey(publicKey);
    const message = new TextEncoder().encode(`boi-ech:${deviceId}:${challenge}`);
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      verificationKey,
      fromBase64Url(signature),
      message,
    );
    if (!valid) throw new DeviceAccessError("Thiết bị không khớp với quyền đã cấp.", 403, "DEVICE_MISMATCH", device);
  }
  await database.prepare(
    "UPDATE device_access SET last_seen_at = CURRENT_TIMESTAMP WHERE device_id = ?",
  ).bind(deviceId).run();
  return device;
}

export async function verifyDeviceRequest(payload: Record<string, unknown>, skipSignatureCheck = false) {
  const device = await verifyDeviceIdentityRequest(payload, skipSignatureCheck);
  if (device.status !== "approved") {
    throw new DeviceAccessError("Thiết bị đang chờ quản trị viên duyệt.", 403, "DEVICE_PENDING", device);
  }
  const database = await getCourseDatabase();
  const row = await database.prepare("SELECT access_expires_at FROM device_access WHERE device_id = ?")
    .bind(device.deviceId).first<{ access_expires_at: string | null }>();
  if (row?.access_expires_at && Date.parse(row.access_expires_at) <= Date.now()) {
    throw new DeviceAccessError("Quyền truy cập của thiết bị đã hết hạn.", 403, "DEVICE_ACCESS_EXPIRED", device);
  }
  return device;
}

function normalizeLearnerNamePart(value: unknown, label: "Họ" | "Tên") {
  const normalized = typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 60) : "";
  if (!normalized || !/[\p{L}\p{M}]/u.test(normalized) || /[^\p{L}\p{M}\s'.-]/u.test(normalized)) {
    throw new DeviceAccessError(`${label} chỉ được gồm chữ cái và phải được nhập đầy đủ.`, 400, label === "Họ" ? "INVALID_FAMILY_NAME" : "INVALID_GIVEN_NAME");
  }
  return normalized;
}

function normalizeRegistrationName(payload: Record<string, unknown>) {
  if (typeof payload.learnerFamilyName === "string" || typeof payload.learnerGivenName === "string") {
    const learnerFamilyName = normalizeLearnerNamePart(payload.learnerFamilyName, "Họ");
    const learnerGivenName = normalizeLearnerNamePart(payload.learnerGivenName, "Tên");
    return { learnerFamilyName, learnerGivenName, learnerName: `${learnerFamilyName} ${learnerGivenName}` };
  }

  const legacyName = typeof payload.learnerName === "string" ? payload.learnerName.trim().replace(/\s+/g, " ").slice(0, 100) : "";
  const parts = legacyName.split(" ").filter(Boolean);
  if (parts.length < 2) throw new DeviceAccessError("Họ và tên phải có ít nhất hai phần.", 400, "INVALID_LEARNER_NAME");
  const learnerGivenName = normalizeLearnerNamePart(parts.at(-1), "Tên");
  const learnerFamilyName = normalizeLearnerNamePart(parts.slice(0, -1).join(" "), "Họ");
  return { learnerFamilyName, learnerGivenName, learnerName: `${learnerFamilyName} ${learnerGivenName}` };
}

function normalizeClassName(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 50) : "";
  if (!normalized) throw new DeviceAccessError("Hãy nhập lớp của người học.", 400, "INVALID_CLASS_NAME");
  return normalized;
}

function normalizePersonIdentity(roleValue: unknown, codeValue: unknown) {
  if (roleValue !== "learner" && roleValue !== "teacher") {
    throw new DeviceAccessError("Hãy chọn Học viên hoặc Giảng viên.", 400, "INVALID_PERSON_ROLE");
  }
  const personRole: PersonRole = roleValue;
  const personCode = typeof codeValue === "string"
    ? codeValue.trim().replace(/\s+/g, "").toUpperCase().slice(0, 32)
    : "";
  if (!/^[A-Z0-9][A-Z0-9./_-]{2,31}$/.test(personCode)) {
    throw new DeviceAccessError(
      personRole === "teacher"
        ? "Số hiệu SQ/QNCN phải có từ 3 đến 32 ký tự chữ, số, dấu chấm, gạch hoặc dấu /."
        : "Mã số học viên phải có từ 3 đến 32 ký tự chữ, số, dấu chấm, gạch hoặc dấu /.",
      400,
      "INVALID_PERSON_CODE",
    );
  }
  return { personRole, personCode };
}

function normalizePhone(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().replace(/[.\s-]/g, "") : "";
  if (!/^(?:\+84|0)\d{9,10}$/.test(normalized)) {
    throw new DeviceAccessError("Số điện thoại chưa đúng định dạng Việt Nam.", 400, "INVALID_PHONE");
  }
  return normalized.startsWith("+84") ? `0${normalized.slice(3)}` : normalized;
}

export async function saveDeviceRegistration(payload: Record<string, unknown>, skipSignatureCheck = false) {
  const device = await verifyDeviceIdentityRequest(payload, skipSignatureCheck);
  const { learnerFamilyName, learnerGivenName, learnerName } = normalizeRegistrationName(payload);
  const { personRole, personCode } = normalizePersonIdentity(payload.personRole, payload.personCode);
  const className = normalizeClassName(payload.className);
  const phone = normalizePhone(payload.phone);
  const database = await getCourseDatabase();
  const duplicate = await database.prepare("SELECT device_id FROM device_access WHERE phone = ? AND device_id <> ?")
    .bind(phone, device.deviceId).first<{ device_id: string }>();
  if (duplicate) throw new DeviceAccessError("Số điện thoại này đã được đăng ký cho một thiết bị khác.", 409, "PHONE_ALREADY_REGISTERED");
  const duplicateIdentity = await database.prepare(
    "SELECT device_id FROM device_access WHERE person_role = ? AND person_code = ? AND device_id <> ?",
  ).bind(personRole, personCode, device.deviceId).first<{ device_id: string }>();
  if (duplicateIdentity) {
    throw new DeviceAccessError(
      personRole === "teacher" ? "Số hiệu SQ/QNCN này đã được đăng ký." : "Mã số học viên này đã được đăng ký.",
      409,
      "PERSON_CODE_ALREADY_REGISTERED",
    );
  }
  const current = await database.prepare(
    `SELECT learner_name, learner_family_name, learner_given_name, person_role, person_code, class_name, phone,
            registration_submitted_at, status, payment_status
       FROM device_access WHERE device_id = ?`,
  ).bind(device.deviceId).first<{
    learner_name: string | null;
    learner_family_name: string | null;
    learner_given_name: string | null;
    person_role: PersonRole | null;
    person_code: string | null;
    class_name: string | null;
    phone: string | null;
    registration_submitted_at: string | null;
    status: DeviceStatus;
    payment_status: PaymentStatus;
  }>();
  const automation = await getAccessAutomationSettings();
  const shouldAutoConfirm = automation.deviceApprovalEnabled
    && current?.status !== "blocked"
    && current?.payment_status === "unassigned";
  const changed = !current
    || current.learner_name !== learnerName
    || current.learner_family_name !== learnerFamilyName
    || current.learner_given_name !== learnerGivenName
    || current.person_role !== personRole
    || current.person_code !== personCode
    || current.class_name !== className
    || current.phone !== phone
    || !current.registration_submitted_at;
  try {
    await database.prepare(
      `UPDATE device_access SET learner_name = ?, learner_family_name = ?, learner_given_name = ?, person_role = ?, person_code = ?, class_name = ?, phone = ?,
         registration_submitted_at = COALESCE(registration_submitted_at, CURRENT_TIMESTAMP),
         access_group = CASE WHEN status = 'approved' AND access_group = 'unassigned' THEN 'free' ELSE access_group END,
         payment_status = CASE WHEN status = 'approved' AND payment_status = 'unassigned' THEN 'free_approved' ELSE payment_status END,
         personal_edit_enabled = CASE WHEN ? = 'teacher' THEN personal_edit_enabled ELSE 0 END
       WHERE device_id = ?`,
    ).bind(learnerName, learnerFamilyName, learnerGivenName, personRole, personCode, className, phone, personRole, device.deviceId).run();
    if (shouldAutoConfirm) {
      await database.prepare(
        `UPDATE device_access SET status = 'approved', access_group = 'free', payment_status = 'free_approved',
                approved_at = CURRENT_TIMESTAMP, blocked_at = NULL,
                personal_edit_enabled = CASE WHEN person_role = 'teacher' AND ? = 1 THEN 1 ELSE 0 END,
                auto_confirmed_at = CURRENT_TIMESTAMP, access_expires_at = ?, updated_at = CURRENT_TIMESTAMP
          WHERE device_id = ?`,
      ).bind(automation.teacherEditEnabled ? 1 : 0, accessExpiryAfterDays(automation.defaultAccessDays), device.deviceId).run();
    }
  } catch (error) {
    if (error instanceof Error && /device_access\.phone|device_access_phone_unique/i.test(error.message)) {
      throw new DeviceAccessError("Số điện thoại này đã được đăng ký cho một thiết bị khác.", 409, "PHONE_ALREADY_REGISTERED");
    }
    if (error instanceof Error && /device_access\.person_role|device_access\.person_code|device_access_person_identity_unique/i.test(error.message)) {
      throw new DeviceAccessError(personRole === "teacher" ? "Số hiệu SQ/QNCN này đã được đăng ký." : "Mã số học viên này đã được đăng ký.", 409, "PERSON_CODE_ALREADY_REGISTERED");
    }
    throw error;
  }
  if (changed) {
    await database.prepare(
      "INSERT INTO course_audit_log (actor, action, target, detail_json) VALUES (?, 'device_registration_submitted', ?, ?)",
    ).bind(device.deviceCode, device.deviceId, JSON.stringify({ learnerName, learnerFamilyName, learnerGivenName, personRole, personCode, className, phone })).run();
  }
  if (shouldAutoConfirm) {
    await database.prepare(
      "INSERT INTO course_audit_log (actor, action, target, detail_json) VALUES (?, 'learning_device_auto_confirmed', ?, ?)",
    ).bind("automation", device.deviceId, JSON.stringify({
      accessDays: automation.defaultAccessDays,
      personalEditEnabled: personRole === "teacher" && automation.teacherEditEnabled,
    })).run();
  }
  const updated = await database.prepare(`SELECT ${deviceColumns} FROM device_access WHERE device_id = ?`)
    .bind(device.deviceId).first<DeviceAccessRow>();
  if (!updated) throw new DeviceAccessError("Không thể lưu hồ sơ thiết bị.", 500, "REGISTRATION_SAVE_FAILED");
  return publicState(updated);
}

async function configuredAdminEmails() {
  const workers = await import("cloudflare:workers");
  const value = (workers.env as unknown as Record<string, unknown>).DEVICE_ADMIN_EMAILS;
  return typeof value === "string"
    ? value.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean)
    : [];
}

export async function isDeviceAdminEmail(email: string) {
  return (await configuredAdminEmails()).includes(email.trim().toLowerCase());
}

export async function requireDeviceAdmin() {
  const user = await getChatGPTUser();
  if (!user) throw new DeviceAccessError("Cần đăng nhập quản trị.", 401, "ADMIN_SIGN_IN_REQUIRED");
  if (!(await isDeviceAdminEmail(user.email))) {
    throw new DeviceAccessError("Tài khoản này không có quyền quản lý thiết bị.", 403, "ADMIN_FORBIDDEN");
  }
  return user;
}

export function deviceErrorResponse(error: unknown) {
  if (error instanceof DeviceAccessError) {
    return Response.json(
      { error: error.message, code: error.code, device: error.device },
      { status: error.status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } },
    );
  }
  return Response.json(
    { error: "Dịch vụ xác thực thiết bị đang tạm gián đoạn.", code: "DEVICE_SERVICE_ERROR" },
    { status: 500, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } },
  );
}

export function normalizeAccessExpiry(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T23:59:59.999Z`
    : value;
  const time = Date.parse(normalized);
  if (!Number.isFinite(time)) {
    throw new DeviceAccessError("Ngày hết hạn không hợp lệ.", 400, "INVALID_ACCESS_EXPIRY");
  }
  return new Date(time).toISOString();
}
