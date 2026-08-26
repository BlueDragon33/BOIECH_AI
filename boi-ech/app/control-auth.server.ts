import { DeviceAccessError } from "./device-auth.server";

const CONTROL_CENTER_ORIGIN = "https://learning-management.boiech-ai.workers.dev";
const TOKEN_AUDIENCE = "boi-ech-control";
const TOKEN_ISSUER = "quan-ly-hoc-tap";

function bytes(value: ArrayBuffer) {
  return new Uint8Array(value);
}

async function digest(value: string) {
  return bytes(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function secureEqual(left: string, right: string) {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 2_048) {
    throw new DeviceAccessError("Vé quản trị không hợp lệ.", 403, "CONTROL_TICKET_INVALID");
  }
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try { return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)); }
  catch { throw new DeviceAccessError("Vé quản trị không hợp lệ.", 403, "CONTROL_TICKET_INVALID"); }
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

async function browserTicket(secret: string, supplied: string) {
  const [version, encoded, suppliedSignature, extra] = supplied.split(".");
  if (version !== "v1" || !encoded || !suppliedSignature || extra) return null;
  const expected = await signature(secret, `${version}.${encoded}`);
  if (!(await secureEqual(expected, suppliedSignature))) return null;
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as Record<string, unknown>; }
  catch { return null; }
  const actor = typeof payload.actor === "string" ? payload.actor.trim().toLowerCase().slice(0, 160) : "";
  const suppliedRole = typeof payload.role === "string" ? payload.role : "viewer";
  const role = ["viewer", "reviewer", "publisher", "owner"].includes(suppliedRole) ? suppliedRole : "viewer";
  const expiresAt = typeof payload.exp === "number" ? payload.exp : 0;
  if (payload.iss !== TOKEN_ISSUER || payload.aud !== TOKEN_AUDIENCE || !actor.includes("@") || expiresAt <= Date.now() || expiresAt > Date.now() + 10 * 60 * 1000) return null;
  return { actor, role };
}

export async function requireControlService(request: Request) {
  const workers = await import("cloudflare:workers");
  const configured = (workers.env as unknown as Record<string, unknown>).CONTROL_SERVICE_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (typeof configured !== "string" || configured.length < 32 || supplied.length < 32) {
    throw new DeviceAccessError("Dịch vụ quản trị không được phép truy cập.", 403, "CONTROL_SERVICE_FORBIDDEN");
  }
  if (!(await secureEqual(configured, supplied))) {
    const ticket = await browserTicket(configured, supplied);
    if (!ticket) throw new DeviceAccessError("Vé quản trị đã hết hạn hoặc không hợp lệ.", 403, "CONTROL_TICKET_FORBIDDEN");
    return ticket;
  }
  const actor = (request.headers.get("x-control-actor") ?? "system").trim().toLowerCase().slice(0, 160);
  const suppliedRole = (request.headers.get("x-control-role") ?? "viewer").trim().toLowerCase();
  const role = ["viewer", "reviewer", "publisher", "owner"].includes(suppliedRole) ? suppliedRole : "viewer";
  return { actor: actor || "system", role };
}

function corsHeaders(request: Request): Record<string, string> {
  return request.headers.get("origin") === CONTROL_CENTER_ORIGIN
    ? {
        "access-control-allow-origin": CONTROL_CENTER_ORIGIN,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "authorization, content-type",
        "access-control-max-age": "600",
        vary: "Origin",
      }
    : {};
}

export function controlResponse(data: unknown, status = 200, request?: Request) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
      ...(request ? corsHeaders(request) : {}),
    },
  });
}

export function controlPreflight(request: Request) {
  if (request.headers.get("origin") !== CONTROL_CENTER_ORIGIN) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function withControlCors(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
