import type { ControlRole } from "./control-device.server";

const DEFAULT_RU_LIFE_BASE_URL = "https://ru-life-standalone.dinhnam3391.chatgpt.site";

export class RuLifeBridgeError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) { super(message); this.status = status; this.payload = payload; }
}

export type RuLifeControlDevice = {
  appId?: "hoa-nhap-nga";
  deviceId: string;
  deviceCode: string;
  status: "pending" | "approved" | "blocked";
  userName?: string | null;
  userCode?: string | null;
  label?: string | null;
  deviceClass?: "computer" | "phone" | "tablet" | "unknown";
  osName?: string | null;
  browserName?: string | null;
  modelHint?: string | null;
  screen?: string | null;
  createdAt?: string | null;
  approvedAt?: string | null;
  blockedAt?: string | null;
  lastSeenAt?: string | null;
  active?: boolean;
};

type RuLifeDeviceResponse = { ok: boolean; application: "ru-life"; devices: RuLifeControlDevice[] };
export type RuLifeStatus = {
  ok?: boolean;
  application?: "ru-life";
  service?: string;
  readiness?: Record<string, string>;
  devices?: { total?: number; pending?: number; approved?: number; blocked?: number };
  sessions?: { active?: number };
  capabilities?: readonly string[];
};

function base64Url(bytes: Uint8Array) { let binary = ""; bytes.forEach((byte) => { binary += String.fromCharCode(byte); }); return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }

async function config() {
  const workers = await import("cloudflare:workers");
  const values = workers.env as unknown as Record<string, unknown>;
  const secret = typeof values.RU_LIFE_CONTROL_SERVICE_SECRET === "string" ? values.RU_LIFE_CONTROL_SERVICE_SECRET : "";
  const configuredUrl = typeof values.RU_LIFE_BASE_URL === "string" ? values.RU_LIFE_BASE_URL.trim().replace(/\/$/, "") : "";
  const baseUrl = configuredUrl || DEFAULT_RU_LIFE_BASE_URL;
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(baseUrl) || secret.length < 32) throw new RuLifeBridgeError("Kết nối Hòa nhập Nga chưa được cấu hình.", 503, { code: "RU_LIFE_CONTROL_NOT_CONFIGURED" });
  return { secret, baseUrl };
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

export async function issueRuLifeBrowserBridge(actor: string, role: ControlRole, controlDeviceId: string) {
  const { secret, baseUrl } = await config();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const jti = base64Url(crypto.getRandomValues(new Uint8Array(18)));
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: "application-management", aud: "ru-life-control", app: "hoa-nhap-nga",
    actor: actor.trim().toLowerCase().slice(0, 160), role,
    controlDeviceId: /^[a-f0-9]{64}$/.test(controlDeviceId) ? controlDeviceId : null,
    jti, iat: Date.now(), exp: expiresAt,
  })));
  const signedInput = `v1.${payload}`;
  return { application: "ru-life", baseUrl, token: `${signedInput}.${await hmac(secret, signedInput)}`, expiresAt, ticketId: jti };
}

async function requestRuLife<T>(path: string, actor: string, role: ControlRole, controlDeviceId?: string, init?: { method?: "GET" | "POST"; body?: Record<string, unknown> }): Promise<T> {
  const { secret, baseUrl } = await config();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: init?.method ?? "GET", cache: "no-store",
      headers: { authorization: `Bearer ${secret}`, "x-control-actor": actor.slice(0, 160), "x-control-role": role, "x-control-device": controlDeviceId ?? "", "content-type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null) as T | null;
    if (!response.ok || !data) throw new RuLifeBridgeError("Không đọc/ghi được Control API Hòa nhập Nga.", response.status || 502, data);
    return data;
  } finally { clearTimeout(timeout); }
}

export async function probeRuLifeApplication() {
  return requestRuLife<RuLifeStatus>("/api/control/status", "control-center-system", "viewer");
}

export async function readRuLifeDevices(actor: string, role: ControlRole, controlDeviceId?: string) {
  const data = await requestRuLife<RuLifeDeviceResponse>("/api/control/devices", actor, role, controlDeviceId);
  if (data.application !== "ru-life" || !Array.isArray(data.devices)) throw new RuLifeBridgeError("Danh sách thiết bị Hòa nhập Nga không hợp lệ.", 502, data);
  return data.devices;
}

export async function manageRuLifeDevice(actor: string, role: ControlRole, controlDeviceId: string, device: RuLifeControlDevice, operation: "approve" | "remove") {
  if (operation === "approve" && (!device.userName || !device.userCode)) {
    throw new RuLifeBridgeError("Thiết bị Hòa nhập Nga phải gắn Họ tên và Mã người dùng trong quản trị app trước khi duyệt.", 409, { code: "USER_BINDING_REQUIRED" });
  }
  const body: Record<string, unknown> = { targetDeviceId: device.deviceId, operation: operation === "approve" ? "approve" : "block" };
  if (operation === "approve") { body.userName = device.userName; body.userCode = device.userCode; }
  const data = await requestRuLife<RuLifeDeviceResponse>("/api/control/devices", actor, role, controlDeviceId, { method: "POST", body });
  if (data.application !== "ru-life" || !Array.isArray(data.devices)) throw new RuLifeBridgeError("Hòa nhập Nga không xác nhận thao tác thiết bị.", 502, data);
  return data.devices;
}
