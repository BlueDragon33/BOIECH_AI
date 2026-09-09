import type { ControlRole } from "./control-device.server";

const DEFAULT_BAUMAN_BASE_URL = "https://bauman-control-service.workers.dev";

type BaumanReadiness = {
  runtime?: string;
  subclientInventory?: string;
  readOnlyControlApi?: string;
  deviceRegistry?: string;
  deviceGateway?: string;
  auditApi?: string;
  contentReviewApi?: string;
};

export class BaumanBridgeError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export type BaumanControlStatus = {
  ok: boolean;
  application: "bauman-master-ai";
  protocol: "bauman-control-v1";
  actorRole?: ControlRole;
  ownership?: {
    runtime?: string;
    subclients?: string;
    centralRole?: string;
  };
  readiness?: BaumanReadiness;
  counts?: {
    subclients?: number;
    independentSites?: number;
    modules?: number;
    devices?: number;
    pendingDevices?: number;
    approvedDevices?: number;
    blockedDevices?: number;
    activeSessions?: number;
  };
  capabilities?: readonly string[];
  buildRevision?: string | null;
  buildSource?: string | null;
  checkedAt?: number;
};

export type BaumanSubclient = {
  id: string;
  name: string;
  kind: string;
  repository?: string;
  sourcePath?: string;
  state: string;
  controlState: string;
};

export type BaumanSubclientResponse = {
  ok: boolean;
  application: "bauman-master-ai";
  subclients: BaumanSubclient[];
};

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function bridgeConfig() {
  const workers = await import("cloudflare:workers");
  const values = workers.env as unknown as Record<string, unknown>;
  const secret = typeof values.BAUMAN_CONTROL_SERVICE_SECRET === "string" ? values.BAUMAN_CONTROL_SERVICE_SECRET : "";
  const configuredUrl = typeof values.BAUMAN_CONTROL_BASE_URL === "string" ? values.BAUMAN_CONTROL_BASE_URL.trim() : "";
  const baseUrl = configuredUrl || DEFAULT_BAUMAN_BASE_URL;
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(baseUrl) || secret.length < 32) {
    throw new BaumanBridgeError("Kết nối Bauman Master AI chưa được cấu hình.", 503, { code: "BAUMAN_CONTROL_NOT_CONFIGURED" });
  }
  return { secret, baseUrl };
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

export async function issueBaumanBrowserBridge(actor: string, role: ControlRole, controlDeviceId: string) {
  const { secret, baseUrl } = await bridgeConfig();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: "application-management",
    aud: "bauman-control",
    app: "bauman-master-ai",
    actor: actor.trim().toLowerCase().slice(0, 160),
    role,
    controlDeviceId: /^[a-f0-9]{64}$/.test(controlDeviceId) ? controlDeviceId : null,
    iat: Date.now(),
    exp: expiresAt,
  })));
  const signedInput = `v1.${payload}`;
  return { application: "bauman-master-ai", baseUrl, token: `${signedInput}.${await signature(secret, signedInput)}`, expiresAt };
}

async function requestBauman<T>(path: string): Promise<T> {
  const { secret, baseUrl } = await bridgeConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        authorization: `Bearer ${secret}`,
        "x-control-actor": "control-center-system",
        "x-control-role": "viewer",
      },
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null) as T | null;
    if (!response.ok || !data) {
      throw new BaumanBridgeError("Không đọc được trạng thái Bauman Master AI.", response.status || 502, data);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function probeBaumanApplication() {
  const data = await requestBauman<BaumanControlStatus>("/api/control/status");
  if (!data.ok || data.application !== "bauman-master-ai" || data.protocol !== "bauman-control-v1") {
    throw new BaumanBridgeError("Control API trả sai danh tính Bauman Master AI.", 502, data);
  }
  return data;
}

export async function readBaumanSubclients() {
  const data = await requestBauman<BaumanSubclientResponse>("/api/control/subclients");
  if (!data.ok || data.application !== "bauman-master-ai" || !Array.isArray(data.subclients)) {
    throw new BaumanBridgeError("Không đọc được danh sách sub-client Bauman.", 502, data);
  }
  return data.subclients;
}