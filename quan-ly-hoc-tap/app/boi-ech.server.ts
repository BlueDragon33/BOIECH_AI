import type { ControlRole } from "./control-device.server";

export class UpstreamError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function configuration() {
  const workers = await import("cloudflare:workers");
  const values = workers.env as unknown as Record<string, unknown>;
  const baseUrl = typeof values.BOI_ECH_BASE_URL === "string" ? values.BOI_ECH_BASE_URL.replace(/\/$/, "") : "";
  const secret = typeof values.CONTROL_SERVICE_SECRET === "string" ? values.CONTROL_SERVICE_SECRET : "";
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(baseUrl) || secret.length < 32) {
    throw new UpstreamError("Kết nối Bơi ếch chưa được cấu hình.", 503, { code: "BOI_ECH_NOT_CONFIGURED" });
  }
  return { baseUrl, secret };
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
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

export async function issueBoiBrowserBridge(actor: string, role: ControlRole) {
  const { baseUrl, secret } = await configuration();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: "quan-ly-hoc-tap",
    aud: "boi-ech-control",
    actor: actor.trim().toLowerCase().slice(0, 160),
    role,
    exp: expiresAt,
  })));
  const signedInput = `v1.${payload}`;
  return { baseUrl, token: `${signedInput}.${await signature(secret, signedInput)}`, expiresAt };
}
