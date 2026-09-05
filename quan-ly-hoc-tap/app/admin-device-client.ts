"use client";

export type ControlRole = "viewer" | "reviewer" | "publisher" | "owner";
export type DeviceStatus = "pending" | "approved" | "blocked";

export type AdminAccess = {
  deviceId: string;
  deviceCode: string;
  email: string;
  displayName: string;
  status: DeviceStatus;
  role: ControlRole;
  label: string | null;
  owner: boolean;
};

export type ApplicationDescriptor = {
  id: string;
  name: string;
  status: "online" | "warning" | "planned";
};

export type ApplicationBridge = {
  baseUrl: string;
  token: string;
  expiresAt: number;
};

export type AdminBootstrap = {
  actor: AdminAccess;
  applications: ApplicationDescriptor[];
  boiBridge: ApplicationBridge;
  upstreamError?: string | null;
};

type Credential = { version: 1; privateKey: CryptoKey | null; publicKey: JsonWebKey };
type ApiPayload = Partial<AdminBootstrap> & { device?: AdminAccess; challenge?: string; error?: string; code?: string };

export class AdminApiError extends Error {
  data: ApiPayload;
  constructor(message: string, data: ApiPayload) {
    super(message);
    this.data = data;
  }
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("learning-control-device", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("credential")) request.result.createObjectStore("credential");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCredential() {
  const db = await openDb();
  return new Promise<Credential | undefined>((resolve, reject) => {
    const request = db.transaction("credential", "readonly").objectStore("credential").get("primary");
    request.onsuccess = () => resolve(request.result as Credential | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function writeCredential(value: Credential) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction("credential", "readwrite").objectStore("credential").put(value, "primary");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function credentialForDevice() {
  const current = await readCredential();
  if (current?.version === 1 && current.publicKey && current.privateKey) return current;
  const generated = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const publicKey = await crypto.subtle.exportKey("jwk", generated.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", generated.privateKey);
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const credential = { version: 1, privateKey, publicKey } satisfies Credential;
  await writeCredential(credential);
  return credential;
}

async function jsonApi(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({ error: "Phản hồi quản trị không hợp lệ." })) as ApiPayload;
  if (!response.ok) throw new AdminApiError(data.error ?? "Không thể kết nối dịch vụ quản trị.", data);
  return data;
}

async function register(credential: Credential) {
  const data = await jsonApi("/api/device", { action: "register", publicKey: credential.publicKey });
  if (!data.device) throw new AdminApiError("Máy chủ chưa trả về trạng thái thiết bị quản trị.", data);
  return data.device;
}

async function proof(credential: Credential, access: AdminAccess) {
  const challenge = await jsonApi("/api/device", { action: "challenge", deviceId: access.deviceId });
  if (!challenge.challenge || !credential.privateKey) throw new AdminApiError("Không thể tạo thử thách thiết bị.", challenge);
  const message = new TextEncoder().encode(`learning-control:${access.deviceId}:${challenge.challenge}`);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message);
  return { deviceId: access.deviceId, challenge: challenge.challenge, signature: base64Url(new Uint8Array(signature)) };
}

async function secureApi(path: string, credential: Credential, access: AdminAccess, body: Record<string, unknown>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await jsonApi(path, { ...body, ...await proof(credential, access) });
    } catch (error) {
      lastError = error;
      if (!(error instanceof AdminApiError) || error.data.code !== "DEVICE_PROOF_EXPIRED") throw error;
    }
  }
  throw lastError;
}

export async function connectAdminDevice() {
  const credential = await credentialForDevice();
  const access = await register(credential);
  if (access.status !== "approved") return { access, bootstrap: null as AdminBootstrap | null };
  const bootstrap = await secureApi("/api/dashboard", credential, access, { action: "bootstrap" }) as AdminBootstrap;
  return { access, bootstrap };
}

export async function upstreamJson<T>(bridge: ApplicationBridge, path: string, init?: { method?: "GET" | "POST"; body?: Record<string, unknown>; query?: string }) {
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(bridge.baseUrl) || !bridge.token.startsWith("v1.")) {
    throw new Error("Vé kết nối ứng dụng không hợp lệ.");
  }
  if (!/^\/api\/control\/[a-z0-9-]+$/i.test(path)) throw new Error("Đường dẫn quản trị ứng dụng không hợp lệ.");
  const response = await fetch(`${bridge.baseUrl}${path}${init?.query ?? ""}`, {
    method: init?.method ?? "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    headers: { authorization: `Bearer ${bridge.token}`, "content-type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await response.json().catch(() => ({ error: "Phản hồi ứng dụng không hợp lệ." })) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Không thể kết nối ứng dụng.");
  return data as T;
}

export const roleLabels: Record<ControlRole, string> = {
  viewer: "Chỉ xem",
  reviewer: "Kiểm duyệt viên",
  publisher: "Người xuất bản",
  owner: "Chủ hệ thống",
};
