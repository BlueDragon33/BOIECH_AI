import type { ControlRole } from "./control-device.server";

const HEALTH_BASE_URL = "https://suc-khoe-tre.boiech-ai.workers.dev";

export class HealthBridgeError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export type HealthApplicationProbe = {
  application: "child-health";
  contractVersion: number;
  service: "online" | "paused";
  serverTime: string;
  devices: { total: number; pending: number; approved: number; blocked: number };
  sessions: { total: number; active: number; revoked: number; expired: number };
};

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function controlSecret() {
  const workers = await import("cloudflare:workers");
  const values = workers.env as unknown as Record<string, unknown>;
  const secret = typeof values.CONTROL_SERVICE_SECRET === "string" ? values.CONTROL_SERVICE_SECRET : "";
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(HEALTH_BASE_URL) || secret.length < 32) {
    throw new HealthBridgeError("Kết nối Sức khỏe Y tế chưa được cấu hình.", 503, { code: "CHILD_HEALTH_NOT_CONFIGURED" });
  }
  return secret;
}

async function signature(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64Url(new Uint8Array(signed));
}

export async function issueHealthBrowserBridge(actor: string, role: ControlRole, controlDeviceId: string) {
  const secret = await controlSecret();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const jti = base64Url(crypto.getRandomValues(new Uint8Array(18)));
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: "quan-ly-hoc-tap",
    aud: "child-health-control",
    app: "child-health",
    actor: actor.trim().toLowerCase().slice(0, 160),
    role,
    controlDeviceId: /^[a-f0-9]{64}$/.test(controlDeviceId) ? controlDeviceId : null,
    jti,
    iat: Date.now(),
    exp: expiresAt,
  })));
  const signedInput = `v1.${payload}`;
  return {
    application: "child-health" as const,
    baseUrl: HEALTH_BASE_URL,
    token: `${signedInput}.${await signature(secret, signedInput)}`,
    expiresAt,
    ticketId: jti,
  };
}

export async function probeHealthApplication(): Promise<HealthApplicationProbe> {
  const secret = await controlSecret();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${HEALTH_BASE_URL}/api/control/status`, {
      method: "GET",
      cache: "no-store",
      headers: {
        authorization: `Bearer ${secret}`,
        "x-control-actor": "control-center-system",
        "x-control-role": "viewer",
      },
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null) as HealthApplicationProbe | null;
    if (!response.ok || !data || data.application !== "child-health") {
      throw new HealthBridgeError("Không đọc được trạng thái Sức khỏe Y tế.", response.status || 502, data);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}
