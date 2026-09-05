import { cookies } from "next/headers";
import type { ChatGPTUser } from "./chatgpt-auth";

const SESSION_COOKIE = "learning_admin_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

type SessionPayload = {
  v: 1;
  email: string;
  displayName: string;
  exp: number;
};

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function envValue(name: string) {
  const workers = await import("cloudflare:workers");
  const value = (workers.env as unknown as Record<string, unknown>)[name];
  return typeof value === "string" ? value : "";
}

async function sessionSecret() {
  const value = await envValue("ADMIN_SESSION_SECRET");
  return value.length >= 32 ? value : "";
}

async function hmac(value: string) {
  const secret = await sessionSecret();
  if (!secret) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index];
  return diff === 0;
}

function hexToBytes(value: string) {
  if (!/^[a-f0-9]+$/i.test(value) || value.length % 2 !== 0) return null;
  const result = new Uint8Array(value.length / 2);
  for (let index = 0; index < result.length; index += 1) result[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return result;
}

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function decodeHash(value: string) {
  const hex = hexToBytes(value);
  if (hex) return hex;
  return base64UrlToBytes(value);
}

export async function adminPasswordScheme() {
  const configured = await envValue("ADMIN_PASSWORD_HASH");
  if (/^(?:sha256:)?[a-f0-9]{64}$/i.test(configured)) return "sha256" as const;
  if (/^pbkdf2-sha256:\d+:[A-Za-z0-9_-]{8,}:[A-Za-z0-9_-]{20,}$/i.test(configured)) return "pbkdf2-sha256" as const;
  return configured ? "unsupported" as const : "missing" as const;
}

export async function verifyAdminPassword(password: string) {
  if (!password || password.length > 256) return false;
  const configured = await envValue("ADMIN_PASSWORD_HASH");
  const scheme = await adminPasswordScheme();

  if (scheme === "sha256") {
    const expected = hexToBytes(configured.replace(/^sha256:/i, ""));
    return expected ? constantTimeEqual(await sha256(password), expected) : false;
  }

  if (scheme === "pbkdf2-sha256") {
    const [, iterationsText, saltText, hashText] = configured.split(":");
    const iterations = Number(iterationsText);
    const salt = base64UrlToBytes(saltText);
    const expected = decodeHash(hashText);
    if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 2_000_000 || !salt || !expected || expected.length < 24) return false;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, expected.length * 8));
    return constantTimeEqual(derived, expected);
  }

  return false;
}

async function ownerIdentity(): Promise<ChatGPTUser | null> {
  const value = await envValue("CONTROL_OWNER_EMAILS");
  const email = value.split(",").map((item) => item.trim().toLowerCase()).find((item) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item));
  if (!email) return null;
  return { email, displayName: "Chủ hệ thống", fullName: null };
}

export async function createAdminSession() {
  const identity = await ownerIdentity();
  if (!identity) return null;
  const payload: SessionPayload = { v: 1, email: identity.email, displayName: identity.displayName, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 };
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmac(body);
  if (!signature) return null;
  return `${body}.${bytesToBase64Url(signature)}`;
}

export async function getAdminSessionUser(): Promise<ChatGPTUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? "";
  const [body, signatureText, extra] = token.split(".");
  if (!body || !signatureText || extra) return null;
  const expected = await hmac(body);
  const signature = base64UrlToBytes(signatureText);
  if (!expected || !signature || !constantTimeEqual(expected, signature)) return null;
  const bytes = base64UrlToBytes(body);
  if (!bytes) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SessionPayload>;
    if (payload.v !== 1 || typeof payload.email !== "string" || typeof payload.displayName !== "string" || typeof payload.exp !== "number" || payload.exp <= Date.now()) return null;
    const owner = await ownerIdentity();
    if (!owner || owner.email !== payload.email) return null;
    return { email: payload.email, displayName: payload.displayName, fullName: null };
  } catch {
    return null;
  }
}

export function adminSessionCookie(value: string) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

export function clearAdminSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
