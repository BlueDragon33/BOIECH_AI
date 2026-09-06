import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export type ChatGPTUser = { displayName: string; email: string; fullName: string | null };
const COOKIE = "child_health_editor_session";
const MAX_AGE = 8 * 60 * 60;

function base64Url(bytes: Uint8Array) { let binary = ""; bytes.forEach((byte) => { binary += String.fromCharCode(byte); }); return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
function decode(value: string) { try { const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "="); return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)); } catch { return null; } }
async function secret() { const workers = await import("cloudflare:workers"); const value = (workers.env as unknown as Record<string, unknown>).CONTROL_SERVICE_SECRET; return typeof value === "string" && value.length >= 32 ? value : ""; }
async function sign(value: string) { const valueSecret = await secret(); if (!valueSecret) return ""; const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(valueSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)))); }
async function validSignedToken(token: string) { const [version, encoded, suppliedSignature, extra] = token.split("."); if (version !== "v1" || !encoded || !suppliedSignature || extra) return null; const expected = await sign(`${version}.${encoded}`); if (!expected || expected.length !== suppliedSignature.length) return null; let diff = 0; for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ suppliedSignature.charCodeAt(i); if (diff) return null; const bytes = decode(encoded); if (!bytes) return null; try { return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>; } catch { return null; } }
export async function createEditorSessionFromControlTicket(ticket: string) {
  const bridge = await validSignedToken(ticket);
  const actor = typeof bridge?.actor === "string" ? bridge.actor.trim().toLowerCase() : "";
  const role = typeof bridge?.role === "string" ? bridge.role : "viewer";
  const exp = typeof bridge?.exp === "number" ? bridge.exp : 0;
  if (bridge?.iss !== "quan-ly-hoc-tap" || bridge?.aud !== "child-health-control" || !actor.includes("@") || !["reviewer", "publisher", "owner"].includes(role) || exp <= Date.now()) return null;
  const sessionPayload = base64Url(new TextEncoder().encode(JSON.stringify({ iss: "suc-khoe-tre", aud: "child-health-editor", email: actor, displayName: actor, exp: Date.now() + MAX_AGE * 1000 })));
  const input = `v1.${sessionPayload}`;
  return { token: `${input}.${await sign(input)}`, user: { displayName: actor, email: actor, fullName: null } satisfies ChatGPTUser };
}
async function sessionUser() {
  const token = (await cookies()).get(COOKIE)?.value ?? "";
  const payload = await validSignedToken(token);
  const email = typeof payload?.email === "string" ? payload.email : "";
  const displayName = typeof payload?.displayName === "string" ? payload.displayName : email;
  const exp = typeof payload?.exp === "number" ? payload.exp : 0;
  if (payload?.iss !== "suc-khoe-tre" || payload?.aud !== "child-health-editor" || !email.includes("@") || exp <= Date.now()) return null;
  return { displayName, email, fullName: null } satisfies ChatGPTUser;
}
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  if (email) {
    const encodedName = requestHeaders.get("oai-authenticated-user-full-name");
    let fullName: string | null = null;
    if (encodedName && requestHeaders.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8") { try { fullName = decodeURIComponent(encodedName); } catch { fullName = null; } }
    return { displayName: fullName ?? email, email, fullName };
  }
  return sessionUser();
}
export async function requireChatGPTUser(returnTo: string) { const user = await getChatGPTUser(); if (user) return user; redirect(`/editor-login-required?returnTo=${encodeURIComponent(returnTo.startsWith("/") ? returnTo : "/bien-tap-suc-khoe-tre")}`); }
export function editorSessionCookie(token: string) { return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`; }
