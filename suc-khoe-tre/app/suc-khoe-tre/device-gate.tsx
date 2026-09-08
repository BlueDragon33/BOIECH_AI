"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HealthCourseDocument } from "../health-content.server";
import HealthClient from "./health-client";

type DeviceStatus = "pending" | "approved" | "blocked";
type DeviceType = "desktop" | "phone" | "tablet";
type DeviceState = {
  deviceId: string;
  deviceCode: string;
  status: DeviceStatus;
  deviceType: DeviceType;
  platform: string | null;
  browser: string | null;
  label: string | null;
  editEnabled: boolean;
};
type Credential = { version: 1; privateKey: CryptoKey | null; publicKey: JsonWebKey };
type ApiPayload = { device?: DeviceState; challenge?: string; course?: HealthCourseDocument; error?: string; code?: string };

class ApiError extends Error {
  data: ApiPayload;
  constructor(message: string, data: ApiPayload) { super(message); this.data = data; }
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("child-health-access-device", 1);
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
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const publicKey = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const credential = { version: 1, privateKey, publicKey } satisfies Credential;
  await writeCredential(credential);
  return credential;
}

function deviceMetadata() {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean; platform?: string } };
  return {
    userAgent: navigator.userAgent,
    platform: nav.userAgentData?.platform || navigator.platform || "",
    mobile: nav.userAgentData?.mobile === true,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  };
}

async function api(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({ error: "Phản hồi máy chủ không hợp lệ." })) as ApiPayload;
  if (!response.ok) throw new ApiError(data.error ?? "Không thể xác thực thiết bị.", data);
  return data;
}

async function register(credential: Credential) {
  const data = await api("/api/device", { action: "register", publicKey: credential.publicKey, metadata: deviceMetadata() });
  if (!data.device) throw new ApiError("Máy chủ chưa trả về trạng thái thiết bị.", data);
  return data.device;
}

async function proof(credential: Credential, device: DeviceState) {
  const challenge = await api("/api/device", { action: "challenge", deviceId: device.deviceId });
  if (!challenge.challenge || !credential.privateKey) throw new ApiError("Không thể tạo phiên xác thực thiết bị.", challenge);
  const message = new TextEncoder().encode(`child-health-device:${device.deviceId}:${challenge.challenge}`);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message);
  return { deviceId: device.deviceId, challenge: challenge.challenge, signature: base64Url(new Uint8Array(signature)) };
}

const typeLabels: Record<DeviceType, string> = { desktop: "Máy tính", phone: "Điện thoại", tablet: "Máy tính bảng / iPad" };

export default function HealthDeviceGate() {
  const [credential, setCredential] = useState<Credential | null>(null);
  const [device, setDevice] = useState<DeviceState | null>(null);
  const [course, setCourse] = useState<HealthCourseDocument | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const loadingCourse = useRef(false);

  const loadCourse = useCallback(async (currentCredential: Credential, currentDevice: DeviceState) => {
    if (loadingCourse.current) return;
    loadingCourse.current = true;
    try {
      const data = await api("/api/site/course", await proof(currentCredential, currentDevice));
      if (!data.course) throw new ApiError("Không tải được nội dung Sức khỏe Y tế.", data);
      setDevice(data.device ?? currentDevice);
      setCourse(data.course);
      setError("");
    } finally { loadingCourse.current = false; }
  }, []);

  const initialize = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const key = await credentialForDevice();
      setCredential(key);
      const state = await register(key);
      setDevice(state);
      if (state.status === "approved") await loadCourse(key, state);
    } catch (caught) {
      const failure = caught instanceof ApiError ? caught : null;
      if (failure?.data.device) setDevice(failure.data.device);
      setError(caught instanceof Error ? caught.message : "Không thể xác thực thiết bị.");
    } finally { setBusy(false); }
  }, [loadCourse]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void initialize(); }, 0);
    return () => window.clearTimeout(timer);
  }, [initialize]);

  useEffect(() => {
    if (!credential || device?.status !== "pending") return;
    const timer = window.setInterval(() => {
      register(credential).then((state) => {
        setDevice(state);
        if (state.status === "approved") void loadCourse(credential, state);
      }).catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [credential, device?.status, loadCourse]);

  useEffect(() => {
    if (!credential || device?.status !== "approved" || !course) return;
    const currentDevice = device;
    const timer = window.setInterval(async () => {
      try {
        const data = await api("/api/device", { action: "presence", ...await proof(credential, currentDevice) });
        if (data.device) setDevice(data.device);
      } catch (caught) {
        if (caught instanceof ApiError && caught.data.device) setDevice(caught.data.device);
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [credential, device, course]);

  if (course && device?.status === "approved") {
    return <><div className="health-device-strip"><span>{typeLabels[device.deviceType]}</span><strong>{device.deviceCode}</strong><small>{device.browser ?? "Trình duyệt"} · {device.editEnabled ? "Được cấp quyền sửa" : "Chỉ sử dụng"}</small></div><HealthClient initialCourse={course} /></>;
  }

  return <main className="health-access-shell"><section className="health-access-card">
    <div className="health-access-seal">SK</div>
    <span className="health-access-eyebrow">Sức khỏe Y tế · thiết bị độc lập</span>
    <h1>{device?.status === "blocked" ? "Thiết bị này đã bị khóa." : device?.status === "pending" ? "Thiết bị đang chờ Trung tâm cấp quyền." : "Đang nhận diện thiết bị…"}</h1>
    <p>{error || "Mỗi thiết bị có khóa riêng. Trung tâm chỉ cấp quyền truy cập và quyền chỉnh sửa; dữ liệu sức khỏe cá nhân vẫn thuộc Web App Sức khỏe Y tế."}</p>
    {device ? <div className="health-access-device"><div><span>Loại thiết bị</span><strong>{typeLabels[device.deviceType]}</strong></div><div><span>Mã thiết bị</span><strong>{device.deviceCode}</strong></div><small>{device.platform || "Không xác định nền tảng"} · {device.browser || "Không xác định trình duyệt"}</small></div> : null}
    <button className="health-access-button" onClick={() => void initialize()} disabled={busy}>{busy ? "Đang kiểm tra…" : "Kiểm tra lại quyền"}</button>
    <small className="health-access-note">Thiết bị chờ duyệt được kiểm tra tự động mỗi 60 giây.</small>
  </section></main>;
}
