export type GoogleAdminIdentity = {
  email: string;
  displayName: string;
  subject: string;
};

type GoogleJwtHeader = {
  alg?: unknown;
  kid?: unknown;
  typ?: unknown;
};

type GoogleJwtPayload = {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  iat?: unknown;
  nbf?: unknown;
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
};

type GoogleJwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

type GoogleJwks = { keys?: GoogleJwk[] };

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const MAX_TOKEN_BYTES = 16_384;
const CLOCK_SKEW_SECONDS = 120;

async function envValue(name: string) {
  const workers = await import("cloudflare:workers");
  const value = (workers.env as unknown as Record<string, unknown>)[name];
  return typeof value === "string" ? value.trim() : "";
}

function normalizedEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

async function allowedOwnerEmails() {
  const configured = await envValue("CONTROL_OWNER_EMAILS");
  return configured.split(",").map((item) => normalizedEmail(item)).filter(Boolean);
}

function base64UrlToBytes(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function decodeJson<T>(segment: string): T | null {
  const bytes = base64UrlToBytes(segment);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

function validAudience(value: unknown, clientId: string) {
  if (typeof value === "string") return value === clientId;
  if (Array.isArray(value)) return value.some((item) => item === clientId);
  return false;
}

async function fetchGoogleKey(kid: string) {
  const response = await fetch(GOOGLE_JWKS_URL, {
    headers: { accept: "application/json" },
    cf: { cacheTtl: 3600, cacheEverything: true },
  } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });
  if (!response.ok) return null;
  const jwks = await response.json() as GoogleJwks;
  return jwks.keys?.find((key) => key.kid === kid && (!key.alg || key.alg === "RS256")) ?? null;
}

export async function googleClientId() {
  const value = await envValue("GOOGLE_CLIENT_ID");
  return /^[0-9A-Za-z._-]+\.apps\.googleusercontent\.com$/.test(value) ? value : "";
}

export async function googleAuthReady() {
  return Boolean(await googleClientId());
}

export async function verifyGoogleAdminCredential(credential: string): Promise<GoogleAdminIdentity | null> {
  if (!credential || credential.length > MAX_TOKEN_BYTES) return null;
  const [headerRaw, payloadRaw, signatureRaw, extra] = credential.split(".");
  if (!headerRaw || !payloadRaw || !signatureRaw || extra) return null;

  const header = decodeJson<GoogleJwtHeader>(headerRaw);
  const payload = decodeJson<GoogleJwtPayload>(payloadRaw);
  if (!header || !payload || header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) return null;

  const clientId = await googleClientId();
  if (!clientId || !validAudience(payload.aud, clientId)) return null;
  if (typeof payload.iss !== "string" || !GOOGLE_ISSUERS.has(payload.iss)) return null;
  if (payload.email_verified !== true) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  const iat = typeof payload.iat === "number" ? payload.iat : 0;
  const nbf = typeof payload.nbf === "number" ? payload.nbf : 0;
  if (!exp || exp < nowSeconds - CLOCK_SKEW_SECONDS || exp > nowSeconds + 7200) return null;
  if (iat && iat > nowSeconds + CLOCK_SKEW_SECONDS) return null;
  if (nbf && nbf > nowSeconds + CLOCK_SKEW_SECONDS) return null;

  const email = normalizedEmail(payload.email);
  const subject = typeof payload.sub === "string" && payload.sub.length <= 128 ? payload.sub : "";
  if (!email || !subject) return null;

  const owners = await allowedOwnerEmails();
  if (!owners.includes(email)) return null;

  const signature = base64UrlToBytes(signatureRaw);
  const jwk = await fetchGoogleKey(header.kid);
  if (!signature || !jwk) return null;

  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signature,
      new TextEncoder().encode(`${headerRaw}.${payloadRaw}`),
    );
    if (!verified) return null;
  } catch {
    return null;
  }

  const displayName = typeof payload.name === "string" && payload.name.trim()
    ? payload.name.trim().slice(0, 160)
    : email.split("@")[0] || email;
  return { email, displayName, subject };
}
