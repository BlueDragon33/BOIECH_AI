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
  calendarEnabled: boolean;
};
type AccessPolicy = {
  accessEnabled: boolean;
  pendingPollSeconds: number;
  heartbeatSeconds: number;
  sessionTimeoutSeconds: number;
  sessionTtlMinutes: number;
  systemNoticeEnabled: boolean;
  systemNotice: string | null;
  updatedBy?: string | null;
  updatedAt?: string;
};
type AccessSession = {
  sessionId: string;
  deviceId: string;
  status: "active" | "revoked" | "expired";
  startedAt?: string;
  lastSeenAt?: string;
  expiresAt: number;
};
type Credential = { version: 1; privateKey: CryptoKey | null; publicKey: JsonWebKey };
type ApiPayload = {
  device?: DeviceState;
  challenge?: string;
  course?: HealthCourseDocument;
  policy?: AccessPolicy;
  session?: AccessSession;
  error?: string;
  code?: string;
};

const DEFAULT_POLICY: AccessPolicy = {
  accessEnabled: true,
  pendingPollSeconds: 60,
  heartbeatSeconds: 60,
  sessionTimeoutSeconds: 180,
  sessionTtlMinutes: 720,
  systemNoticeEnabled: false,
  systemNotice: null,
};

const SESSION_STOP_CODES = new Set([
  "DEVICE_BLOCKED",
  "DEVICE_PENDING",
  "APPLICATION_ACCESS_DISABLED",
  "ACCESS_SESSION_REVOKED",
  "ACCESS_SESSION_EXPIRED",
  "ACCESS_SESSION_MISMATCH",
  "ACCESS_SESSION_INVALID",
]);

class ApiError extends Error {
  data: ApiPayload;
  constructor(message: string, data: ApiPayload) { super(message); this.data = data; }
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function boundedSeconds(value: number | undefined, fallback: number, minimum: number) {
  return Number.isFinite(value) ? Math.max(minimum, Math.min(300, Math.round(value ?? fallback))) : fallback;
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
  return data;
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
  const [session, setSession] = useState<AccessSession | null>(null);
  const [policy, setPolicy] = useState<AccessPolicy>(DEFAULT_POLICY);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [gateCode, setGateCode] = useState("");
  const loadingCourse = useRef(false);

  const stopSession = useCallback((message: string, code = "") => {
    setCourse(null);
    setSession(null);
    setGateCode(code);
    setError(message);
  }, []);

  const loadCourse = useCallback(async (currentCredential: Credential, currentDevice: DeviceState) => {
    if (loadingCourse.current) return;
    loadingCourse.current = true;
    try {
      const data = await api("/api/site/course", await proof(currentCredential, currentDevice));
      if (!data.course || !data.session) throw new ApiError("Không tạo được phiên truy cập Sức khỏe Y tế.", data);
      setDevice(data.device ?? currentDevice);
      setCourse(data.course);
      setSession(data.session);
      if (data.policy) setPolicy(data.policy);
      setGateCode("");
      setError("");
    } finally { loadingCourse.current = false; }
  }, []);

  const initialize = useCallback(async () => {
    setBusy(true);
    setError("");
    setGateCode("");
    try {
      const key = await credentialForDevice();
      setCredential(key);
      const registration = await register(key);
      setDevice(registration.device ?? null);
      if (registration.policy) setPolicy(registration.policy);
      if (registration.device?.status === "approved") await loadCourse(key, registration.device);
      else {
        setCourse(null);
        setSession(null);
      }
    } catch (caught) {
      const failure = caught instanceof ApiError ? caught : null;
      if (failure?.data.device) setDevice(failure.data.device);
      if (failure?.data.policy) setPolicy(failure.data.policy);
      setCourse(null);
      setSession(null);
      setGateCode(failure?.data.code ?? "");
      setError(caught instanceof Error ? caught.message : "Không thể xác thực thiết bị.");
    } finally { setBusy(false); }
  }, [loadCourse]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void initialize(); }, 0);
    return () => window.clearTimeout(timer);
  }, [initialize]);

  useEffect(() => {
    if (!credential || device?.status !== "pending") return;
    const seconds = boundedSeconds(policy.pendingPollSeconds, 60, 15);
    const timer = window.setInterval(() => {
      register(credential).then((registration) => {
        if (registration.policy) setPolicy(registration.policy);
        if (!registration.device) return;
        setDevice(registration.device);
        if (registration.device.status === "approved") void loadCourse(credential, registration.device);
      }).catch(() => undefined);
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [credential, device?.status, loadCourse, policy.pendingPollSeconds]);

  useEffect(() => {
    if (!credential || device?.status !== "approved" || !course || !session) return;
    const currentDevice = device;
    const currentSessionId = session.sessionId;
    const seconds = boundedSeconds(policy.heartbeatSeconds, 60, 30);
    const timer = window.setInterval(async () => {
      try {
        const data = await api("/api/device", { action: "presence", sessionId: currentSessionId, ...await proof(credential, currentDevice) });
        if (data.device) setDevice(data.device);
        if (data.session) setSession(data.session);
        if (data.policy) setPolicy(data.policy);
        setGateCode("");
        setError("");
      } catch (caught) {
        if (!(caught instanceof ApiError)) return;
        if (caught.data.device) setDevice(caught.data.device);
        if (caught.data.policy) setPolicy(caught.data.policy);
        const code = caught.data.code ?? "";
        if (SESSION_STOP_CODES.has(code)) stopSession(caught.message, code);
      }
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [credential, device, course, session, policy.heartbeatSeconds, stopSession]);

  const notice = policy.systemNoticeEnabled && policy.systemNotice ? policy.systemNotice : null;

  if (course && session && device?.status === "approved" && policy.accessEnabled) {
    return <>
      <div className="health-device-strip"><span>{typeLabels[device.deviceType]}</span><strong>{device.deviceCode}</strong><small>{device.browser ?? "Trình duyệt"} · {device.calendarEnabled ? "Calendar được cấp" : "Calendar khóa"} · {device.editEnabled ? "Được cấp quyền sửa" : "Chỉ sử dụng"}</small></div>
      {notice ? <div className="health-policy-notice"><strong>Thông báo hệ thống</strong><span>{notice}</span></div> : null}
      <HealthClient initialCourse={course} device={{ deviceCode: device.deviceCode, deviceType: device.deviceType, editEnabled: device.editEnabled, calendarEnabled: device.calendarEnabled }} />
    </>;
  }

  const heading = device?.status === "blocked"
    ? "Thiết bị này đã bị khóa."
    : device?.status === "pending"
      ? "Thiết bị đang chờ Trung tâm cấp quyền."
      : gateCode === "APPLICATION_ACCESS_DISABLED"
        ? "Sức khỏe Y tế đang tạm dừng truy cập."
        : gateCode === "ACCESS_SESSION_REVOKED"
          ? "Phiên truy cập đã được Trung tâm thu hồi."
          : gateCode === "ACCESS_SESSION_EXPIRED"
            ? "Phiên truy cập đã hết hạn."
            : "Đang kiểm tra quyền truy cập…";

  return <main className="health-access-shell"><section className="health-access-card">
    <div className="health-access-seal">SK</div>
    <span className="health-access-eyebrow">Sức khỏe Y tế · thiết bị độc lập</span>
    <h1>{heading}</h1>
    <p>{error || "Mỗi thiết bị có khóa riêng. Trung tâm chỉ cấp quyền truy cập, phiên và các quyền tính năng; dữ liệu sức khỏe cá nhân vẫn thuộc Web App Sức khỏe Y tế."}</p>
    {notice ? <div className="health-policy-notice in-gate"><strong>Thông báo hệ thống</strong><span>{notice}</span></div> : null}
    {device ? <div className="health-access-device"><div><span>Loại thiết bị</span><strong>{typeLabels[device.deviceType]}</strong></div><div><span>Mã thiết bị</span><strong>{device.deviceCode}</strong></div><small>{device.platform || "Không xác định nền tảng"} · {device.browser || "Không xác định trình duyệt"}</small></div> : null}
    <button className="health-access-button" onClick={() => void initialize()} disabled={busy}>{busy ? "Đang kiểm tra…" : device?.status === "approved" ? "Kiểm tra và tạo phiên mới" : "Kiểm tra lại quyền"}</button>
    <small className="health-access-note">Thiết bị chờ duyệt được kiểm tra theo chính sách Trung tâm · hiện tại {boundedSeconds(policy.pendingPollSeconds, 60, 15)} giây/lần.</small>
  </section></main>;
}
