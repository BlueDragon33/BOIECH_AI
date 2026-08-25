"use client";

/* Ảnh đã được tối ưu sẵn thành WebP cục bộ; giữ URL do máy chủ cấp. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import AiLearningHub, { type AiApiResponse } from "./ai-learning-hub";
import LocalContentStudio from "./local-content-studio";
import OfflineStudyCoach, { type OfflineStudyStats } from "./offline-study-coach";
import {
  LESSON_PARTS,
  canSubmitLesson,
  courseProgressKey,
  firstMissingPrerequisite,
  normalizeCompletedProgress,
} from "./course-logic";
import { defaultLessonOutlines } from "./course-outline-data";
import type {
  LessonContentPayload,
  LessonVisual,
  LessonVisualSet,
  LessonOutline,
  PublicFoundationDetail,
  PublicQuestion,
  ServerCourseState,
} from "./course-types";

type SectionId =
  | "tong-quan"
  | "hoc-tap"
  | "thuc-hanh"
  | "phan-tich"
  | "on-tap"
  | "kiem-tra"
  | "ai-hoc-tap"
  | "du-lieu";

type ProgressState = {
  completed: string[];
  answers: Record<number, number>;
  lessonAnswers: Record<string, number>;
  lessonFlags: Record<string, number[]>;
  lessonChecked: Record<string, number[]>;
  lessonSubmitted: string[];
  flags: number[];
  checked: number[];
  submitted: boolean;
};

const initialProgress: ProgressState = {
  completed: [],
  answers: {},
  lessonAnswers: {},
  lessonFlags: {},
  lessonChecked: {},
  lessonSubmitted: [],
  flags: [],
  checked: [],
  submitted: false,
};

const navItems: { id: SectionId; label: string; hint: string }[] = [
  { id: "tong-quan", label: "Tổng quan", hint: "Lộ trình học" },
  { id: "hoc-tap", label: "Học tập", hint: "Nội dung cốt lõi" },
  { id: "thuc-hanh", label: "Thực hành", hint: "Bài tập theo 8 bài" },
  { id: "phan-tich", label: "Phân tích", hint: "Phân tích theo từng bài" },
  { id: "on-tap", label: "Ôn tập", hint: "Sửa lỗi theo từng bài" },
  { id: "kiem-tra", label: "Kiểm tra", hint: "Tự kiểm cuối mỗi bài" },
  { id: "ai-hoc-tap", label: "Frog AI", hint: "Trợ giảng cá nhân" },
  { id: "du-lieu", label: "Dữ liệu", hint: "Tiến độ cá nhân" },
];

const learningFlow: {
  id: Exclude<SectionId, "tong-quan" | "ai-hoc-tap" | "du-lieu">;
  label: string;
  purpose: string;
  checkpoint: string;
}[] = [
  { id: "hoc-tap", label: "Học", purpose: "Hiểu mục tiêu và thao tác đúng", checkpoint: "Nói lại được điểm chính" },
  { id: "thuc-hanh", label: "Thực hành", purpose: "Tập từ trên cạn xuống dưới nước", checkpoint: "Làm đúng tiêu chí an toàn" },
  { id: "phan-tich", label: "Phân tích", purpose: "Quan sát một lỗi quan trọng mỗi lần", checkpoint: "Xác định đúng nguyên nhân" },
  { id: "on-tap", label: "Ôn tập", purpose: "Sửa lỗi rồi lặp lại động tác", checkpoint: "Thực hiện ổn định hơn lần trước" },
  { id: "kiem-tra", label: "Kiểm tra", purpose: "Tự kiểm 10 câu sau khi đủ bốn phần", checkpoint: "Đạt tối thiểu 8/10" },
];

const roadmapGroups = [
  { number: "01", title: "Nền tảng an toàn", note: "Làm quen nước, kiểm soát thở và tạo tư thế lướt trước khi học động tác tạo lực.", lessons: ["01", "02"] },
  { number: "02", title: "Kỹ thuật thành phần", note: "Học riêng chân, tay và thở để mỗi bộ phận có một nhiệm vụ rõ ràng.", lessons: ["03", "04", "05"] },
  { number: "03", title: "Phối hợp và sửa lỗi", note: "Ghép đúng thời điểm, quan sát nguyên nhân và sửa lỗi có kiểm soát.", lessons: ["06", "07"] },
  { number: "04", title: "Củng cố thành kỹ năng", note: "Luyện theo giáo án bốn tuần để duy trì kỹ thuật và tăng quãng bơi dần.", lessons: ["08"] },
];

type AppearanceSettings = {
  background: string;
  font: "arial" | "readable" | "serif";
  textSize: 0 | 2 | 4;
};

const defaultAppearance: AppearanceSettings = {
  background: "#f7fbfb",
  font: "arial",
  textSize: 0,
};

const backgroundOptions = [
  { name: "Trắng nước", value: "#f7fbfb" },
  { name: "Xanh dịu", value: "#edf7f5" },
  { name: "Kem ấm", value: "#fbf7ef" },
  { name: "Xám sáng", value: "#f1f4f6" },
];

const fontOptions: { id: AppearanceSettings["font"]; name: string; sample: string; stack: string }[] = [
  { id: "arial", name: "Arial", sample: "Rõ ràng, quen thuộc", stack: "Arial, Helvetica, sans-serif" },
  { id: "readable", name: "Verdana", sample: "Thoáng và dễ đọc", stack: "Verdana, Geneva, sans-serif" },
  { id: "serif", name: "Georgia", sample: "Dáng sách giáo trình", stack: "Georgia, 'Times New Roman', serif" },
];


function passScoreFor(questionCount: number) {
  return questionCount === 4 ? 3 : Math.ceil(questionCount * 0.8);
}







function Icon({ name }: { name: SectionId | "menu" | "close" }) {
  const paths: Record<string, React.ReactNode> = {
    "tong-quan": <><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" /></>,
    "hoc-tap": <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Zm16 0A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z" /></>,
    "thuc-hanh": <><path d="M7 4v7a5 5 0 0 0 10 0V4M5 4h4m6 0h4M12 16v5" /></>,
    "phan-tich": <><path d="M4 18V9m5 9V5m5 13v-7m5 7V3" /></>,
    "on-tap": <><path d="M20 11a8 8 0 1 1-2.3-5.7L20 8M20 3v5h-5" /></>,
    "kiem-tra": <><path d="M9 4h6l1 2h3v15H5V6h3l1-2Zm0 8 2 2 4-5m-6 9h6" /></>,
    "ai-hoc-tap": <><path d="M12 3v3m0 12v3M3 12h3m12 0h3M6.3 6.3l2.1 2.1m7.2 7.2 2.1 2.1m0-11.4-2.1 2.1m-7.2 7.2-2.1 2.1M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z" /></>,
    "du-lieu": <><path d="M4 19V5m0 14h16M8 16v-4m4 4V7m4 9V9" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("boi-ech-doc-lap", 4);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("tien-do")) {
        request.result.createObjectStore("tien-do");
      }
      if (!request.result.objectStoreNames.contains("thiet-bi")) {
        request.result.createObjectStore("thiet-bi");
      }
      if (!request.result.objectStoreNames.contains("noi-dung")) {
        request.result.createObjectStore("noi-dung");
      }
      if (!request.result.objectStoreNames.contains("dong-bo")) {
        request.result.createObjectStore("dong-bo", { keyPath: "id" });
      }
      if (!request.result.objectStoreNames.contains("ban-rieng")) {
        request.result.createObjectStore("ban-rieng");
      }
      if (!request.result.objectStoreNames.contains("thong-ke-hoc")) {
        request.result.createObjectStore("thong-ke-hoc");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

type CachedLesson = {
  lessonNumber: string;
  content: LessonContentPayload;
  outlines: LessonOutline[];
  cachedAt: string;
};

type OfflineCourseAction = {
  id: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type LocalContentRecord = {
  lessonNumber: string;
  content: LessonContentPayload;
  savedAt: string;
};

function sameLessonContent(left: LessonContentPayload | null | undefined, right: LessonContentPayload | null | undefined) {
  return Boolean(left && right && JSON.stringify(left) === JSON.stringify(right));
}

const emptyStudyStats: OfflineStudyStats = {
  totalSeconds: 0,
  todaySeconds: 0,
  offlineSeconds: 0,
  sessionSeconds: 0,
  lastStudyAt: null,
  reminderEnabled: false,
  reminderMinutes: 60,
  lastReminderAt: null,
};

function localDay(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

async function readLocalContent(lessonNumber: string) {
  const db = await openDb();
  return new Promise<LocalContentRecord | undefined>((resolve, reject) => {
    const request = db.transaction("ban-rieng", "readonly").objectStore("ban-rieng").get(lessonNumber);
    request.onsuccess = () => resolve(request.result as LocalContentRecord | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function writeLocalContent(record: LocalContentRecord) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction("ban-rieng", "readwrite").objectStore("ban-rieng").put(record, record.lessonNumber);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteLocalContent(lessonNumber: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction("ban-rieng", "readwrite").objectStore("ban-rieng").delete(lessonNumber);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function readStudyStats() {
  const db = await openDb();
  return new Promise<(OfflineStudyStats & { day: string }) | undefined>((resolve, reject) => {
    const request = db.transaction("thong-ke-hoc", "readonly").objectStore("thong-ke-hoc").get("current");
    request.onsuccess = () => resolve(request.result as (OfflineStudyStats & { day: string }) | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function writeStudyStats(stats: OfflineStudyStats) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction("thong-ke-hoc", "readwrite").objectStore("thong-ke-hoc").put({ ...stats, day: localDay() }, "current");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

async function readCachedLesson(lessonNumber: string) {
  const db = await openDb();
  return new Promise<CachedLesson | undefined>((resolve, reject) => {
    const request = db.transaction("noi-dung", "readonly").objectStore("noi-dung").get(lessonNumber);
    request.onsuccess = () => resolve(request.result as CachedLesson | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function writeCachedLesson(value: CachedLesson) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction("noi-dung", "readwrite").objectStore("noi-dung").put(value, value.lessonNumber);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function offlineActionId(payload: Record<string, unknown>) {
  const action = typeof payload.action === "string" ? payload.action : "event";
  const lesson = typeof payload.lessonNumber === "string" ? payload.lessonNumber : "none";
  const part = typeof payload.part === "string" ? payload.part : "none";
  return action === "complete"
    ? `complete:${lesson}:${part}`
    : `${action}:${lesson}:${part}:${Date.now()}`;
}

async function enqueueOfflineAction(payload: Record<string, unknown>) {
  const db = await openDb();
  const id = typeof payload.clientEventId === "string" ? payload.clientEventId : offlineActionId(payload);
  const record: OfflineCourseAction = { id, payload: { ...payload, clientEventId: id }, createdAt: new Date().toISOString() };
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("dong-bo", "readwrite");
    const store = transaction.objectStore("dong-bo");
    const existingRequest = store.get(id);
    existingRequest.onerror = () => reject(existingRequest.error);
    existingRequest.onsuccess = () => {
      if (existingRequest.result) return;
      store.put(record);
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  return record;
}

async function pendingOfflineActions() {
  const db = await openDb();
  return new Promise<OfflineCourseAction[]>((resolve, reject) => {
    const request = db.transaction("dong-bo", "readonly").objectStore("dong-bo").getAll();
    request.onsuccess = () => resolve((request.result as OfflineCourseAction[]).sort((left, right) => left.createdAt.localeCompare(right.createdAt)));
    request.onerror = () => reject(request.error);
  });
}

async function removeOfflineAction(id: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction("dong-bo", "readwrite").objectStore("dong-bo").delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function readProgress() {
  const db = await openDb();
  return new Promise<ProgressState | undefined>((resolve, reject) => {
    const request = db.transaction("tien-do", "readonly").objectStore("tien-do").get("bai-03");
    request.onsuccess = () => resolve(request.result as ProgressState | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function writeProgress(value: ProgressState) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction("tien-do", "readwrite").objectStore("tien-do").put(value, "bai-03");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

type CourseApiResponse = {
  state?: ServerCourseState;
  content?: LessonContentPayload;
  outlines?: LessonOutline[];
  score?: number;
  passed?: boolean;
  resetRequired?: boolean;
  error?: string;
  code?: string;
  device?: DeviceAccessState;
  queued?: boolean;
};

type DeviceAccessState = {
  deviceId: string;
  deviceCode: string;
  status: "pending" | "approved" | "blocked";
  label: string | null;
  learnerName: string | null;
  learnerFamilyName: string | null;
  learnerGivenName: string | null;
  personRole: "learner" | "teacher" | null;
  personCode: string | null;
  className: string | null;
  phone: string | null;
  registrationComplete: boolean;
  accessGroup: "unassigned" | "free" | "paid";
  paymentStatus: "unassigned" | "awaiting_payment" | "proof_submitted" | "free_approved" | "paid_verified";
  paymentAmount: number;
  paymentSubmittedAt: string | null;
  paymentRejectedAt: string | null;
  paymentReviewNote: string | null;
  accessExpiresAt: string | null;
  accessExpired: boolean;
  accessExpiringSoon: boolean;
  accessDaysRemaining: number | null;
  personalEditEnabled: boolean;
  autoConfirmedAt: string | null;
};

type CourseCertificate = {
  verificationCode: string;
  learnerName: string;
  className: string;
  completedAt: string;
  issuedAt: string;
};

type LearnerRegistrationFields = {
  learnerFamilyName: string;
  learnerGivenName: string;
  personRole: "learner" | "teacher";
  personCode: string;
  className: string;
  phone: string;
};

type StoredDeviceCredential = {
  version: 2;
  privateKey: CryptoKey | null;
  publicKey: JsonWebKey;
};

type DeviceApiResponse = {
  device?: DeviceAccessState;
  challenge?: string;
  expiresAt?: number;
  error?: string;
  code?: string;
};

class CourseApiError extends Error {
  code?: string;
  device?: DeviceAccessState;
  status?: number;

  constructor(message: string, code?: string, device?: DeviceAccessState, status?: number) {
    super(message);
    this.code = code;
    this.device = device;
    this.status = status;
  }
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function readStoredDeviceCredential() {
  const db = await openDb();
  return new Promise<StoredDeviceCredential | undefined>((resolve, reject) => {
    const request = db.transaction("thiet-bi", "readonly").objectStore("thiet-bi").get("chinh");
    request.onsuccess = () => resolve(request.result as StoredDeviceCredential | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function writeStoredDeviceCredential(value: StoredDeviceCredential) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction("thiet-bi", "readwrite").objectStore("thiet-bi").put(value, "chinh");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getOrCreateDeviceCredential() {
  const current = await readStoredDeviceCredential();
  if (current?.version === 2 && current.publicKey && (current.privateKey || !crypto.subtle)) return current;

  if (!crypto.subtle) {
    const credential = {
      version: 2,
      privateKey: null,
      publicKey: {
        kty: "EC",
        crv: "P-256",
        x: base64Url(crypto.getRandomValues(new Uint8Array(32))),
        y: base64Url(crypto.getRandomValues(new Uint8Array(32))),
      },
    } satisfies StoredDeviceCredential;
    await writeStoredDeviceCredential(credential);
    return credential;
  }

  const generated = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  ) as CryptoKeyPair;
  const publicKey = await crypto.subtle.exportKey("jwk", generated.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", generated.privateKey);
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const credential = { version: 2, privateKey, publicKey } satisfies StoredDeviceCredential;
  await writeStoredDeviceCredential(credential);
  return credential;
}

function legacyDeviceToken() {
  try { return window.localStorage.getItem("boi-ech-device-token-v1"); } catch { return null; }
}

async function parseDeviceResponse(response: Response) {
  const data = (await response.json()) as DeviceApiResponse;
  if (!response.ok) throw new CourseApiError(data.error ?? "Không thể xác thực thiết bị.", data.code, data.device, response.status);
  return data;
}

async function registerDeviceCredential(credential: StoredDeviceCredential) {
  const response = await fetch("/api/device", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "register", publicKey: credential.publicKey, legacyToken: legacyDeviceToken() }),
  });
  const data = await parseDeviceResponse(response);
  if (!data.device) throw new CourseApiError("Máy chủ chưa trả về trạng thái thiết bị.");
  if (data.device.status === "approved") {
    try { window.localStorage.removeItem("boi-ech-device-token-v1"); } catch { /* Đã chuyển sang khóa không thể xuất. */ }
  }
  return data.device;
}

async function signedDeviceProof(credential: StoredDeviceCredential, device: DeviceAccessState) {
  const challengeResponse = await fetch("/api/device", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "challenge", deviceId: device.deviceId }),
  });
  const challengeData = await parseDeviceResponse(challengeResponse);
  if (!challengeData.challenge) throw new CourseApiError("Máy chủ chưa tạo được thử thách thiết bị.");
  const message = new TextEncoder().encode(`boi-ech:${device.deviceId}:${challengeData.challenge}`);
  const signature = credential.privateKey && crypto.subtle
    ? await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message)
    : crypto.getRandomValues(new Uint8Array(64)).buffer;
  return { deviceId: device.deviceId, challenge: challengeData.challenge, signature: base64Url(new Uint8Array(signature)) };
}

type SignedDeviceProof = Awaited<ReturnType<typeof signedDeviceProof>>;

async function withFreshDeviceProof<T>(
  credential: StoredDeviceCredential,
  device: DeviceAccessState,
  request: (proof: SignedDeviceProof) => Promise<T>,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const proof = await signedDeviceProof(credential, device);
    try {
      return await request(proof);
    } catch (error) {
      lastError = error;
      if (!(error instanceof CourseApiError) || error.code !== "DEVICE_PROOF_EXPIRED") throw error;
    }
  }
  throw lastError;
}

async function postCourse(credential: StoredDeviceCredential, device: DeviceAccessState, payload: Record<string, unknown>): Promise<CourseApiResponse> {
  return withFreshDeviceProof(credential, device, async (proof) => {
    const response = await fetch("/api/course", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, ...proof }),
    });
    const data = (await response.json()) as CourseApiResponse;
    if (!response.ok) throw new CourseApiError(data.error ?? "Không thể kết nối dịch vụ học tập.", data.code, data.device, response.status);
    return data;
  });
}

async function postAi(credential: StoredDeviceCredential, device: DeviceAccessState, payload: Record<string, unknown>): Promise<AiApiResponse> {
  return withFreshDeviceProof(credential, device, async (proof) => {
    const response = await fetch("/api/ai/mentor", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, ...proof }),
    });
    const data = (await response.json()) as AiApiResponse;
    if (!response.ok) throw new CourseApiError(data.error ?? "Không thể kết nối dịch vụ AI.", data.code);
    return data;
  });
}

async function issueCertificate(credential: StoredDeviceCredential, device: DeviceAccessState) {
  return withFreshDeviceProof(credential, device, async (proof) => {
    const response = await fetch("/api/certificate", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "issue", ...proof }),
    });
    const data = await response.json() as { certificate?: CourseCertificate; error?: string; code?: string };
    if (!response.ok || !data.certificate) throw new CourseApiError(data.error ?? "Không thể tạo chứng chỉ hoàn thành.", data.code);
    return data.certificate;
  });
}

async function postDevicePresence(credential: StoredDeviceCredential, device: DeviceAccessState) {
  return withFreshDeviceProof(credential, device, async (proof) => {
    const response = await fetch("/api/device", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "presence", ...proof }),
    });
    const data = await parseDeviceResponse(response);
    if (!data.device) throw new CourseApiError("Máy chủ chưa xác nhận trạng thái thiết bị.");
    return data.device;
  });
}

async function saveDeviceRegistration(
  credential: StoredDeviceCredential,
  device: DeviceAccessState,
  fields: LearnerRegistrationFields,
) {
  return withFreshDeviceProof(credential, device, async (proof) => {
    const response = await fetch("/api/device", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save-registration", ...fields, ...proof }),
    });
    const data = await parseDeviceResponse(response);
    if (!data.device) throw new CourseApiError("Máy chủ chưa trả về hồ sơ vừa đăng ký.");
    return data.device;
  });
}

async function uploadPaymentProof(credential: StoredDeviceCredential, device: DeviceAccessState, file: File) {
  await withFreshDeviceProof(credential, device, async (proof) => {
    const form = new FormData();
    form.set("deviceId", proof.deviceId);
    form.set("challenge", proof.challenge);
    form.set("signature", proof.signature);
    form.set("proof", file);
    const response = await fetch("/api/device/payment-proof", { method: "POST", credentials: "same-origin", body: form });
    if (!response.ok) {
      const data = (await response.json()) as DeviceApiResponse;
      throw new CourseApiError(data.error ?? "Không thể gửi ảnh chuyển khoản.", data.code, data.device);
    }
  });
  return registerDeviceCredential(credential);
}

function splitLegacyLearnerName(value: string | null | undefined) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  return {
    learnerFamilyName: parts.length > 1 ? parts.slice(0, -1).join(" ") : "",
    learnerGivenName: parts.at(-1) ?? "",
  };
}

function darkBackground(value: string) {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
  if (!match) return false;
  const [red, green, blue] = match.slice(1).map((channel) => Number.parseInt(channel, 16));
  return (red * 299 + green * 587 + blue * 114) / 1000 < 142;
}

function InstallAppButton({ install }: { install: () => void }) {
  return <button className="install-fab" onClick={install} aria-label="Cài ứng dụng Bơi ếch" title="Cài ứng dụng"><span aria-hidden="true">⇩</span><b>Cài ứng dụng</b></button>;
}

function DeviceGate({
  device,
  error,
  checking,
  onRetry,
  onRegister,
  onUploadPayment,
  onEnter,
}: {
  device: DeviceAccessState | null;
  error: string;
  checking: boolean;
  onRetry: () => void;
  onRegister: (fields: LearnerRegistrationFields) => Promise<void>;
  onUploadPayment: (file: File) => Promise<void>;
  onEnter: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const legacyName = splitLegacyLearnerName(device?.learnerName);
  const [learnerFamilyName, setLearnerFamilyName] = useState(device?.learnerFamilyName ?? legacyName.learnerFamilyName);
  const [learnerGivenName, setLearnerGivenName] = useState(device?.learnerGivenName ?? legacyName.learnerGivenName);
  const [personRole, setPersonRole] = useState<"learner" | "teacher">(device?.personRole === "teacher" ? "teacher" : "learner");
  const [personCode, setPersonCode] = useState(device?.personCode ?? "");
  const [className, setClassName] = useState(device?.className ?? "");
  const [phone, setPhone] = useState(device?.phone ?? "");
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");
  const hydratedDeviceId = useRef("");
  const pending = device?.status === "pending";
  const blocked = device?.status === "blocked";
  const expired = Boolean(device?.accessExpired);
  const needsRegistration = Boolean(device && !device.registrationComplete && !blocked);
  const paymentRequested = device?.paymentStatus === "awaiting_payment" || device?.paymentStatus === "proof_submitted";
  const proofSubmitted = device?.paymentStatus === "proof_submitted";
  const readyToLearn = Boolean(device?.status === "approved" && device.registrationComplete && !expired && !blocked && !paymentRequested);

  useEffect(() => {
    if (!device || hydratedDeviceId.current === device.deviceId) return;
    const knownName = splitLegacyLearnerName(device.learnerName);
    setLearnerFamilyName(device.learnerFamilyName ?? knownName.learnerFamilyName);
    setLearnerGivenName(device.learnerGivenName ?? knownName.learnerGivenName);
    setPersonRole(device.personRole === "teacher" ? "teacher" : "learner");
    setPersonCode(device.personCode ?? "");
    setClassName(device.className ?? "");
    setPhone(device.phone ?? "");
    hydratedDeviceId.current = device.deviceId;
  }, [device]);

  async function copyCode() {
    if (!device?.deviceCode) return;
    try {
      await navigator.clipboard.writeText(device.deviceCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  }

  async function submitRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setLocalError("");
    try { await onRegister({ learnerFamilyName, learnerGivenName, personRole, personCode, className, phone }); }
    catch (caught) { setLocalError(caught instanceof Error ? caught.message : "Không thể gửi hồ sơ đăng ký."); }
    finally { setSubmitting(false); }
  }

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proof) { setLocalError("Hãy chọn ảnh chuyển khoản trước khi gửi."); return; }
    setSubmitting(true);
    setLocalError("");
    try {
      await onUploadPayment(proof);
      setProof(null);
    } catch (caught) { setLocalError(caught instanceof Error ? caught.message : "Không thể gửi ảnh chuyển khoản."); }
    finally { setSubmitting(false); }
  }

  return (
    <main className="device-gate">
      <section>
        <div className="device-gate-mark"><i /><i /><i /></div>
        <span className={`device-gate-status ${blocked ? "blocked" : expired ? "expired" : pending ? "pending" : "checking"}`}>
          {blocked ? "Thiết bị đã bị khóa" : expired ? "Quyền học đã hết hạn" : needsRegistration ? "Nhập thông tin người học" : readyToLearn ? "Thông tin đã được lưu" : paymentRequested ? "Bước 2 · Thanh toán" : pending ? "Đang chờ phân nhóm" : "Đang xác thực thiết bị"}
        </span>
        <h1>{blocked ? "Website chưa thể mở trên thiết bị này." : expired ? "Tài khoản cần được quản trị viên gia hạn." : needsRegistration ? "Nhập thông tin người học." : readyToLearn ? `Sẵn sàng vào học, ${device?.learnerGivenName ?? "học viên"}.` : proofSubmitted ? "Ảnh chuyển khoản đã gửi." : paymentRequested ? "Tài khoản học tập: 50.000đ." : pending ? "Thông tin đã gửi tới Trung tâm quản trị." : "Đang kiểm tra quyền truy cập…"}</h1>
        <p>{blocked ? "Liên hệ quản trị viên nếu cần mở lại quyền học." : expired ? `Quyền học hết hạn lúc ${device?.accessExpiresAt ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(device.accessExpiresAt)) : "—"}. Tiến độ đã lưu được giữ nguyên.` : needsRegistration ? "Thông tin được gắn với mã thiết bị để cá nhân hóa bài học, lưu tiến độ và cấp chứng chỉ hoàn thành." : readyToLearn ? `Quyền miễn phí còn ${device?.accessDaysRemaining ?? 60} ngày. Thời gian và tiến độ học được tự động ghi nhận để đồng bộ với giảng viên.` : proofSubmitted ? "Trung tâm sẽ kiểm tra ảnh. Ngay khi xác minh, tài khoản trên thiết bị này sẽ tự động mở." : paymentRequested ? "Quét mã QR MB, chuyển đúng 50.000đ rồi gửi ảnh chuyển khoản để Trung tâm xác minh." : pending ? "Quản trị viên sẽ chọn tài khoản miễn phí hoặc yêu cầu trả phí. Trang tự kiểm tra kết quả mà không cần nhập lại." : error || "Thiết bị đang ký thử thách bảo mật do máy chủ gửi."}</p>
        {device?.deviceCode ? (
          <div className="device-code-box"><span>Mã thiết bị</span><strong>{device.deviceCode}</strong><button onClick={() => void copyCode()}>{copied ? "Đã sao chép" : "Sao chép mã"}</button></div>
        ) : null}
        {needsRegistration ? (
          <form className="device-registration-form" onSubmit={(event) => void submitRegistration(event)}>
            <fieldset className="person-role-field"><legend>Vai trò sử dụng</legend><div><label className={personRole === "learner" ? "selected" : ""}><input type="radio" name="person-role" value="learner" checked={personRole === "learner"} onChange={() => { setPersonRole("learner"); setPersonCode(""); }} /><span><b>Học viên</b><small>Học, làm bài và nhận chứng chỉ</small></span></label><label className={personRole === "teacher" ? "selected" : ""}><input type="radio" name="person-role" value="teacher" checked={personRole === "teacher"} onChange={() => { setPersonRole("teacher"); setPersonCode(""); }} /><span><b>Giảng viên</b><small>Có thể xin quyền chỉnh sửa bài giảng</small></span></label></div></fieldset>
            <label><span>Họ</span><input value={learnerFamilyName} onChange={(event) => setLearnerFamilyName(event.target.value)} autoComplete="family-name" placeholder="Ví dụ: Nguyễn Đình" maxLength={60} required /></label>
            <label><span>Tên</span><input value={learnerGivenName} onChange={(event) => setLearnerGivenName(event.target.value)} autoComplete="given-name" placeholder="Ví dụ: Nam" maxLength={60} required /></label>
            <label><span>{personRole === "teacher" ? "Số hiệu SQ/QNCN" : "Mã số học viên"}</span><input value={personCode} onChange={(event) => setPersonCode(event.target.value.toUpperCase())} autoComplete="off" placeholder={personRole === "teacher" ? "Ví dụ: SQ123456" : "Ví dụ: HV2026001"} maxLength={32} required /></label>
            <label><span>{personRole === "teacher" ? "Lớp / đơn vị phụ trách" : "Lớp"}</span><input value={className} onChange={(event) => setClassName(event.target.value)} placeholder={personRole === "teacher" ? "Ví dụ: Đại đội 1" : "Ví dụ: 7A1"} maxLength={50} required /></label>
            <label><span>Số điện thoại</span><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="Ví dụ: 0912345678" maxLength={14} required /></label>
            <label className="device-code-field"><span>Mã thiết bị</span><input value={device?.deviceCode ?? ""} readOnly /></label>
            <button type="submit" disabled={submitting}>{submitting ? "Đang lưu…" : "Lưu thông tin người học"}</button>
          </form>
        ) : null}
        {readyToLearn ? <button className="device-enter-learning" onClick={onEnter}>Vào học <span>→</span></button> : null}
        {paymentRequested ? (
          <form className="device-payment-form" onSubmit={(event) => void submitPayment(event)}>
            {device?.paymentReviewNote ? <div className="payment-rejection" role="alert"><strong>Ảnh trước chưa được chấp nhận</strong><p>{device.paymentReviewNote}</p><small>Hãy kiểm tra lại thông tin chuyển khoản rồi gửi ảnh mới.</small></div> : null}
            <div className="payment-price"><span>Bảng giá tài khoản</span><strong>50.000đ</strong><small>Thanh toán một lần cho thiết bị này</small></div>
            <img src="/thanh-toan-mb.jpeg" alt="Mã QR chuyển khoản MB cho Nguyễn Đình Nam, số tài khoản 3030103031991" />
            <dl><div><dt>Ngân hàng</dt><dd>MB</dd></div><div><dt>Chủ tài khoản</dt><dd>NGUYEN DINH NAM</dd></div><div><dt>Số tài khoản</dt><dd>3030103031991</dd></div></dl>
            <label className="payment-file"><span>{proofSubmitted ? "Thay ảnh chuyển khoản (nếu cần)" : "Ảnh chuyển khoản"}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setProof(event.target.files?.[0] ?? null)} /></label>
            <button type="submit" disabled={submitting || !proof}>{submitting ? "Đang gửi ảnh…" : proofSubmitted ? "Gửi ảnh thay thế" : "Gửi ảnh chuyển khoản"}</button>
          </form>
        ) : null}
        {(localError || error) && !blocked ? <div className="device-gate-error" role="alert">{localError || error}</div> : null}
        {!needsRegistration && !paymentRequested && !readyToLearn ? <button className="device-gate-retry" onClick={onRetry} disabled={checking}>{checking ? "Đang kiểm tra…" : expired ? "Kiểm tra gia hạn" : "Kiểm tra trạng thái ngay"}</button> : null}
        <small>Khóa riêng chỉ lưu trong trình duyệt này. Xóa dữ liệu trang hoặc đổi trình duyệt sẽ tạo một mã thiết bị mới và cần duyệt lại.</small>
      </section>
    </main>
  );
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="section-heading">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function LessonFigure({ visual, label, eager = false }: { visual: LessonVisual; label?: string; eager?: boolean }) {
  const caption = label ?? visual.alt.split(" – ").at(-1);
  return (
    <figure className="lesson-figure">
      <img src={visual.src} alt={visual.alt} loading={eager ? "eager" : "lazy"} decoding="async" />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

function FoundationLesson({
  lesson,
  detail,
  visuals,
  completed,
  onComplete,
  onOpenPractice,
}: {
  lesson: LessonOutline;
  detail: PublicFoundationDetail;
  visuals: LessonVisualSet;
  completed: boolean;
  onComplete: () => boolean;
  onOpenPractice: (lessonNumber: string) => void;
}) {
  return (
    <div className="page foundation-page">
      <section className="foundation-hero">
        <div>
          <span className="lesson-tag">Bài {lesson.n} · {lesson.group}</span>
          <h1>{lesson.title}</h1>
          <p>{lesson.summary}</p>
          <div className="foundation-hero-meta">
            <span><b>{lesson.duration}</b> toàn bài</span>
            <span><b>{detail.knowledge.length}</b> phần kiến thức</span>
            <span><b>5 phần</b> chuỗi chuyên sâu</span>
            <span><b>{passScoreFor(detail.questions.length)}/{detail.questions.length}</b> mức đạt</span>
          </div>
        </div>
        <div className="foundation-target">
          <span>Chuẩn hoàn thành</span>
          <strong>{lesson.target}</strong>
        </div>
        <LessonFigure visual={visuals.cover} label={`Bài ${lesson.n} · Hình dung toàn bộ kỹ thuật trước khi tập`} eager />
      </section>

      <section className="foundation-safety">
        <i>!</i>
        <div><span>An toàn bắt buộc</span><h2>{detail.safety.title}</h2><p>{detail.safety.body}</p></div>
      </section>

      <section className="foundation-objectives">
        <SectionHeading eyebrow="Mục tiêu đầu ra" title="Ba năng lực cần đạt" text="Chỉ chuyển bài khi người học vừa hiểu nguyên tắc, vừa thực hiện được thao tác trong điều kiện có giám sát." />
        <div>
          {lesson.objectives.map((item, index) => <article key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></article>)}
        </div>
      </section>

      <section className="foundation-knowledge">
        <SectionHeading eyebrow="Nội dung cốt lõi" title="Học theo từng thao tác quan sát được" text="Mỗi phần đều có trình tự thực hiện, khẩu lệnh ghi nhớ và lỗi phải chặn ngay từ đầu." />
        <div className="knowledge-list">
          {detail.knowledge.map((item, index) => (
            <article key={item.title} className="knowledge-card">
              <LessonFigure visual={visuals.technique[index % visuals.technique.length]} label={`${item.title} · ${visuals.technique[index % visuals.technique.length].alt.split(" – ").at(-1)}`} />
              <header><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.title}</h3><p>{item.body}</p></div></header>
              <ol>{item.steps.map((step) => <li key={step}>{step}</li>)}</ol>
              <footer><div><span>Khẩu lệnh</span><strong>{item.cue}</strong></div><div><span>Cần tránh</span><strong>{item.avoid}</strong></div></footer>
            </article>
          ))}
        </div>
      </section>

      <section className="foundation-memory"><span>Ghi nhớ cuối bài</span><strong>{detail.memory}</strong></section>

      <section className="learning-footer">
        <div><span>Phần 1/5 · Nội dung cốt lõi</span><strong>{completed ? "Đã ghi nhận phần học" : lesson.bridge}</strong></div>
        <button className="primary-button" onClick={() => { if (onComplete()) onOpenPractice(lesson.n); }}>Hoàn thành phần 1/5 · thực hành Bài {lesson.n} <span>→</span></button>
      </section>
    </div>
  );
}

export default function Home() {
  const [section, setSection] = useState<SectionId>("tong-quan");
  const [selectedLesson, setSelectedLesson] = useState("01");
  const [phase, setPhase] = useState(0);
  const [question, setQuestion] = useState(0);
  const [progress, setProgress] = useState<ProgressState>(initialProgress);
  const [ready, setReady] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const [motionPlaying, setMotionPlaying] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [appearanceReady, setAppearanceReady] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceSettings>(defaultAppearance);
  const [deviceCredential, setDeviceCredential] = useState<StoredDeviceCredential | null>(null);
  const [deviceAccess, setDeviceAccess] = useState<DeviceAccessState | null>(null);
  const [deviceError, setDeviceError] = useState("");
  const [deviceChecking, setDeviceChecking] = useState(true);
  const [lessonContent, setLessonContent] = useState<LessonContentPayload | null>(null);
  const [serverScores, setServerScores] = useState<Record<string, number>>({});
  const [lessons, setLessons] = useState<LessonOutline[]>(defaultLessonOutlines);
  const [networkOnline, setNetworkOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [usingOfflineLesson, setUsingOfflineLesson] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [hasEnteredLearning, setHasEnteredLearning] = useState(false);
  const [localContent, setLocalContent] = useState<LocalContentRecord | null>(null);
  const [localStudioOpen, setLocalStudioOpen] = useState(false);
  const [studyStats, setStudyStats] = useState<OfflineStudyStats>(emptyStudyStats);
  const [certificate, setCertificate] = useState<CourseCertificate | null>(null);
  const [certificateBusy, setCertificateBusy] = useState(false);
  const actionQueue = useRef<Promise<void>>(Promise.resolve());
  const hasBootstrapped = useRef(false);
  const syncRunning = useRef(false);
  const lastInteractionAt = useRef(0);
  const certificateAttempted = useRef(false);

  const officialContent = lessonContent?.lessonNumber === selectedLesson ? lessonContent : null;
  const hasLocalOverride = Boolean(
    deviceAccess?.personalEditEnabled
    && localContent?.lessonNumber === selectedLesson
    && officialContent
    && !sameLessonContent(localContent.content, officialContent),
  );
  const activeContent = hasLocalOverride && localContent?.lessonNumber === selectedLesson
    ? localContent.content
    : officialContent;
  const movementContent = activeContent?.kind === "movement" ? activeContent : null;
  const selectedPracticeDetail = activeContent?.kind === "foundation" ? activeContent.detail : null;
  const phases = movementContent?.phases ?? [];
  const movementAnalysisPhases = movementContent?.analysisPhases ?? phases;
  const foundationAnalysis = selectedPracticeDetail?.analysis ?? selectedPracticeDetail?.knowledge ?? [];
  const animatedPhaseCount = section === "phan-tich" && selectedLesson === "03" ? movementAnalysisPhases.length : phases.length;
  const mistakes = movementContent?.mistakes ?? [];
  const practice = movementContent?.practice ?? [];
  const sessionPlan = movementContent?.sessionPlan ?? [];
  const questions: PublicQuestion[] = movementContent?.questions ?? [];
  const activeVisuals = activeContent?.visuals ?? null;

  async function refreshPendingSyncCount() {
    try { setPendingSyncCount((await pendingOfflineActions()).length); }
    catch { setPendingSyncCount(0); }
  }

  async function flushOfflineQueue(credential = deviceCredential, access = deviceAccess) {
    if (!credential || access?.status !== "approved" || syncRunning.current || !navigator.onLine) return;
    syncRunning.current = true;
    try {
      const pending = await pendingOfflineActions();
      for (const item of pending) {
        try {
          const data = await postCourse(credential, access, item.payload);
          if (data.state) {
            setServerScores(data.state.scores);
            setProgress((current) => ({ ...current, completed: data.state!.completed }));
          }
          await removeOfflineAction(item.id);
        } catch (error) {
          if (error instanceof CourseApiError && error.status === 400) {
            await removeOfflineAction(item.id);
            continue;
          }
          throw error;
        }
      }
      await refreshPendingSyncCount();
      if (pending.length > 0) setNotice(`Đã đồng bộ ${pending.length} hoạt động học lên máy chủ.`);
    } catch (error) {
      if (error instanceof CourseApiError && error.device) setDeviceAccess(error.device);
      await refreshPendingSyncCount();
    } finally {
      syncRunning.current = false;
    }
  }

  async function installWebApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  async function changeReminder(enabled: boolean, minutesValue: number) {
    const reminderMinutes = [30, 60, 90, 120].includes(minutesValue) ? minutesValue : 60;
    if (enabled && "Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission().catch(() => "denied" as NotificationPermission);
    }
    setStudyStats((current) => ({
      ...current,
      reminderEnabled: enabled,
      reminderMinutes,
      lastReminderAt: enabled ? new Date().toISOString() : current.lastReminderAt,
    }));
    setNotice(enabled ? `Đã bật nhắc học sau ${reminderMinutes} phút không hoạt động.` : "Đã tắt nhắc học.");
  }

  async function savePersonalContent(next: LessonContentPayload) {
    if (sameLessonContent(next, officialContent)) {
      await deleteLocalContent(selectedLesson);
      setLocalContent(null);
      setNotice(`Bài ${selectedLesson} không có khác biệt; ứng dụng đang dùng nội dung máy chủ.`);
      return;
    }
    const record = { lessonNumber: selectedLesson, content: next, savedAt: new Date().toISOString() } satisfies LocalContentRecord;
    await writeLocalContent(record);
    setLocalContent(record);
    setNotice(`Đã lưu bản sửa riêng của Bài ${selectedLesson} trên thiết bị này.`);
  }

  async function resetPersonalContent() {
    await deleteLocalContent(selectedLesson);
    setLocalContent(null);
    setNotice(`Đã khôi phục nội dung chính thức của Bài ${selectedLesson}.`);
  }

  async function confirmResetPersonalContent() {
    if (!window.confirm(`Khôi phục Bài ${selectedLesson} về đúng nội dung hiện tại trên máy chủ?`)) return;
    await resetPersonalContent();
  }

  async function createCertificate() {
    if (!deviceCredential || !deviceAccess || certificateBusy) return;
    setCertificateBusy(true);
    try {
      const issued = await issueCertificate(deviceCredential, deviceAccess);
      setCertificate(issued);
      setNotice("Chứng chỉ hoàn thành đã sẵn sàng để in hoặc lưu PDF.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Chưa thể tạo chứng chỉ.");
    } finally {
      setCertificateBusy(false);
    }
  }

  useEffect(() => {
    const startupTimer = window.setTimeout(() => {
      setNetworkOnline(navigator.onLine);
      void refreshPendingSyncCount();
    }, 0);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const onOnline = () => {
      setNetworkOnline(true);
      void flushOfflineQueue();
    };
    const onOffline = () => setNetworkOnline(false);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => {
      window.clearTimeout(startupTimer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  // The connectivity listeners deliberately use the current signed device when reconnecting.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceAccess?.deviceId, deviceCredential]);

  useEffect(() => {
    let cancelled = false;
    const progressTask = readProgress()
      .then((saved) => {
        if (cancelled) return;
        if (!saved) return;
        const merged: ProgressState = {
          ...initialProgress,
          ...saved,
          completed: normalizeCompletedProgress(saved.completed),
          answers: saved.answers ?? {},
          lessonAnswers: saved.lessonAnswers ?? {},
          lessonFlags: saved.lessonFlags ?? {},
          lessonChecked: saved.lessonChecked ?? {},
          lessonSubmitted: Array.isArray(saved.lessonSubmitted) ? saved.lessonSubmitted : [],
          flags: Array.isArray(saved.flags) ? saved.flags : [],
          checked: Array.isArray(saved.checked) ? saved.checked : [],
          submitted: Boolean(saved.submitted),
        };
        setProgress(merged);
      })
      .catch(() => { if (!cancelled) setNotice("Trình duyệt chưa cho phép lưu tiến độ."); });

    const deviceTask = getOrCreateDeviceCredential()
      .then(async (credential) => {
        if (cancelled) return;
        setDeviceCredential(credential);
        const access = await registerDeviceCredential(credential);
        if (cancelled) return;
        setDeviceAccess(access);
        setHasEnteredLearning(access.registrationComplete);
        setDeviceError("");
      })
      .catch((error) => {
        if (!cancelled) setDeviceError(error instanceof Error ? error.message : "Không thể đăng ký thiết bị học tập.");
      })
      .finally(() => { if (!cancelled) setDeviceChecking(false); });

    Promise.allSettled([progressTask, deviceTask]).then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    readStudyStats()
      .then((saved) => {
        if (cancelled || !saved) return;
        setStudyStats({
          ...emptyStudyStats,
          ...saved,
          todaySeconds: saved.day === localDay() ? Math.max(0, Number(saved.todaySeconds) || 0) : 0,
          sessionSeconds: 0,
        });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!deviceAccess?.personalEditEnabled) return;
    readLocalContent(selectedLesson)
      .then((record) => { if (!cancelled) setLocalContent(record ?? null); })
      .catch(() => { if (!cancelled) setLocalContent(null); });
    return () => { cancelled = true; };
  }, [deviceAccess?.personalEditEnabled, selectedLesson]);

  useEffect(() => {
    const active = () => { lastInteractionAt.current = Date.now(); };
    active();
    window.addEventListener("pointerdown", active, { passive: true });
    window.addEventListener("keydown", active);
    window.addEventListener("scroll", active, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", active);
      window.removeEventListener("keydown", active);
      window.removeEventListener("scroll", active);
    };
  }, []);

  useEffect(() => {
    if (!hasEnteredLearning || !deviceCredential || deviceAccess?.status !== "approved" || deviceAccess.accessExpired) return;
    const credential = deviceCredential;
    const access = deviceAccess;
    const recordMinute = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastInteractionAt.current > 2 * 60 * 1000) return;
      const occurredAt = new Date().toISOString();
      const offline = !navigator.onLine;
      const clientEventId = `study:${crypto.randomUUID()}`;
      setStudyStats((current) => ({
        ...current,
        totalSeconds: current.totalSeconds + 60,
        todaySeconds: current.lastStudyAt && localDay(new Date(current.lastStudyAt)) !== localDay() ? 60 : current.todaySeconds + 60,
        offlineSeconds: current.offlineSeconds + (offline ? 60 : 0),
        sessionSeconds: current.sessionSeconds + 60,
        lastStudyAt: occurredAt,
      }));
      const offlinePayload = {
        action: "offline-session",
        lessonNumber: selectedLesson,
        part: section,
        activeSeconds: 60,
        occurredAt,
        clientEventId,
      };
      if (offline) {
        void enqueueOfflineAction(offlinePayload).then(() => refreshPendingSyncCount()).catch(() => undefined);
        return;
      }
      const result = actionQueue.current.then(() => postCourse(credential, access, {
        action: "heartbeat",
        lessonNumber: selectedLesson,
        part: section,
        activeSeconds: 60,
        clientEventId,
      }));
      actionQueue.current = result.then(() => undefined, () => undefined);
      void result.catch((error) => {
        if (error instanceof CourseApiError && error.device) setDeviceAccess(error.device);
        if (navigator.onLine) return;
        setNetworkOnline(false);
        void enqueueOfflineAction(offlinePayload).then(() => refreshPendingSyncCount()).catch(() => undefined);
      });
    };
    const timer = window.setInterval(recordMinute, 60_000);
    return () => window.clearInterval(timer);
  }, [deviceAccess, deviceCredential, hasEnteredLearning, section, selectedLesson]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void writeStudyStats(studyStats).catch(() => undefined); }, 250);
    return () => window.clearTimeout(timer);
  }, [studyStats]);

  useEffect(() => {
    if (!studyStats.reminderEnabled) return;
    const remind = () => {
      const anchor = studyStats.lastReminderAt ?? studyStats.lastStudyAt;
      const elapsed = anchor ? Date.now() - Date.parse(anchor) : Number.POSITIVE_INFINITY;
      if (elapsed < studyStats.reminderMinutes * 60 * 1000) return;
      const message = `${deviceAccess?.learnerGivenName || "Học viên"}, đã đến lúc dành 10 phút tiếp tục bài Bơi ếch.`;
      setNotice(message);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Nhắc học Bơi ếch", { body: message, icon: "/icon-192.png" });
      }
      setStudyStats((current) => ({ ...current, lastReminderAt: new Date().toISOString() }));
    };
    const timer = window.setInterval(remind, 60_000);
    return () => window.clearInterval(timer);
  }, [deviceAccess?.learnerGivenName, studyStats.lastReminderAt, studyStats.lastStudyAt, studyStats.reminderEnabled, studyStats.reminderMinutes]);

  useEffect(() => {
    if (!ready || !hasEnteredLearning || !deviceCredential || deviceAccess?.status !== "approved") return;
    let cancelled = false;
    postCourse(deviceCredential, deviceAccess, {
      action: "bootstrap",
      lessonNumber: selectedLesson,
    })
      .then((data) => {
        if (cancelled || !data.state || !data.content) return;
        if (data.outlines?.length === 8) setLessons(data.outlines);
        setNetworkOnline(true);
        setUsingOfflineLesson(false);
        setServerScores(data.state.scores);
        setProgress((current) => ({
          ...current,
          completed: data.state!.completed,
          submitted: data.state!.scores["03"] !== undefined || current.submitted,
          lessonSubmitted: [
            ...new Set([
              ...current.lessonSubmitted,
              ...Object.keys(data.state!.scores).filter((lessonNumber) => lessonNumber !== "03"),
            ]),
          ],
        }));
        setLessonContent(data.content);
        void writeCachedLesson({
          lessonNumber: selectedLesson,
          content: data.content,
          outlines: data.outlines?.length === 8 ? data.outlines : defaultLessonOutlines,
          cachedAt: new Date().toISOString(),
        }).catch(() => undefined);
        void flushOfflineQueue(deviceCredential, deviceAccess);
        if (!hasBootstrapped.current) {
          hasBootstrapped.current = true;
          const next = defaultLessonOutlines.find((lesson) => !data.state!.completed.includes(`bai-${lesson.n}`))?.n ?? "08";
          if (next !== selectedLesson) setSelectedLesson(next);
        }
      })
      .catch(async (error) => {
        if (cancelled) return;
        if (error instanceof CourseApiError && error.device) setDeviceAccess(error.device);
        if (!navigator.onLine || !(error instanceof CourseApiError)) {
          const cached = await readCachedLesson(selectedLesson).catch(() => undefined);
          if (cancelled) return;
          setNetworkOnline(false);
          if (cached) {
            setLessonContent(cached.content);
            if (cached.outlines.length === 8) setLessons(cached.outlines);
            setUsingOfflineLesson(true);
            setNotice(`Đang mở Bài ${selectedLesson} từ bộ nhớ thiết bị. Tiến độ sẽ đồng bộ khi có mạng.`);
            return;
          }
        }
        setNotice(error instanceof Error ? error.message : "Không thể tải nội dung bài học.");
      });
    return () => { cancelled = true; };
  // Bootstrap is keyed to the signed device and selected lesson; queue flushing is intentionally incidental.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceAccess, deviceCredential, hasEnteredLearning, ready, selectedLesson]);

  useEffect(() => {
    if (!deviceCredential || deviceAccess?.status !== "pending") return;
    const timer = window.setInterval(() => {
      registerDeviceCredential(deviceCredential)
        .then((access) => {
          setDeviceAccess(access);
          if (access.status === "approved") setDeviceError("");
        })
        .catch((error) => setDeviceError(error instanceof Error ? error.message : "Chưa thể kiểm tra quyền thiết bị."));
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [deviceAccess?.status, deviceCredential]);

  useEffect(() => {
    if (!deviceCredential || !deviceAccess || deviceAccess.status === "blocked") return;
    let cancelled = false;
    const sendPresence = () => {
      postDevicePresence(deviceCredential, deviceAccess)
        .then((access) => {
          if (!cancelled) {
            setDeviceAccess(access);
            setDeviceError("");
          }
        })
        .catch((error) => {
          if (cancelled) return;
          if (error instanceof CourseApiError && error.device) setDeviceAccess(error.device);
          setDeviceError(error instanceof Error ? error.message : "Chưa thể cập nhật trạng thái thiết bị.");
        });
    };
    sendPresence();
    const timer = window.setInterval(sendPresence, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  // Presence follows the bound device and stops immediately if the server blocks it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceAccess?.deviceId, deviceAccess?.status, deviceCredential]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("boi-ech-appearance-v1");
        if (saved) setAppearance({ ...defaultAppearance, ...JSON.parse(saved) });
      } catch {
        setNotice("Chưa thể đọc tùy chỉnh giao diện đã lưu.");
      } finally {
        setAppearanceReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!appearanceReady) return;
    window.localStorage.setItem("boi-ech-appearance-v1", JSON.stringify(appearance));
  }, [appearance, appearanceReady]);

  useEffect(() => {
    if (!appearanceOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAppearanceOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [appearanceOpen]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      writeProgress(progress).catch(() => setNotice("Chưa thể lưu thay đổi mới."));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [progress, ready]);

  useEffect(() => {
    if (!motionPlaying || animatedPhaseCount === 0) return;
    const timer = window.setInterval(() => setPhase((current) => (current + 1) % animatedPhaseCount), 1700);
    return () => window.clearInterval(timer);
  }, [motionPlaying, animatedPhaseCount]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [section, selectedLesson]);

  const score = serverScores["03"] ?? 0;
  const answered = Object.keys(progress.answers).length;
  const activeLesson = lessons.find((lesson) => lesson.n === selectedLesson) ?? lessons[2];
  const activeQuestions = selectedLesson === "03" ? questions : selectedPracticeDetail?.questions ?? [];
  const activeLessonAnswered = selectedLesson === "03"
    ? answered
    : activeQuestions.filter((_, index) => progress.lessonAnswers[`${selectedLesson}-${index}`] !== undefined).length;
  const activeLessonScore = serverScores[selectedLesson] ?? 0;
  const activePassScore = passScoreFor(activeQuestions.length);
  const activeLessonFlags = progress.lessonFlags[selectedLesson] ?? [];
  const activeLessonSubmitted = selectedLesson === "03" ? progress.submitted : progress.lessonSubmitted.includes(selectedLesson);
  const progressKey = (part: Exclude<SectionId, "tong-quan" | "ai-hoc-tap" | "du-lieu">, lessonNumber = selectedLesson) => courseProgressKey(part, lessonNumber);
  const lessonParts = LESSON_PARTS;
  const completedParts = lessonParts.filter((part) => progress.completed.includes(progressKey(part))).length;
  const completion = Math.round(((completedParts + activeLessonAnswered / Math.max(1, activeQuestions.length)) / 6) * 100);
  const activeLessonPassed = progress.completed.includes(`bai-${selectedLesson}`);
  const boundedCompletion = activeLessonPassed ? 100 : Math.min(99, completion);
  const completedLessonCount = lessons.filter((lesson) => progress.completed.includes(`bai-${lesson.n}`)).length;
  const courseCompleted = completedLessonCount === lessons.length;
  const nextLesson = lessons.find((lesson) => !progress.completed.includes(`bai-${lesson.n}`)) ?? lessons[lessons.length - 1];
  const nextLessonPart = courseCompleted
    ? learningFlow[0]
    : learningFlow.find((part) => !progress.completed.includes(courseProgressKey(part.id, nextLesson.n))) ?? learningFlow[0];
  const nextLessonPartNumber = learningFlow.findIndex((part) => part.id === nextLessonPart.id) + 1;
  const courseCompletion = Math.round((completedLessonCount / lessons.length) * 100);
  const fontStack = fontOptions.find((item) => item.id === appearance.font)?.stack ?? fontOptions[0].stack;
  const legacyProfileName = splitLegacyLearnerName(deviceAccess?.learnerName);
  const learnerGivenName = deviceAccess?.learnerGivenName?.trim() || legacyProfileName.learnerGivenName || "Học viên";
  const learnerFullName = deviceAccess?.learnerName?.trim() || [deviceAccess?.learnerFamilyName, learnerGivenName].filter(Boolean).join(" ");
  const learnerInitial = learnerGivenName.slice(0, 1).toUpperCase();
  const usesDarkBackground = darkBackground(appearance.background);
  const activeLessonCanSubmit = canSubmitLesson(progress.completed, selectedLesson);
  const activeSubmissionReady = activeLessonAnswered === activeQuestions.length && activeLessonCanSubmit;
  const activeSubmissionStatus = activeLessonAnswered < activeQuestions.length
    ? `Còn ${activeQuestions.length - activeLessonAnswered} câu chưa trả lời`
    : !activeLessonCanSubmit
      ? "Cần hoàn thành đủ phần 1–4/5"
      : `Đã trả lời đủ ${activeQuestions.length} câu`;
  const activeSubmissionHint = activeLessonCanSubmit
    ? "Nút nộp chỉ mở khi tất cả số câu chuyển sang trạng thái đã chọn."
    : "Hãy hoàn thành Học, Thực hành, Phân tích và Ôn tập trước khi nộp kiểm tra.";

  useEffect(() => {
    if (!courseCompleted || !networkOnline || !deviceCredential || !deviceAccess || certificateAttempted.current) return;
    certificateAttempted.current = true;
    setCertificateBusy(true);
    issueCertificate(deviceCredential, deviceAccess)
      .then((issued) => setCertificate(issued))
      .catch(() => { certificateAttempted.current = false; })
      .finally(() => setCertificateBusy(false));
  }, [courseCompleted, deviceAccess, deviceCredential, networkOnline]);

  function hasLessonActivity(lessonNumber: string) {
    if (progress.completed.includes(`bai-${lessonNumber}`)) return true;
    if (lessonNumber === "03") {
      return progress.completed.some((key) => lessonParts.includes(key as Exclude<SectionId, "tong-quan" | "ai-hoc-tap" | "du-lieu">)) || Object.keys(progress.answers).length > 0;
    }
    return progress.completed.some((key) => key.endsWith(`-${lessonNumber}`)) || Object.keys(progress.lessonAnswers).some((key) => key.startsWith(`${lessonNumber}-`));
  }

  function isLessonUnlocked(lessonNumber: string) {
    const index = lessons.findIndex((lesson) => lesson.n === lessonNumber);
    if (index <= 0 || hasLessonActivity(lessonNumber)) return true;
    return progress.completed.includes(`bai-${lessons[index - 1].n}`);
  }

  function navigate(id: SectionId) {
    setQuestion(0);
    if (id === "tong-quan") setSelectedLesson(nextLesson.n);
    setSection(id);
    setMobileNav(false);
  }

  function openLesson(lessonNumber: string) {
    if (!isLessonUnlocked(lessonNumber)) {
      const index = lessons.findIndex((lesson) => lesson.n === lessonNumber);
      setNotice(`Hãy đạt tối thiểu 8/10 ở Bài ${lessons[index - 1].n} trước khi mở Bài ${lessonNumber}.`);
      return;
    }
    setSelectedLesson(lessonNumber);
    setQuestion(0);
    setSection("hoc-tap");
    setMobileNav(false);
  }

  function openLearningStep(lessonNumber: string, target: Exclude<SectionId, "tong-quan" | "ai-hoc-tap" | "du-lieu">) {
    if (!isLessonUnlocked(lessonNumber)) {
      const index = lessons.findIndex((lesson) => lesson.n === lessonNumber);
      setNotice(`Hãy đạt tối thiểu 8/10 ở Bài ${lessons[index - 1].n} trước khi mở Bài ${lessonNumber}.`);
      return;
    }
    setSelectedLesson(lessonNumber);
    setQuestion(0);
    setSection(target);
    setMobileNav(false);
  }

  function openPractice(lessonNumber: string) {
    if (!isLessonUnlocked(lessonNumber)) {
      const index = lessons.findIndex((lesson) => lesson.n === lessonNumber);
      setNotice(`Khu thực hành Bài ${lessonNumber} sẽ mở sau khi hoàn thành Bài ${lessons[index - 1].n}.`);
      return;
    }
    setSelectedLesson(lessonNumber);
    setSection("thuc-hanh");
    setMobileNav(false);
  }

  async function refreshDeviceAccess() {
    if (!deviceCredential) return;
    setDeviceChecking(true);
    try {
      const access = await registerDeviceCredential(deviceCredential);
      setDeviceAccess(access);
      setDeviceError("");
    } catch (error) {
      setDeviceError(error instanceof Error ? error.message : "Chưa thể kiểm tra quyền thiết bị.");
    } finally {
      setDeviceChecking(false);
    }
  }

  async function submitDeviceRegistration(fields: LearnerRegistrationFields) {
    if (!deviceCredential || !deviceAccess) throw new Error("Thiết bị chưa sẵn sàng để đăng ký.");
    const access = await saveDeviceRegistration(deviceCredential, deviceAccess, fields);
    setDeviceAccess(access);
    setHasEnteredLearning(false);
    setDeviceError("");
  }

  async function submitPaymentProof(file: File) {
    if (!deviceCredential || !deviceAccess) throw new Error("Thiết bị chưa sẵn sàng để gửi ảnh.");
    const access = await uploadPaymentProof(deviceCredential, deviceAccess, file);
    setDeviceAccess(access);
    setDeviceError("");
  }

  function queueCourseAction(payload: Record<string, unknown>, allowOffline = false): Promise<CourseApiResponse> {
    if (!deviceCredential || deviceAccess?.status !== "approved") {
      return Promise.reject(new Error("Thiết bị học tập chưa được cấp quyền."));
    }
    const outgoing = allowOffline ? { ...payload, clientEventId: offlineActionId(payload) } : payload;
    const result: Promise<CourseApiResponse> = actionQueue.current
      .then(() => {
        if (allowOffline && !navigator.onLine) throw new TypeError("OFFLINE");
        return postCourse(deviceCredential, deviceAccess, outgoing);
      })
      .catch(async (error) => {
        if (error instanceof CourseApiError && error.device) setDeviceAccess(error.device);
        if (allowOffline && (!navigator.onLine || !(error instanceof CourseApiError))) {
          await enqueueOfflineAction(outgoing);
          setNetworkOnline(false);
          await refreshPendingSyncCount();
          return { queued: true } satisfies CourseApiResponse;
        }
        throw error;
      });
    actionQueue.current = result.then(() => undefined, () => undefined);
    return result;
  }

  function markComplete(id: string) {
    const requestedPart = lessonParts.find((part) => progressKey(part) === id);
    if (requestedPart) {
      const missingPart = firstMissingPrerequisite(progress.completed, selectedLesson, requestedPart);
      if (missingPart) {
        const missingNumber = lessonParts.indexOf(missingPart) + 1;
        const missingLabel = navItems.find((item) => item.id === missingPart)?.label ?? "phần trước";
        setNotice(`Hãy hoàn thành phần ${missingNumber}/5 · ${missingLabel} trước khi ghi nhận phần này.`);
        setQuestion(0);
        setSection(missingPart);
        setMobileNav(false);
        return false;
      }
    }

    setProgress((current) => ({
      ...current,
      completed: current.completed.includes(id) ? current.completed : [...current.completed, id],
    }));
    if (requestedPart) {
      queueCourseAction({ action: "complete", lessonNumber: selectedLesson, part: requestedPart }, true)
        .then((data) => {
          if (data.queued) {
            setNotice("Đã lưu trên thiết bị. Tiến độ sẽ tự đồng bộ khi có mạng.");
            return;
          }
          if (data.state) {
            setServerScores(data.state.scores);
            setProgress((current) => ({ ...current, completed: data.state!.completed }));
          }
        })
        .catch((error) => setNotice(error instanceof Error ? error.message : "Chưa thể lưu tiến độ lên máy chủ."));
    }
    setNotice("Đã ghi nhận tiến độ của phần này.");
    return true;
  }

  function chooseAnswer(answer: number) {
    if (progress.submitted) return;
    setProgress((current) => ({ ...current, answers: { ...current.answers, [question]: answer } }));
  }

  function chooseLessonAnswer(key: string, answer: number) {
    if (progress.lessonSubmitted.includes(selectedLesson)) return;
    setProgress((current) => ({
      ...current,
      lessonAnswers: { ...current.lessonAnswers, [key]: answer },
    }));
  }

  function toggleLessonFlag() {
    setProgress((current) => {
      const flags = current.lessonFlags[selectedLesson] ?? [];
      return {
        ...current,
        lessonFlags: {
          ...current.lessonFlags,
          [selectedLesson]: flags.includes(question) ? flags.filter((item) => item !== question) : [...flags, question],
        },
      };
    });
  }

  async function submitLessonQuiz() {
    if (!networkOnline) {
      setNotice("Bài kiểm tra cần kết nối mạng để chấm điểm an toàn trên máy chủ.");
      return;
    }
    if (activeLessonAnswered < activeQuestions.length) return;
    if (!canSubmitLesson(progress.completed, selectedLesson)) {
      const missingPart = firstMissingPrerequisite(progress.completed, selectedLesson, "kiem-tra");
      if (missingPart) {
        const missingNumber = lessonParts.indexOf(missingPart) + 1;
        const missingLabel = navItems.find((item) => item.id === missingPart)?.label ?? "phần trước";
        setNotice(`Hãy hoàn thành phần ${missingNumber}/5 · ${missingLabel} trước khi nộp kiểm tra.`);
        setSection(missingPart);
      }
      return;
    }
    try {
      const answers = activeQuestions.map((_, index) => progress.lessonAnswers[`${selectedLesson}-${index}`]);
      const data = await queueCourseAction({ action: "submit", lessonNumber: selectedLesson, answers });
      if (data.score === undefined || !data.state) return;
      setServerScores(data.state.scores);
      if (!data.passed) {
        setProgress((current) => ({
          ...current,
          lessonAnswers: Object.fromEntries(Object.entries(current.lessonAnswers).filter(([key]) => !key.startsWith(`${selectedLesson}-`))),
          lessonFlags: { ...current.lessonFlags, [selectedLesson]: [] },
          lessonChecked: { ...current.lessonChecked, [selectedLesson]: [] },
          lessonSubmitted: current.lessonSubmitted.filter((lessonNumber) => lessonNumber !== selectedLesson),
          completed: data.state!.completed,
        }));
        setQuestion(0);
        setNotice(`${learnerGivenName} đạt ${data.score}/${activeQuestions.length}, chưa đủ ${activePassScore}/${activeQuestions.length}. Bài kiểm tra đã được đặt lại từ câu 1.`);
        return;
      }
      setProgress((current) => ({ ...current, lessonSubmitted: current.lessonSubmitted.includes(selectedLesson) ? current.lessonSubmitted : [...current.lessonSubmitted, selectedLesson], completed: data.state!.completed }));
      setNotice(`Đạt ${data.score}/${activeQuestions.length}. Bài ${selectedLesson} đã hoàn thành.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Chưa thể nộp bài kiểm tra.");
    }
  }

  function toggleFlag() {
    setProgress((current) => ({
      ...current,
      flags: current.flags.includes(question)
        ? current.flags.filter((item) => item !== question)
        : [...current.flags, question],
    }));
  }

  async function submitQuiz() {
    if (!networkOnline) {
      setNotice("Bài kiểm tra cần kết nối mạng để chấm điểm an toàn trên máy chủ.");
      return;
    }
    if (answered < questions.length) return;
    if (!canSubmitLesson(progress.completed, "03")) {
      const missingPart = firstMissingPrerequisite(progress.completed, "03", "kiem-tra");
      if (missingPart) {
        const missingNumber = lessonParts.indexOf(missingPart) + 1;
        const missingLabel = navItems.find((item) => item.id === missingPart)?.label ?? "phần trước";
        setNotice(`Hãy hoàn thành phần ${missingNumber}/5 · ${missingLabel} trước khi nộp kiểm tra.`);
        setSection(missingPart);
      }
      return;
    }
    try {
      const answers = questions.map((_, index) => progress.answers[index]);
      const data = await queueCourseAction({ action: "submit", lessonNumber: "03", answers });
      if (data.score === undefined || !data.state) return;
      setServerScores(data.state.scores);
      if (!data.passed) {
        setProgress((current) => ({ ...current, answers: {}, flags: [], checked: [], submitted: false, completed: data.state!.completed }));
        setQuestion(0);
        setNotice(`${learnerGivenName} đạt ${data.score}/${questions.length}, chưa đủ 8/10. Bài kiểm tra đã được đặt lại từ câu 1.`);
        return;
      }
      setProgress((current) => ({ ...current, submitted: true, completed: data.state!.completed }));
      setNotice(`Đạt ${data.score}/10. Bài 03 đã hoàn thành.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Chưa thể nộp bài kiểm tra.");
    }
  }

  function exportProgress() {
    const payload = JSON.stringify({ hoc_vien: learnerFullName, mon_hoc: "Ứng dụng AI trong dạy và học môn Bơi ếch", bai_hoc_dang_mo: `Bài ${selectedLesson}`, ngay_sao_luu: new Date().toISOString(), tien_do: progress }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "tien-do-boi-ech-toan-lo-trinh.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!ready || deviceAccess?.status !== "approved" || !deviceAccess.registrationComplete || deviceAccess.accessExpired || !hasEnteredLearning) {
    return (
      <><DeviceGate
          device={deviceAccess}
          error={deviceError}
          checking={deviceChecking}
          onRetry={() => void refreshDeviceAccess()}
          onRegister={submitDeviceRegistration}
          onUploadPayment={submitPaymentProof}
          onEnter={() => setHasEnteredLearning(true)}
        />{installPrompt ? <InstallAppButton install={() => void installWebApp()} /> : null}</>
    );
  }

  return (
    <div
      className={`app-shell ${installPrompt ? "has-install-prompt" : ""}`}
      style={{
        "--app-background": appearance.background,
        "--page-ink": usesDarkBackground ? "#f4fbfb" : "#102b3f",
        "--page-muted": usesDarkBackground ? "#cee2e4" : "#5d7282",
        "--site-font": fontStack,
        "--font-adjust": `${appearance.textSize}px`,
      } as React.CSSProperties}
    >
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <div className="brand-row">
          <button className="brand" onClick={() => navigate("tong-quan")} aria-label="Về trang tổng quan">
            <span className="brand-mark"><i /><i /><i /></span>
            <span><strong>Bơi ếch AI</strong><small>Dạy và học thông minh</small></span>
          </button>
          <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Đóng điều hướng"><Icon name="close" /></button>
        </div>

        <nav aria-label="Điều hướng môn học">
          <p className="nav-label">Không gian học</p>
          {navItems.map((item) => (
            <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => navigate(item.id)}>
              <Icon name={item.id} />
              <span><b>{item.label}</b><small>{item.hint}</small></span>
            </button>
          ))}
        </nav>

        <div className="sidebar-progress">
          <div><span>Tiến độ Bài {selectedLesson}</span><strong>{boundedCompletion}%</strong></div>
          <div className="progress-track"><i style={{ width: `${boundedCompletion}%` }} /></div>
          <small>Đã xác thực và đồng bộ theo thiết bị</small>
        </div>
      </aside>

      {mobileNav && <button className="nav-scrim" aria-label="Đóng điều hướng" onClick={() => setMobileNav(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Mở điều hướng"><Icon name="menu" /></button>
          <div className="breadcrumb"><span>Môn học độc lập</span><i /> <strong>{navItems.find((item) => item.id === section)?.label}</strong></div>
          <div className="topbar-actions">
            <button className={`network-state ${networkOnline ? "online" : "offline"}`} onClick={() => void flushOfflineQueue()} title={usingOfflineLesson ? "Nội dung đang được mở từ bộ nhớ thiết bị" : undefined}><i />{networkOnline ? pendingSyncCount > 0 ? `Đồng bộ ${pendingSyncCount} mục` : "Đã kết nối" : `Học offline${pendingSyncCount > 0 ? ` · ${pendingSyncCount} mục chờ` : ""}`}</button>
            <div className="learner-chip" title={`${learnerFullName} · ${deviceAccess.personCode ?? ""}`}><span>{learnerInitial}</span><div><small>{deviceAccess.personRole === "teacher" ? "Giảng viên" : "Học viên"}</small><strong>Chào {learnerGivenName}</strong></div></div>
            <div className="top-status"><span className="status-dot" /> {section === "tong-quan" ? `${completedLessonCount}/8 bài đã đạt` : section === "ai-hoc-tap" ? "AI có nguồn dẫn" : section === "thuc-hanh" ? `Đang luyện Bài ${selectedLesson}` : `Bài ${selectedLesson} đang mở`}</div>
            <span className={`payment-access-status ${deviceAccess.accessGroup}`}>{deviceAccess.paymentStatus === "paid_verified" ? "Đã trả phí" : deviceAccess.paymentStatus === "free_approved" ? `Miễn phí${deviceAccess.accessDaysRemaining !== null ? ` · ${deviceAccess.accessDaysRemaining} ngày` : ""}` : "Chưa thanh toán"}</span>
            {deviceAccess.personRole === "teacher" && deviceAccess.personalEditEnabled && officialContent ? <div className="personal-content-actions"><button className="personal-edit-trigger" onClick={() => setLocalStudioOpen(true)}><span>{hasLocalOverride ? "Đang dùng bản riêng" : "Sửa bản riêng"}</span><b>Bài {selectedLesson}</b></button>{hasLocalOverride ? <button className="personal-reset-trigger" onClick={() => void confirmResetPersonalContent()} title="Xóa bản sửa cục bộ và dùng lại nội dung máy chủ"><span>↺</span> Bản máy chủ</button> : null}</div> : null}
            {deviceAccess.personRole === "teacher" ? <a className="editor-request-link" href={`/bien-tap-noi-dung?lesson=${selectedLesson}`}><span>Xin quyền chỉnh sửa</span><b>Bài {selectedLesson}</b></a> : null}
            <button className="appearance-trigger" onClick={() => setAppearanceOpen(true)} aria-expanded={appearanceOpen} aria-controls="appearance-panel"><span aria-hidden="true">Aa</span> Giao diện</button>
          </div>
        </header>

        {appearanceOpen && (
          <>
            <button className="appearance-scrim" aria-label="Đóng bảng Giao diện" onClick={() => setAppearanceOpen(false)} />
            <aside id="appearance-panel" className="appearance-panel" role="dialog" aria-modal="true" aria-labelledby="appearance-title">
              <header><div><span>Tùy chỉnh hiển thị</span><h2 id="appearance-title">Giao diện</h2></div><button onClick={() => setAppearanceOpen(false)} aria-label="Đóng">×</button></header>

              <section>
                <label>Nền trang</label>
                <p>Chọn nền dịu mắt hoặc tự chọn màu riêng.</p>
                <div className="background-options">
                  {backgroundOptions.map((item) => <button key={item.value} className={appearance.background === item.value ? "active" : ""} onClick={() => setAppearance((current) => ({ ...current, background: item.value }))}><i style={{ background: item.value }} /><span>{item.name}</span></button>)}
                </div>
                <label className="color-picker">Màu nền tùy chọn <input type="color" value={appearance.background} onChange={(event) => setAppearance((current) => ({ ...current, background: event.target.value }))} /></label>
              </section>

              <section>
                <label>Cỡ chữ</label>
                <p>Tăng đồng đều chữ nội dung, nhãn và nút bấm.</p>
                <div className="segmented-control">
                  {([{ value: 0, label: "Tiêu chuẩn" }, { value: 2, label: "Lớn" }, { value: 4, label: "Rất lớn" }] as const).map((item) => <button key={item.value} className={appearance.textSize === item.value ? "active" : ""} onClick={() => setAppearance((current) => ({ ...current, textSize: item.value }))}>{item.label}</button>)}
                </div>
              </section>

              <section>
                <label>Font chữ</label>
                <div className="font-options">
                  {fontOptions.map((item) => <button key={item.id} className={appearance.font === item.id ? "active" : ""} style={{ fontFamily: item.stack }} onClick={() => setAppearance((current) => ({ ...current, font: item.id }))}><strong>{item.name}</strong><span>{item.sample}</span></button>)}
                </div>
              </section>

              <footer><button onClick={() => setAppearance(defaultAppearance)}>Khôi phục mặc định</button><span>Tự lưu trên thiết bị</span></footer>
            </aside>
          </>
        )}

        {localStudioOpen && activeContent && deviceAccess.personalEditEnabled ? <LocalContentStudio
          lessonNumber={selectedLesson}
          content={activeContent}
          onSave={savePersonalContent}
          onReset={resetPersonalContent}
          onClose={() => setLocalStudioOpen(false)}
          hasLocalOverride={hasLocalOverride}
        /> : null}

        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span><button onClick={() => setNotice("")} aria-label="Đóng thông báo">×</button>
          </div>
        )}

        {section === "tong-quan" && (
          <div className="page page-overview">
            <section className="overview-hero">
              <div className="overview-hero-copy">
                <span className="hero-kicker">Ứng dụng AI trong dạy và học môn Bơi ếch</span>
                <h1>Học đúng thứ tự, <em>sửa đúng một lỗi</em> rồi mới tăng quãng bơi.</h1>
                <p>Bắt đầu từ an toàn và kiểm soát cơ thể; học riêng từng kỹ thuật; sau đó mới phối hợp, sửa lỗi và luyện thành kỹ năng ổn định.</p>
                <div className="hero-actions">
                  <button className="primary-button" onClick={() => openLearningStep(nextLesson.n, nextLessonPart.id)}>{courseCompleted ? "Xem lại lộ trình" : `Học phần ${nextLessonPartNumber}/5`} <span>→</span></button>
                  <button className="text-button" onClick={() => navigate("ai-hoc-tap")}>Mở trợ giảng Frog AI</button>
                  <button className="text-button" onClick={() => navigate("du-lieu")}>Xem tiến độ đã lưu</button>
                </div>
                <div className="hero-metrics">
                  <div><strong>{String(completedLessonCount).padStart(2, "0")}/08</strong><span>Bài đã đạt</span></div>
                  <div><strong>05</strong><span>Bước tuần tự</span></div>
                  <div><strong>8/10</strong><span>Điều kiện qua bài</span></div>
                </div>
              </div>

              <aside className="next-step-card" aria-label="Việc học tiếp theo">
                <span>{courseCompleted ? "Lộ trình đã hoàn tất" : "Chỉ dẫn học tiếp theo"}</span>
                <div className="next-step-position"><b>Bài {nextLesson.n}</b><i /> <b>Phần {nextLessonPartNumber}/5</b></div>
                <h2>{nextLesson.title}</h2>
                <strong>{nextLessonPart.label} · {nextLessonPart.purpose}</strong>
                <div className="step-meter" aria-label={`Đang ở phần ${nextLessonPartNumber} trên 5`}>
                  {learningFlow.map((item, index) => <i key={item.id} className={index < nextLessonPartNumber ? "filled" : ""} />)}
                </div>
                <p>{courseCompleted ? `${learnerGivenName} có thể xem lại từng bước; hãy ưu tiên bài còn yếu trong dữ liệu tiến độ.` : nextLessonPart.checkpoint}</p>
                <button onClick={() => openLearningStep(nextLesson.n, nextLessonPart.id)}>{courseCompleted ? "Mở Bài 08 để xem lại" : `Mở phần ${nextLessonPart.label}`} <span>→</span></button>
              </aside>
            </section>

            <section className={`course-progress-panel ${courseCompleted ? "complete" : ""}`}>
              <div><span>Tiến độ của {learnerGivenName}</span><strong>{completedLessonCount}/8 bài đã đạt</strong><p>{courseCompleted ? `${learnerGivenName} đã hoàn thành đủ 40 phần học và đạt bài kiểm tra của cả tám bài.` : `${learnerGivenName} đang ở Bài ${nextLesson.n}, phần ${nextLessonPartNumber}/5 · ${nextLessonPart.label}. Hoàn thành đúng thứ tự và đạt 8/10 để mở bài kế tiếp.`}</p></div>
              <div className="course-progress-meter" aria-label={`Tiến độ toàn lộ trình ${courseCompletion}%`}><i style={{ width: `${courseCompletion}%` }} /></div>
            </section>

            <section className="learning-method-section">
              <SectionHeading eyebrow="Phương pháp bắt buộc" title="Một bài học luôn đi qua năm bước" text="Không nhảy thẳng vào kiểm tra và không ghép toàn bộ động tác khi kỹ thuật thành phần chưa ổn định." />
              <div className="learning-flow-grid">
                {learningFlow.map((item, index) => {
                  const done = courseCompleted || progress.completed.includes(courseProgressKey(item.id, nextLesson.n));
                  const active = !courseCompleted && item.id === nextLessonPart.id;
                  const available = courseCompleted || done || active;
                  return (
                    <button key={item.id} className={`${done ? "done" : ""} ${active ? "active" : ""}`} disabled={!available} onClick={() => openLearningStep(nextLesson.n, item.id)}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <small>{done ? "Đã hoàn thành" : active ? "Cần làm tiếp" : "Chưa đến bước"}</small>
                      <strong>{item.label}</strong>
                      <p>{item.purpose}</p>
                      <em>{item.checkpoint}</em>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="method-guardrails">
              <div className="guardrail-heading"><span>Nguyên tắc chống học sai</span><h2>Mỗi buổi chỉ cần đúng hơn ở một điểm</h2><p>Giữ lượng thông tin vừa đủ để người học quan sát được thay đổi của chính mình.</p></div>
              <div className="guardrail-list">
                <article><i>01</i><div><strong>Không học gộp ngay</strong><p>Ổn định tư thế và từng động tác riêng trước khi ghép tay – chân – thở.</p></div></article>
                <article><i>02</i><div><strong>Mỗi lượt sửa một lỗi</strong><p>Chọn lỗi làm giảm an toàn hoặc hiệu quả nhiều nhất; sửa xong mới chuyển lỗi khác.</p></div></article>
                <article><i>03</i><div><strong>Tăng quãng bơi có điều kiện</strong><p>Chỉ tăng từ 5 m lên 10 m rồi 25 m khi kỹ thuật vẫn giữ được ở cuối quãng.</p></div></article>
                <article className="safety"><i>!</i><div><strong>An toàn đứng trước tiến độ</strong><p>Luôn có người giám sát; dừng ngay khi đau, chuột rút, chóng mặt hoặc khó thở.</p></div></article>
              </div>
            </section>

            <section className="curriculum-section">
              <SectionHeading eyebrow="Lộ trình tám bài" title="Bốn giai đoạn, không có đường tắt" text="Mỗi giai đoạn tạo tiền đề trực tiếp cho giai đoạn sau; bài đang khóa chỉ mở khi bài trước đạt yêu cầu." />
              <div className="roadmap-groups">
                {roadmapGroups.map((group) => (
                  <section className="roadmap-stage" key={group.number}>
                    <header><span>Giai đoạn {group.number}</span><div><h3>{group.title}</h3><p>{group.note}</p></div></header>
                    <div className="lesson-grid roadmap-lesson-grid">
                      {group.lessons.map((lessonNumber) => {
                        const lesson = lessons.find((item) => item.n === lessonNumber)!;
                        const index = lessons.findIndex((item) => item.n === lesson.n);
                        const done = progress.completed.includes(`bai-${lesson.n}`);
                        const locked = !isLessonUnlocked(lesson.n);
                        const current = !courseCompleted && lesson.n === nextLesson.n;
                        return (
                          <button key={lesson.n} className={`lesson-card ${current ? "current" : ""} ${done ? "done" : ""} ${locked ? "locked" : ""}`} onClick={() => openLesson(lesson.n)} disabled={locked}>
                            <span className="lesson-number">{lesson.n}</span>
                            <span className="lesson-content"><small>{done ? "Đã hoàn thành" : locked ? "Chưa mở" : current ? `Đang ở phần ${nextLessonPartNumber}/5` : "Sẵn sàng"}</small><strong>{lesson.title}</strong><em>{locked ? `Đạt Bài ${String(index).padStart(2, "0")} để mở` : done ? "Đã đạt tối thiểu 8/10" : lesson.target}</em></span>
                            <span className="lesson-arrow">{done ? "✓" : locked ? "—" : "→"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          </div>
        )}

        {section !== "tong-quan" && section !== "ai-hoc-tap" && section !== "du-lieu" && !activeContent && (
          <div className="page secure-loading" role="status"><span>Đang xác thực thiết bị</span><h2>Đang cấp nội dung Bài {selectedLesson}</h2><p>Máy chủ chỉ gửi đúng bài đang được phép học.</p></div>
        )}

        {section === "ai-hoc-tap" && deviceCredential && deviceAccess ? (
          <AiLearningHub
            learnerName={learnerGivenName}
            currentLesson={selectedLesson}
            online={networkOnline}
            request={(payload) => postAi(deviceCredential, deviceAccess, payload)}
            onNavigate={(lessonNumber, target) => openLearningStep(lessonNumber, target as Exclude<SectionId, "tong-quan" | "ai-hoc-tap" | "du-lieu">)}
            onNotice={setNotice}
          />
        ) : null}

        {section === "hoc-tap" && selectedPracticeDetail && activeContent?.kind === "foundation" && (
          <FoundationLesson
            lesson={activeLesson}
            detail={selectedPracticeDetail}
            visuals={activeContent.visuals}
            completed={progress.completed.includes(progressKey("hoc-tap"))}
            onComplete={() => markComplete(progressKey("hoc-tap"))}
            onOpenPractice={openPractice}
          />
        )}

        {section === "hoc-tap" && selectedLesson !== "01" && selectedLesson !== "02" && selectedLesson !== "03" && selectedLesson !== "04" && selectedLesson !== "05" && selectedLesson !== "06" && selectedLesson !== "07" && selectedLesson !== "08" && (
          <div className="page outline-page">
            <section className="outline-hero">
              <div>
                <span className="lesson-tag">Bài {activeLesson.n} · {activeLesson.group}</span>
                <h1>{activeLesson.title}</h1>
                <p>{activeLesson.summary}</p>
              </div>
              <div className="outline-status">
                <span>Thời lượng dự kiến</span>
                <strong>{activeLesson.duration}</strong>
                <small>Đề cương nội dung đã hoàn tất</small>
              </div>
            </section>

            <section className="outline-target">
              <span>Chuẩn hoàn thành bài</span>
              <h2>{activeLesson.target}</h2>
            </section>

            <section className="outline-block">
              <SectionHeading eyebrow="Mục tiêu đầu ra" title="Ba năng lực cần đạt" text="Mục tiêu được viết theo hành động có thể quan sát hoặc kiểm tra tại bể." />
              <div className="outline-objectives">
                {activeLesson.objectives.map((item, index) => <article key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></article>)}
              </div>
            </section>

            <section className="outline-block">
              <SectionHeading eyebrow="Khung nội dung" title="Bốn phần kiến thức cốt lõi" text="Mỗi phần sẽ được phát triển thành lý thuyết, hình động tác và tín hiệu tự sửa ở lượt viết bài chi tiết." />
              <div className="outline-core-grid">
                {activeLesson.core.map((item, index) => <article key={item.title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{item.title}</h3><p>{item.body}</p></article>)}
              </div>
            </section>

            <section className="outline-two-column">
              <article>
                <span className="outline-label">Thực hành trọng tâm</span>
                <h2>Từ dễ đến hoàn chỉnh</h2>
                <ol>{activeLesson.practice.map((item) => <li key={item}>{item}</li>)}</ol>
              </article>
              <article className="pass-card">
                <span className="outline-label">Điều kiện hoàn thành</span>
                <h2>Chỉ chuyển bài khi đạt</h2>
                <ul>{activeLesson.pass.map((item) => <li key={item}><i>✓</i><span>{item}</span></li>)}</ul>
              </article>
            </section>

            <section className="outline-bridge">
              <div><span>Kết nối lộ trình</span><strong>{activeLesson.bridge}</strong></div>
              <div className="outline-actions">
                <button className="text-button" onClick={() => openLesson(String(Math.max(1, Number(activeLesson.n) - 1)).padStart(2, "0"))} disabled={activeLesson.n === "01"}>← Bài trước</button>
                <button className="primary-button" onClick={() => openLesson(String(Math.min(8, Number(activeLesson.n) + 1)).padStart(2, "0"))} disabled={activeLesson.n === "08"}>Xem bài tiếp theo <span>→</span></button>
              </div>
            </section>
          </div>
        )}

        {section === "hoc-tap" && selectedLesson === "03" && movementContent && phases.length > 0 && (
          <div className="page lesson-page">
            <section className="lesson-hero">
              <div>
                <span className="lesson-tag">Bài 03 · Kỹ thuật cốt lõi</span>
                <h1>Kỹ thuật chân bơi ếch</h1>
                <p>Từ chu kỳ bốn pha đến một cú đạp gọn, mạnh và ít lực cản.</p>
              </div>
              <div className="lesson-hero-stats"><span><b>60′</b> lý thuyết</span><span><b>45–60′</b> thực hành</span><span><b>8/10</b> mức đạt</span></div>
              <LessonFigure visual={movementContent.visuals.cover} label="Chu kỳ chân bơi ếch · quan sát toàn thân trước khi tách pha" eager />
            </section>

            <section className="safety-card">
              <div className="safety-icon">!</div>
              <div><span>An toàn bắt buộc</span><p>Chỉ tập tại khu vực được phép và có người giám sát đủ năng lực. Không bơi một mình. Dừng ngay khi đau gối, chuột rút, chóng mặt hoặc khó thở.</p></div>
            </section>

            <section className="objectives-block">
              <div className="objective-lead"><span>Đầu ra bài học</span><h2>Sau bài này, {learnerGivenName} cần làm được gì?</h2><p>Không chỉ “biết” động tác, mà phải quan sát được chính mình và chọn đúng cách sửa.</p></div>
              <div className="objective-list">
                {[
                  "Mô tả đúng bốn pha của chu kỳ chân.",
                  "Giải thích vì sao thu chân rộng làm tăng lực cản.",
                  "Thực hiện hai chân đồng thời, bàn chân bẻ đúng lúc.",
                  "Nhận diện ít nhất ba lỗi và chọn bài tập sửa phù hợp.",
                  "Hoàn thành bài tự kiểm với tối thiểu 8/10 câu đúng.",
                ].map((item, index) => <div key={item}><i>{index + 1}</i><span>{item}</span></div>)}
              </div>
            </section>

            <section className="phase-learning">
              <SectionHeading eyebrow="Nội dung trọng tâm" title="Bản đồ chu kỳ bốn pha" text="Chọn từng pha để xem mục đích, dấu hiệu đúng và lỗi cần tránh." />
              <div className="phase-tabs" role="tablist" aria-label="Bốn pha động tác chân">
                {phases.map((item, index) => (
                  <button key={item.id} role="tab" aria-selected={phase === index} className={phase === index ? "active" : ""} onClick={() => setPhase(index)}>
                    <span>{item.number}</span><b>{item.short}</b>
                  </button>
                ))}
              </div>
              <div className="phase-detail">
                <LessonFigure visual={movementContent.visuals.technique[phase % movementContent.visuals.technique.length]} label={`Pha ${phases[phase].number} · ${phases[phase].title}`} />
                <div className="phase-copy">
                  <span>Pha {phases[phase].number}</span>
                  <h3>{phases[phase].title}</h3>
                  <p>{phases[phase].action}</p>
                  <dl>
                    <div><dt>Mục đích</dt><dd>{phases[phase].purpose}</dd></div>
                    <div><dt>Khẩu lệnh</dt><dd>{phases[phase].cue}</dd></div>
                    <div className="avoid"><dt>Cần tránh</dt><dd>{phases[phase].avoid}</dd></div>
                  </dl>
                </div>
              </div>
            </section>

            <section className="principle-grid">
              <div><span>01</span><b>Thu chậm và gọn</b><p>Giảm diện tích cản phía trước.</p></div>
              <div><span>02</span><b>Chuyển bàn chân nhanh</b><p>Tạo mặt tỳ đúng trước khi đạp.</p></div>
              <div><span>03</span><b>Đạp tăng tốc</b><p>Hướng phần lớn lực ra sau.</p></div>
              <div><span>04</span><b>Khép kín và lướt</b><p>Trở lại tư thế thuôn dòng.</p></div>
            </section>

            <section className="learning-footer">
              <div><span>Ghi nhớ bằng một nhịp</span><strong>“Thu… bẻ — đạp khép… lướt.”</strong></div>
              <button className="primary-button" onClick={() => { if (markComplete("hoc-tap")) openPractice("03"); }}>Hoàn thành phần 1/5 · thực hành Bài 03 <span>→</span></button>
            </section>
          </div>
        )}

        {section === "thuc-hanh" && (
          <div className="page practice-page">
            <SectionHeading eyebrow={`Khu thực hành · Bài ${selectedLesson}`} title={`Bài tập riêng: ${activeLesson.title}`} text="Mỗi bài trong lộ trình đều có thực hành riêng. Chọn bài bên dưới để xem đúng bài tập, khối lượng, dấu hiệu đạt và yêu cầu an toàn." />
            <div className="practice-lesson-picker" aria-label="Chọn bài thực hành">
              {lessons.map((lesson) => {
                const practiceKey = progressKey("thuc-hanh", lesson.n);
                return <button key={lesson.n} className={`${selectedLesson === lesson.n ? "active" : ""} ${progress.completed.includes(practiceKey) ? "done" : ""}`} onClick={() => openPractice(lesson.n)}><span>Bài {lesson.n}</span><strong>{lesson.title}</strong><i>{progress.completed.includes(practiceKey) ? "✓" : "→"}</i></button>;
              })}
            </div>
            <div className="practice-layout">
              <div className="drill-list">
                {(selectedLesson === "03" ? practice : selectedPracticeDetail?.drills ?? []).map((item, index) => (
                  <article key={item.code} className="drill-card">
                    {activeVisuals && <LessonFigure visual={activeVisuals.technique[(index + 3) % activeVisuals.technique.length]} label={`Bài tập ${item.code}`} />}
                    <div className="drill-index"><span>{item.code}</span><i>{index + 1}</i></div>
                    <div className="drill-main"><h3>{"name" in item ? item.name : item.title}</h3><p>{item.goal}</p><div><span>Khối lượng</span><strong>{item.volume}</strong></div>{"steps" in item && <ol>{item.steps.map((step) => <li key={step}>{step}</li>)}</ol>}</div>
                    <div className="drill-safe"><span>{"pass" in item ? "Dấu hiệu đạt" : "Kiểm soát an toàn"}</span>{"pass" in item && <strong>{item.pass}</strong>}<p>{item.safety}</p></div>
                  </article>
                ))}
              </div>
              <aside className="practice-aside">
                <span>Chuẩn thực hành Bài {selectedLesson}</span>
                <strong>{selectedLesson === "03" ? "4/5 lần đúng" : activeLesson.pass[0]}</strong>
                <p>{selectedLesson === "03" ? "Không đau, không hoảng loạn, không mất kiểm soát hô hấp." : activeLesson.target}</p>
                <div className="mini-progress"><i /><i /><i /><i /><i className="muted" /></div>
              </aside>
            </div>

            <section className="session-section">
              <div className="session-heading"><span>Giáo án Bài {selectedLesson}</span><h2>{selectedPracticeDetail?.sessionTitle ?? "Một buổi học 60 phút"}</h2><p>{selectedPracticeDetail?.sessionText ?? "Mỗi phần có một mốc quan sát rõ, tránh tập nhiều nhưng không biết mình đang sửa gì."}</p></div>
              <div className="session-timeline">
                {(selectedLesson === "03" ? sessionPlan : selectedPracticeDetail?.session ?? []).map((item, index) => (
                  <div key={item.title} className="session-item"><span>{item.time}</span><i>{index + 1}</i><div><strong>{item.title}</strong><p>{item.body}</p></div></div>
                ))}
              </div>
            </section>

            <div className="section-action"><button className="primary-button" onClick={() => {
              if (markComplete(progressKey("thuc-hanh"))) navigate("phan-tich");
            }}>Hoàn thành phần 2/5 · phân tích Bài {selectedLesson} <span>→</span></button></div>
          </div>
        )}

        {section === "phan-tich" && selectedLesson === "03" && movementContent && movementAnalysisPhases.length > 0 && (
          <div className="page motion-page">
            <SectionHeading eyebrow="Bài 03 · Phần 3/5 · Phân tích chuyển động" title="Nhìn cả chu kỳ, không tách rời từng động tác" text="Bật mô phỏng chậm để quan sát thời điểm chuyển từ pha chuẩn bị sang pha tạo lực và trở về tư thế lướt." />
            <section className="motion-stage">
              <div className="motion-toolbar"><div><span>Chu kỳ chân · tốc độ chậm</span><strong>Pha {movementAnalysisPhases[phase % movementAnalysisPhases.length].number}: {movementAnalysisPhases[phase % movementAnalysisPhases.length].title}</strong></div><button onClick={() => setMotionPlaying((value) => !value)}>{motionPlaying ? "Tạm dừng" : "Bắt đầu mô phỏng"}</button></div>
              <LessonFigure visual={movementContent.visuals.technique[phase % movementContent.visuals.technique.length]} label={`Quan sát chậm · ${movementAnalysisPhases[phase % movementAnalysisPhases.length].title}`} />
              <div className="motion-controls">
                {movementAnalysisPhases.map((item, index) => <button key={item.id} className={phase % movementAnalysisPhases.length === index ? "active" : ""} onClick={() => { setPhase(index); setMotionPlaying(false); }}><span>{item.number}</span><b>{item.title}</b><small>{item.action}</small></button>)}
              </div>
            </section>
            <section className="motion-notes"><article><span>Dấu hiệu đúng</span><h3>{movementAnalysisPhases[phase % movementAnalysisPhases.length].action}</h3><p>{movementAnalysisPhases[phase % movementAnalysisPhases.length].purpose}</p></article><article className="warning"><span>Lỗi cần chặn</span><h3>{movementAnalysisPhases[phase % movementAnalysisPhases.length].avoid}</h3><p>Quan sát từ phía sau hoặc bên cạnh; mỗi lượt chỉ sửa một lỗi ưu tiên.</p></article></section>
            <div className="section-action"><button className="primary-button" onClick={() => { if (markComplete("phan-tich")) navigate("on-tap"); }}>Đã quan sát · sang ôn tập <span>→</span></button></div>
          </div>
        )}

        {section === "phan-tich" && selectedLesson !== "03" && selectedPracticeDetail && foundationAnalysis.length > 0 && (
          <div className="page motion-page lesson-analysis-page">
            <SectionHeading eyebrow={`Bài ${selectedLesson} · Phần 3/5 · Phân tích`} title={`Tách từng điểm quan sát của ${activeLesson.title}`} text="Chọn từng điểm để đối chiếu trình tự đúng, khẩu lệnh và lỗi cần chặn trước khi chuyển sang ôn tập." />
            <section className="analysis-board">
              <div className="motion-controls">
                {foundationAnalysis.map((item, index) => <button key={item.title} className={phase % foundationAnalysis.length === index ? "active" : ""} onClick={() => setPhase(index)}><span>{String(index + 1).padStart(2, "0")}</span><b>{item.title}</b><small>{item.cue}</small></button>)}
              </div>
              <article className="analysis-detail">
                {activeVisuals && <LessonFigure visual={activeVisuals.technique[phase % activeVisuals.technique.length]} label={`${foundationAnalysis[phase % foundationAnalysis.length].title} · ${activeVisuals.technique[phase % activeVisuals.technique.length].alt.split(" – ").at(-1)}`} />}
                <span>Điểm quan sát {String((phase % foundationAnalysis.length) + 1).padStart(2, "0")}</span>
                <h2>{foundationAnalysis[phase % foundationAnalysis.length].title}</h2>
                <p>{foundationAnalysis[phase % foundationAnalysis.length].body}</p>
                <ol>{foundationAnalysis[phase % foundationAnalysis.length].steps.map((step) => <li key={step}>{step}</li>)}</ol>
                <dl><div><dt>Khẩu lệnh</dt><dd>{foundationAnalysis[phase % foundationAnalysis.length].cue}</dd></div><div className="avoid"><dt>Cần tránh</dt><dd>{foundationAnalysis[phase % foundationAnalysis.length].avoid}</dd></div></dl>
              </article>
            </section>
            <section className="motion-notes"><article><span>Chuẩn cuối bài</span><h3>{activeLesson.pass[0]}</h3><p>{activeLesson.target}</p></article><article className="warning"><span>An toàn bắt buộc</span><h3>{selectedPracticeDetail.safety.title}</h3><p>{selectedPracticeDetail.safety.body}</p></article></section>
            <div className="section-action"><button className="primary-button" onClick={() => { if (markComplete(progressKey("phan-tich"))) navigate("on-tap"); }}>Đã phân tích · sang phần 4/5 <span>→</span></button></div>
          </div>
        )}

        {section === "on-tap" && selectedLesson === "03" && (
          <div className="page review-page">
            <SectionHeading eyebrow="Bài 03 · Phần 4/5 · Ôn tập" title="Nhận diện lỗi trước khi cố đạp mạnh hơn" text="Chọn đúng tín hiệu sửa và bài tập phù hợp cho từng biểu hiện thường gặp." />
            <div className="review-intro"><div><span>Quy tắc sửa lỗi</span><strong>Mỗi lượt chỉ sửa một lỗi ưu tiên.</strong><p>Làm chậm 3–5 lần trên cạn, 3–5 lần bám thành, rồi mới chuyển sang di chuyển.</p></div><div className="review-sequence"><i>1<span>Trên cạn</span></i><b>→</b><i>2<span>Bám thành</span></i><b>→</b><i>3<span>Di chuyển</span></i></div></div>
            <div className="mistake-grid">
              {mistakes.map((item, index) => (
                <article className="mistake-card" key={item.id}>
                  {activeVisuals && <LessonFigure visual={activeVisuals.diagnostics[index % activeVisuals.diagnostics.length]} label={`Nhận diện lỗi ${index + 1}`} />}
                  <header><span>{String(index + 1).padStart(2, "0")}</span><h3>{item.name}</h3></header>
                  <dl><div><dt>Biểu hiện</dt><dd>{item.sign}</dd></div><div><dt>Nguyên nhân</dt><dd>{item.cause}</dd></div><div className="fix"><dt>Tín hiệu sửa</dt><dd>{item.fix}</dd></div></dl>
                  <footer><span>Bài tập phù hợp</span><p>{item.drill}</p></footer>
                </article>
              ))}
            </div>
            <div className="pain-warning"><span>!</span><div><strong>Nếu đau mặt trong gối</strong><p>Dừng bài tập gây đau, giảm biên độ và nhờ huấn luyện viên hoặc nhân viên y tế kiểm tra. Không cố vượt đau bằng sức.</p></div></div>
            <div className="section-action"><button className="primary-button" onClick={() => { if (markComplete("on-tap")) navigate("kiem-tra"); }}>Đã ôn · làm bài kiểm tra <span>→</span></button></div>
          </div>
        )}

        {section === "on-tap" && selectedLesson !== "03" && selectedPracticeDetail && (
          <div className="page review-page">
            <SectionHeading eyebrow={`Bài ${selectedLesson} · Phần 4/5 · Ôn tập`} title={`Sửa lỗi trọng tâm của ${activeLesson.title}`} text="Quan sát biểu hiện, xác định một nguyên nhân chính rồi chọn một tín hiệu sửa; không sửa nhiều lỗi trong cùng một lượt." />
            <div className="review-intro"><div><span>Quy tắc sửa lỗi</span><strong>Quan sát → chọn một lỗi → sửa → đo lại.</strong><p>Quay về bước dễ hơn nếu dấu hiệu đúng chưa ổn định hoặc xuất hiện bất kỳ cảnh báo an toàn nào.</p></div><div className="review-sequence"><i>1<span>Nhận diện</span></i><b>→</b><i>2<span>Sửa một lỗi</span></i><b>→</b><i>3<span>Kiểm tra lại</span></i></div></div>
            <div className="mistake-grid">
              {selectedPracticeDetail.mistakes.map((item, index) => <article className="mistake-card" key={item.sign}>{activeVisuals && <LessonFigure visual={activeVisuals.diagnostics[index % activeVisuals.diagnostics.length]} label={`Nhận diện lỗi ${index + 1}`} />}<header><span>{String(index + 1).padStart(2, "0")}</span><h3>{item.sign}</h3></header><dl><div><dt>Biểu hiện</dt><dd>{item.sign}</dd></div><div><dt>Nguyên nhân</dt><dd>{item.cause}</dd></div><div className="fix"><dt>Tín hiệu sửa</dt><dd>{item.fix}</dd></div></dl><footer><span>Bước kiểm tra lại</span><p>Thực hiện chậm, tăng dần và chỉ chuyển mức khi dấu hiệu đúng lặp lại ổn định.</p></footer></article>)}
            </div>
            <div className="pain-warning"><span>!</span><div><strong>{selectedPracticeDetail.safety.title}</strong><p>{selectedPracticeDetail.safety.body}</p></div></div>
            <div className="section-action"><button className="primary-button" onClick={() => { if (markComplete(progressKey("on-tap"))) navigate("kiem-tra"); }}>Đã ôn · làm kiểm tra Bài {selectedLesson} <span>→</span></button></div>
          </div>
        )}

        {section === "kiem-tra" && selectedLesson === "03" && questions.length > 0 && (
          <div className="page quiz-page">
            <SectionHeading eyebrow="Bài 03 · Phần 5/5 · Kiểm tra" title="Mười câu · một lần nộp hoàn chỉnh" text="Không hiển thị đúng sai từng câu. Đạt từ 8/10 để qua bài; nếu chưa đạt, toàn bộ bài kiểm tra tự đặt lại từ câu 1." />
            <div className="quiz-statusbar"><div><span>Đã trả lời</span><strong>{answered}/10</strong></div><div className="quiz-progress"><i style={{ width: `${answered * 10}%` }} /></div><button className={progress.flags.includes(question) ? "flagged" : ""} onClick={toggleFlag}>{progress.flags.includes(question) ? "Đã đánh dấu" : "Đánh dấu câu này"}</button></div>
            <div className="quiz-layout">
              <aside className="question-nav" aria-label="Danh sách câu hỏi">
                <span>Câu hỏi</span>
                <div>{questions.map((_, index) => {
                  const answeredItem = progress.answers[index] !== undefined;
                  return <button key={index} onClick={() => setQuestion(index)} className={`${question === index ? "current" : ""} ${progress.flags.includes(index) ? "flag" : ""} ${answeredItem ? "answered" : ""}`}>{index + 1}</button>;
                })}</div>
                <ul><li><i className="legend-white" /> Chưa làm</li><li><i className="legend-yellow" /> Đánh dấu</li><li><i className="legend-blue" /> Đã chọn</li></ul>
              </aside>
              <section className="question-card">
                <div className="question-head"><span>Câu {question + 1} / 10</span><small>{progress.flags.includes(question) ? "Cần xem lại" : "Chọn một phương án"}</small></div>
                {questions[question].image && <LessonFigure visual={questions[question].image} label="Quan sát hình rồi chọn đáp án" />}
                <h2>{questions[question].q}</h2>
                <div className={`answer-list ${questions[question].optionImages ? "answer-image-grid" : ""}`}>
                  {questions[question].options.map((option, index) => {
                    const selected = progress.answers[question] === index;
                    return (
                      <button
                        key={option}
                        onClick={() => chooseAnswer(index)}
                        className={selected ? "selected" : ""}
                      >
                        {questions[question].optionImages?.[index] && <img src={questions[question].optionImages[index].src} alt={`${questions[question].optionImages[index].alt} · phương án ${String.fromCharCode(65 + index)}`} loading="lazy" decoding="async" />}
                        <span>{String.fromCharCode(65 + index)}</span><b>{option}</b><i>{selected ? "✓" : ""}</i>
                      </button>
                    );
                  })}
                </div>
                <footer className="question-actions"><button onClick={() => setQuestion((value) => Math.max(0, value - 1))} disabled={question === 0}>← Câu trước</button><span>Đáp án chỉ được chấm khi nộp đủ 10 câu</span><button onClick={() => setQuestion((value) => Math.min(9, value + 1))} disabled={question === 9}>Câu sau →</button></footer>
              </section>
            </div>

            <section className="submit-panel">
              {progress.submitted ? (
                <div className="result-card pass"><span>Kết quả Bài 03</span><strong>{score}/10</strong><h3>Đạt yêu cầu</h3><p>{learnerGivenName} đã hoàn thành đủ năm phần của Bài 03. Lộ trình tiếp theo là Bài 04 – Kỹ thuật tay.</p><div className="result-actions"><button className="next-lesson-button" onClick={() => openLesson("04")}>Sang Bài 04 →</button></div></div>
              ) : (
                <><div><span>Điều kiện nộp</span><strong>{networkOnline ? activeSubmissionStatus : "Đang học offline"}</strong><p>{networkOnline ? activeSubmissionHint : "Kết nối mạng để nộp và chấm điểm trên máy chủ."}</p></div><button className="submit-button" disabled={!activeSubmissionReady || !networkOnline} onClick={submitQuiz}>Nộp bài kiểm tra</button></>
              )}
            </section>
          </div>
        )}

        {section === "kiem-tra" && selectedLesson !== "03" && selectedPracticeDetail && activeQuestions.length > 0 && (
          <div className="page quiz-page">
            <SectionHeading eyebrow={`Bài ${selectedLesson} · Phần 5/5 · Kiểm tra`} title={`${activeQuestions.length} câu · một lần nộp hoàn chỉnh`} text={`Không hiển thị đúng sai từng câu. Đạt từ ${activePassScore}/${activeQuestions.length}; nếu chưa đạt, toàn bộ bài tự đặt lại từ câu 1.`} />
            <div className="quiz-statusbar"><div><span>Đã trả lời</span><strong>{activeLessonAnswered}/{activeQuestions.length}</strong></div><div className="quiz-progress"><i style={{ width: `${activeLessonAnswered / activeQuestions.length * 100}%` }} /></div><button className={activeLessonFlags.includes(question) ? "flagged" : ""} onClick={toggleLessonFlag}>{activeLessonFlags.includes(question) ? "Đã đánh dấu" : "Đánh dấu câu này"}</button></div>
            <div className="quiz-layout">
              <aside className="question-nav" aria-label={`Danh sách câu hỏi Bài ${selectedLesson}`}>
                <span>Câu hỏi</span>
                <div>{activeQuestions.map((_, index) => {
                  const selected = progress.lessonAnswers[`${selectedLesson}-${index}`];
                  return <button key={index} onClick={() => setQuestion(index)} className={`${question === index ? "current" : ""} ${activeLessonFlags.includes(index) ? "flag" : ""} ${selected !== undefined ? "answered" : ""}`}>{index + 1}</button>;
                })}</div>
                <ul><li><i className="legend-white" /> Chưa làm</li><li><i className="legend-yellow" /> Đánh dấu</li><li><i className="legend-blue" /> Đã chọn</li></ul>
              </aside>
              <section className="question-card">
                <div className="question-head"><span>Câu {question + 1} / {activeQuestions.length}</span><small>{activeLessonFlags.includes(question) ? "Cần xem lại" : "Chọn một phương án"}</small></div>
                {activeQuestions[question].image && <LessonFigure visual={activeQuestions[question].image} label="Quan sát hình rồi chọn đáp án" />}
                <h2>{activeQuestions[question].q}</h2>
                <div className={`answer-list ${activeQuestions[question].optionImages ? "answer-image-grid" : ""}`}>
                  {activeQuestions[question].options.map((option, index) => {
                    const selected = progress.lessonAnswers[`${selectedLesson}-${question}`] === index;
                    return <button key={option} onClick={() => chooseLessonAnswer(`${selectedLesson}-${question}`, index)} className={selected ? "selected" : ""}>{activeQuestions[question].optionImages?.[index] && <img src={activeQuestions[question].optionImages[index].src} alt={`${activeQuestions[question].optionImages[index].alt} · phương án ${String.fromCharCode(65 + index)}`} loading="lazy" decoding="async" />}<span>{String.fromCharCode(65 + index)}</span><b>{option}</b><i>{selected ? "✓" : ""}</i></button>;
                  })}
                </div>
                <footer className="question-actions"><button onClick={() => setQuestion((value) => Math.max(0, value - 1))} disabled={question === 0}>← Câu trước</button><span>Đáp án chỉ được chấm khi nộp đủ câu</span><button onClick={() => setQuestion((value) => Math.min(activeQuestions.length - 1, value + 1))} disabled={question === activeQuestions.length - 1}>Câu sau →</button></footer>
              </section>
            </div>
            <section className="submit-panel">
              {activeLessonSubmitted ? (
                <div className="result-card pass"><span>Kết quả Bài {selectedLesson}</span><strong>{activeLessonScore}/{activeQuestions.length}</strong><h3>Đạt yêu cầu</h3><p>{selectedLesson === "08" ? `${learnerGivenName} đã hoàn thành Bài 08 và toàn bộ lộ trình tám bài chuyên sâu.` : `${learnerGivenName} đã hoàn thành đủ năm phần của Bài ${selectedLesson}.`}</p><div className="result-actions">{selectedLesson !== "08" && <button className="next-lesson-button" onClick={() => openLesson(String(Number(selectedLesson) + 1).padStart(2, "0"))}>Sang Bài {String(Number(selectedLesson) + 1).padStart(2, "0")} →</button>}{selectedLesson === "08" && <button className="next-lesson-button" onClick={() => navigate("tong-quan")}>Xem tổng kết lộ trình →</button>}</div></div>
              ) : (
                <><div><span>Điều kiện nộp</span><strong>{networkOnline ? activeSubmissionStatus : "Đang học offline"}</strong><p>{networkOnline ? activeSubmissionHint : "Kết nối mạng để nộp và chấm điểm trên máy chủ."}</p></div><button className="submit-button" disabled={!activeSubmissionReady || !networkOnline} onClick={submitLessonQuiz}>Nộp bài kiểm tra</button></>
              )}
            </section>
          </div>
        )}

        {section === "du-lieu" && (
          <div className="page data-page">
            <SectionHeading eyebrow={`Dữ liệu học tập của ${learnerGivenName}`} title={`Tiến độ Bài ${selectedLesson} đã được đồng bộ`} text="Ứng dụng tự ghi nhận thời gian hoạt động, phần đã học và kết quả để lập thống kê, nhắc học và cấp chứng chỉ; dữ liệu offline sẽ gửi khi có mạng." />
            <section className="data-summary">
              <div className="progress-ring" style={{ "--value": `${boundedCompletion * 3.6}deg` } as React.CSSProperties}><span><strong>{boundedCompletion}%</strong><small>hoàn thành</small></span></div>
              <div className="data-copy"><span>Hồ sơ học tập đã xác thực</span><h2>{activeLesson.title}</h2><p>Phần hoàn thành, điểm số và quyền mở bài được kiểm tra phía máy chủ; tải lại trang không làm mất kết quả đã đồng bộ.</p><div><span><b>{completedParts}</b> phần đã học</span><span><b>{activeLessonAnswered}</b> câu đã làm</span><span><b>{activeLessonSubmitted ? `${activeLessonScore}/${activeQuestions.length}` : "—"}</b> kết quả</span><span><b>{completedLessonCount}/8</b> bài đã đạt</span></div></div>
            </section>
            <section className={`certificate-panel ${courseCompleted ? "ready" : "locked"}`}><div><span>Chứng chỉ hoàn thành</span><h3>{courseCompleted ? certificate ? "Chứng chỉ đã được cấp" : "Đang chuẩn bị chứng chỉ điện tử" : `Còn ${8 - completedLessonCount} bài cần hoàn thành`}</h3><p>{courseCompleted ? "Chứng chỉ có mã xác minh công khai để học viên in, lưu PDF hoặc gửi liên kết cho giảng viên." : "Hoàn thành đủ 8 bài và đạt tối thiểu 8/10 trong từng bài kiểm tra để hệ thống tự cấp chứng chỉ."}</p></div>{certificate ? <a href={`/chung-chi?code=${encodeURIComponent(certificate.verificationCode)}`} target="_blank" rel="noreferrer">Mở chứng chỉ <span>→</span></a> : <button disabled={!courseCompleted || certificateBusy || !networkOnline} onClick={() => void createCertificate()}>{certificateBusy ? "Đang tạo…" : networkOnline ? "Tạo chứng chỉ" : "Cần kết nối mạng"}</button>}</section>
            <section className="data-list">
              <h3>Trạng thái từng phần</h3>
              {[
                ["hoc-tap", "Nội dung cốt lõi"], ["thuc-hanh", "Bài tập thực hành"], ["phan-tich", "Phân tích kỹ thuật"], ["on-tap", "Lỗi sai và cách sửa"], ["kiem-tra", "Bài kiểm tra cuối bài"],
              ].map(([id, label]) => {
                const key = progressKey(id as Exclude<SectionId, "tong-quan" | "ai-hoc-tap" | "du-lieu">);
                const done = id === "kiem-tra" ? activeLessonPassed : progress.completed.includes(key);
                const status = done ? "Đã hoàn thành" : id === "kiem-tra" && activeLessonSubmitted ? "Đã nộp · chưa đạt" : "Chưa hoàn thành";
                return <div key={id}><span className={done ? "done" : ""}>{done ? "✓" : ""}</span><strong>{label}</strong><small>{status}</small></div>;
              })}
            </section>
            <section className="backup-panel"><div><span>Sao lưu cá nhân</span><h3>Tải bản tiến độ về máy</h3><p>Tệp sao lưu chứa trạng thái học và câu trả lời của toàn bộ tám bài. Dữ liệu này tách biệt với bản sửa nội dung riêng trên thiết bị.</p></div><button onClick={exportProgress}>Tải bản sao lưu</button></section>
          </div>
        )}
      </main>
      {installPrompt ? <InstallAppButton install={() => void installWebApp()} /> : null}
      <OfflineStudyCoach
        learnerName={learnerGivenName}
        online={networkOnline}
        pendingSyncCount={pendingSyncCount}
        completion={courseCompletion}
        nextStep={courseCompleted ? "Ôn lại phần còn yếu" : `Bài ${nextLesson.n} · ${nextLessonPart.label}`}
        stats={studyStats}
        onSync={() => void flushOfflineQueue()}
        onReminderChange={changeReminder}
      />
    </div>
  );
}
