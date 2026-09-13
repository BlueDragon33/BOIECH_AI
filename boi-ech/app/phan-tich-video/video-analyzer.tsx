"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./video-analyzer.module.css";

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 30;
const SAMPLE_FPS = 5;
const AI_CACHE = "boi-ech-pose-ai-v1";
const VIDEO_DB = "boi-ech-video-ai-v1";
const ENGINE_VERSION = "breaststroke-local-v1.0";
const VISION_VERSION = "1.0.1";
const VISION_BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/vision_bundle.mjs`;
const WASM_LOADER_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm/vision_wasm_internal.js`;
const WASM_BINARY_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm/vision_wasm_internal.wasm`;
const POSE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const AI_ASSETS = [VISION_BUNDLE_URL, WASM_LOADER_URL, WASM_BINARY_URL, POSE_MODEL_URL] as const;

type CameraView = "rear" | "side";
type Severity = "info" | "warning" | "critical";
type SyncState = "local" | "pending" | "synced";
type Landmark = { x: number; y: number; z: number; visibility?: number };
type PoseResult = { landmarks?: Landmark[][] };
type PoseLandmarker = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => PoseResult;
  close?: () => void;
};

type FrameMetric = {
  timeSec: number;
  landmarks: Landmark[];
  visibility: number;
  kneeLeft: number;
  kneeRight: number;
  kneeDiff: number;
  kneeSpread: number;
  armDiff: number;
  bodyTilt: number;
  overlap: boolean;
};

type AnalysisError = {
  code: string;
  title: string;
  timeSec: number;
  severity: Severity;
  metric: string;
  observed: string;
  expected: string;
  recommendation: string;
  confidence: number;
  frameIndex: number;
  highlight: number[];
};

type LocalFrame = { timeSec: number; title: string; dataUrl: string };

export type VideoAnalysisResult = {
  id: string;
  engineVersion: string;
  analyzedAt: string;
  durationSec: number;
  fileSizeBytes: number;
  width: number;
  height: number;
  sampledFrames: number;
  detectedFrames: number;
  cameraView: CameraView;
  score: number;
  confidence: number;
  categories: { legs: number; arms: number; coordination: number; bodyLine: number };
  errors: AnalysisError[];
  localFrames: LocalFrame[];
  syncState: SyncState;
};

type StoredCredential = { version: 2; privateKey: CryptoKey | null; publicKey: JsonWebKey };
type DeviceState = {
  deviceId: string;
  status: "pending" | "approved" | "blocked";
  registrationComplete: boolean;
  accessExpired: boolean;
};

const CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28], [27, 29], [29, 31], [28, 30], [30, 32],
];

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Landmark, b: Landmark): Landmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function angle(a: Landmark, b: Landmark, c: Landmark) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const denominator = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (denominator < 1e-6) return 180;
  const cosine = clamp((ab.x * cb.x + ab.y * cb.y) / denominator, -1, 1);
  return Math.acos(cosine) * 180 / Math.PI;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)))];
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remain = safe - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remain.toFixed(1).padStart(4, "0")}`;
}

function openVideoDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(VIDEO_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("analyses")) request.result.createObjectStore("analyses", { keyPath: "id" });
      if (!request.result.objectStoreNames.contains("pending")) request.result.createObjectStore("pending", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveLocalResult(result: VideoAnalysisResult) {
  const db = await openVideoDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("analyses", "readwrite");
    transaction.objectStore("analyses").put(result);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function queuePendingResult(result: VideoAnalysisResult) {
  const db = await openVideoDb();
  const safe = syncPayload(result);
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("pending", "readwrite");
    transaction.objectStore("pending").put({ id: result.id, lessonNumber: "03", analysis: safe, createdAt: new Date().toISOString() });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function readPendingResults() {
  const db = await openVideoDb();
  return new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const request = db.transaction("pending", "readonly").objectStore("pending").getAll();
    request.onsuccess = () => resolve(request.result as Record<string, unknown>[]);
    request.onerror = () => reject(request.error);
  });
}

async function deletePendingResult(id: string) {
  const db = await openVideoDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction("pending", "readwrite").objectStore("pending").delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function syncPayload(result: VideoAnalysisResult) {
  return {
    id: result.id,
    engineVersion: result.engineVersion,
    analyzedAt: result.analyzedAt,
    durationSec: Number(result.durationSec.toFixed(2)),
    fileSizeBytes: result.fileSizeBytes,
    width: result.width,
    height: result.height,
    sampledFrames: result.sampledFrames,
    detectedFrames: result.detectedFrames,
    cameraView: result.cameraView,
    score: result.score,
    confidence: result.confidence,
    categories: result.categories,
    errors: result.errors.map(({ frameIndex: _frameIndex, highlight: _highlight, ...error }) => error),
  };
}

async function cachedAsset(url: string) {
  if (!("caches" in window)) {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error(`Không tải được tài nguyên AI (${response.status}).`);
    return response;
  }
  const cache = await caches.open(AI_CACHE);
  const cached = await cache.match(url);
  if (cached) return cached;
  if (!navigator.onLine) throw new Error("Mô hình AI chưa được tải về máy. Hãy kết nối mạng một lần để chuẩn bị chế độ offline.");
  const response = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!response.ok) throw new Error(`Không tải được tài nguyên AI (${response.status}).`);
  await cache.put(url, response.clone());
  return response;
}

async function aiAssetsReady() {
  if (!("caches" in window)) return false;
  const cache = await caches.open(AI_CACHE);
  const matches = await Promise.all(AI_ASSETS.map((url) => cache.match(url)));
  return matches.every(Boolean);
}

async function prepareAiAssets(onProgress?: (done: number, total: number) => void) {
  let done = 0;
  for (const url of AI_ASSETS) {
    await cachedAsset(url);
    done += 1;
    onProgress?.(done, AI_ASSETS.length);
  }
}

async function loadPoseLandmarker(): Promise<{ landmarker: PoseLandmarker; cleanup: () => void }> {
  await prepareAiAssets();
  const [bundleResponse, loaderResponse, wasmResponse, modelResponse] = await Promise.all([
    cachedAsset(VISION_BUNDLE_URL),
    cachedAsset(WASM_LOADER_URL),
    cachedAsset(WASM_BINARY_URL),
    cachedAsset(POSE_MODEL_URL),
  ]);
  const bundleBlob = new Blob([await bundleResponse.text()], { type: "text/javascript" });
  const loaderBlob = new Blob([await loaderResponse.text()], { type: "text/javascript" });
  const wasmBlob = await wasmResponse.blob();
  const bundleUrl = URL.createObjectURL(bundleBlob);
  const loaderUrl = URL.createObjectURL(loaderBlob);
  const wasmUrl = URL.createObjectURL(wasmBlob);
  const runtimeImport = new Function("url", "return import(url)") as (url: string) => Promise<Record<string, unknown>>;
  const vision = await runtimeImport(bundleUrl) as { PoseLandmarker?: { createFromOptions: (fileset: Record<string, string>, options: Record<string, unknown>) => Promise<PoseLandmarker> } };
  if (!vision.PoseLandmarker) throw new Error("Không khởi tạo được MediaPipe Pose Landmarker.");
  const modelBuffer = new Uint8Array(await modelResponse.arrayBuffer());
  const landmarker = await vision.PoseLandmarker.createFromOptions(
    { wasmLoaderPath: loaderUrl, wasmBinaryPath: wasmUrl },
    {
      baseOptions: { modelAssetBuffer: modelBuffer, delegate: "CPU" },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.45,
      minPosePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
      outputSegmentationMasks: false,
    },
  );
  return {
    landmarker,
    cleanup: () => {
      landmarker.close?.();
      URL.revokeObjectURL(bundleUrl);
      URL.revokeObjectURL(loaderUrl);
      URL.revokeObjectURL(wasmUrl);
    },
  };
}

function seekVideo(video: HTMLVideoElement, timeSec: number) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Không đọc được khung hình video.")), 5000);
    const done = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done, { once: true });
    video.currentTime = Math.min(Math.max(0, timeSec), Math.max(0, video.duration - 0.01));
  });
}

function frameMetric(timeSec: number, landmarks: Landmark[]): FrameMetric | null {
  if (landmarks.length < 33) return null;
  const indexes = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  const visibility = mean(indexes.map((index) => landmarks[index].visibility ?? 1));
  if (visibility < 0.35) return null;
  const hipWidth = Math.max(0.025, distance(landmarks[23], landmarks[24]));
  const shoulderWidth = Math.max(0.025, distance(landmarks[11], landmarks[12]));
  const kneeLeft = angle(landmarks[23], landmarks[25], landmarks[27]);
  const kneeRight = angle(landmarks[24], landmarks[26], landmarks[28]);
  const armLeft = angle(landmarks[11], landmarks[13], landmarks[15]);
  const armRight = angle(landmarks[12], landmarks[14], landmarks[16]);
  const shoulderMid = midpoint(landmarks[11], landmarks[12]);
  const hipMid = midpoint(landmarks[23], landmarks[24]);
  const bodyTilt = Math.atan2(Math.abs(shoulderMid.y - hipMid.y), Math.abs(shoulderMid.x - hipMid.x) + 1e-5) * 180 / Math.PI;
  const wristSpread = distance(landmarks[15], landmarks[16]) / shoulderWidth;
  const legRecovery = (180 - (kneeLeft + kneeRight) / 2) / 135;
  return {
    timeSec,
    landmarks,
    visibility,
    kneeLeft,
    kneeRight,
    kneeDiff: Math.abs(kneeLeft - kneeRight),
    kneeSpread: distance(landmarks[25], landmarks[26]) / hipWidth,
    armDiff: Math.abs(armLeft - armRight),
    bodyTilt,
    overlap: wristSpread > 1.22 && legRecovery > 0.42,
  };
}

function makeError(input: Omit<AnalysisError, "confidence">, confidence: number): AnalysisError {
  return { ...input, confidence };
}

function detectErrors(frames: FrameMetric[], cameraView: CameraView, confidence: number) {
  const errors: AnalysisError[] = [];
  if (!frames.length) return errors;
  const severe = (ratio: number) => ratio > 0.3 ? "critical" as const : "warning" as const;

  if (cameraView === "rear") {
    const threshold = 1.75;
    const bad = frames.map((frame, index) => ({ frame, index })).filter(({ frame }) => frame.kneeSpread > threshold);
    if (bad.length / frames.length >= 0.12) {
      const worst = bad.reduce((a, b) => a.frame.kneeSpread > b.frame.kneeSpread ? a : b);
      errors.push(makeError({
        code: "KNEE_SPREAD_HIGH",
        title: "Hai gối mở rộng kéo dài khi thu chân",
        timeSec: worst.frame.timeSec,
        severity: severe(bad.length / frames.length),
        metric: "knee_spread_ratio",
        observed: `${worst.frame.kneeSpread.toFixed(2)}× bề rộng hông`,
        expected: "Giảm độ mở gối; ngưỡng hệ thống v1 < 1,75×",
        recommendation: "Tập chậm pha thu chân, giữ gối gọn hơn và đưa gót về gần mông trước khi xoay bàn chân để đạp.",
        frameIndex: worst.index,
        highlight: [23, 24, 25, 26, 27, 28],
      }, confidence));
    }
  }

  const legBad = frames.map((frame, index) => ({ frame, index })).filter(({ frame }) => frame.kneeDiff > 24);
  if (legBad.length / frames.length >= 0.14) {
    const worst = legBad.reduce((a, b) => a.frame.kneeDiff > b.frame.kneeDiff ? a : b);
    errors.push(makeError({
      code: "LEG_ASYMMETRY",
      title: "Hai chân gập không đồng đều",
      timeSec: worst.frame.timeSec,
      severity: severe(legBad.length / frames.length),
      metric: "knee_angle_delta",
      observed: `Lệch ${worst.frame.kneeDiff.toFixed(0)}°`,
      expected: "Hai bên nên chuyển pha gần đồng thời",
      recommendation: "Giảm tốc độ, tập thu hai gót đồng thời rồi mới đạp; ưu tiên tính đối xứng trước lực đạp.",
      frameIndex: worst.index,
      highlight: [23, 24, 25, 26, 27, 28],
    }, confidence));
  }

  const armBad = frames.map((frame, index) => ({ frame, index })).filter(({ frame }) => frame.armDiff > 28);
  if (armBad.length / frames.length >= 0.14) {
    const worst = armBad.reduce((a, b) => a.frame.armDiff > b.frame.armDiff ? a : b);
    errors.push(makeError({
      code: "ARM_ASYMMETRY",
      title: "Hai tay thu/duỗi thiếu đối xứng",
      timeSec: worst.frame.timeSec,
      severity: severe(armBad.length / frames.length),
      metric: "elbow_angle_delta",
      observed: `Lệch ${worst.frame.armDiff.toFixed(0)}°`,
      expected: "Hai tay nên thay đổi góc gần đồng thời",
      recommendation: "Giảm biên độ kéo tay, giữ hai khuỷu cân nhau và đưa hai tay về trước cùng thời điểm.",
      frameIndex: worst.index,
      highlight: [11, 12, 13, 14, 15, 16],
    }, confidence));
  }

  const overlapFrames = frames.map((frame, index) => ({ frame, index })).filter(({ frame }) => frame.overlap);
  if (overlapFrames.length / frames.length >= 0.18) {
    const worst = overlapFrames[Math.floor(overlapFrames.length / 2)];
    errors.push(makeError({
      code: "ARM_LEG_OVERLAP",
      title: "Tay và chân có dấu hiệu chồng pha",
      timeSec: worst.frame.timeSec,
      severity: severe(overlapFrames.length / frames.length),
      metric: "arm_leg_overlap",
      observed: `${Math.round(overlapFrames.length / frames.length * 100)}% khung hình có tín hiệu chồng pha`,
      expected: "Tay tạo lực → thu chân/đạp → trở về lướt",
      recommendation: "Tập nhịp chậm: kéo tay – thở – thu/đạp chân – lướt. Không cố tăng tốc khi trình tự chưa rõ.",
      frameIndex: worst.index,
      highlight: [15, 16, 25, 26, 27, 28],
    }, confidence));
  }

  if (cameraView === "side") {
    const bodyBad = frames.map((frame, index) => ({ frame, index })).filter(({ frame }) => frame.bodyTilt > 24);
    if (bodyBad.length / frames.length >= 0.2) {
      const worst = bodyBad.reduce((a, b) => a.frame.bodyTilt > b.frame.bodyTilt ? a : b);
      errors.push(makeError({
        code: "BODY_LINE_TILT",
        title: "Trục vai–hông thay đổi lớn so với phương ngang",
        timeSec: worst.frame.timeSec,
        severity: severe(bodyBad.length / frames.length),
        metric: "body_tilt",
        observed: `${worst.frame.bodyTilt.toFixed(0)}°`,
        expected: "Giữ thân tương đối dài và ổn định ngoài pha lấy hơi",
        recommendation: "Quan sát lại pha ngẩng thở; hạn chế nâng cả ngực quá cao và trở về tư thế lướt sớm sau đạp chân.",
        frameIndex: worst.index,
        highlight: [11, 12, 23, 24],
      }, confidence));
    }
  }

  return errors.slice(0, 6);
}

function categoryScores(errors: AnalysisError[]) {
  const penalty = (codes: string[]) => errors.filter((error) => codes.includes(error.code)).reduce((sum, error) => sum + (error.severity === "critical" ? 26 : 15), 0);
  return {
    legs: Math.round(clamp(100 - penalty(["KNEE_SPREAD_HIGH", "LEG_ASYMMETRY"]))),
    arms: Math.round(clamp(100 - penalty(["ARM_ASYMMETRY"]))),
    coordination: Math.round(clamp(100 - penalty(["ARM_LEG_OVERLAP"]))),
    bodyLine: Math.round(clamp(100 - penalty(["BODY_LINE_TILT"]))),
  };
}

function drawAnnotatedFrame(video: HTMLVideoElement, metric: FrameMetric, error: AnalysisError) {
  const maxWidth = 720;
  const scale = Math.min(1, maxWidth / Math.max(1, video.videoWidth));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(320, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(180, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  context.lineWidth = Math.max(2, canvas.width / 320);
  context.strokeStyle = "rgba(89, 224, 255, 0.95)";
  for (const [a, b] of CONNECTIONS) {
    const left = metric.landmarks[a];
    const right = metric.landmarks[b];
    if (!left || !right || (left.visibility ?? 1) < 0.25 || (right.visibility ?? 1) < 0.25) continue;
    context.beginPath();
    context.moveTo(left.x * canvas.width, left.y * canvas.height);
    context.lineTo(right.x * canvas.width, right.y * canvas.height);
    context.stroke();
  }
  for (const index of error.highlight) {
    const point = metric.landmarks[index];
    if (!point) continue;
    context.beginPath();
    context.fillStyle = "rgba(255, 74, 74, 0.95)";
    context.arc(point.x * canvas.width, point.y * canvas.height, Math.max(5, canvas.width / 95), 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = "rgba(4, 18, 29, 0.82)";
  context.fillRect(10, 10, Math.min(canvas.width - 20, 390), 54);
  context.fillStyle = "white";
  context.font = `600 ${Math.max(13, Math.round(canvas.width / 46))}px Arial`;
  context.fillText(`${formatTime(error.timeSec)} · ${error.title}`, 20, 42, Math.min(canvas.width - 40, 370));
  return canvas.toDataURL("image/jpeg", 0.68);
}

async function readStoredCredential() {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("boi-ech-doc-lap");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (!db.objectStoreNames.contains("thiet-bi")) return null;
  return new Promise<StoredCredential | null>((resolve, reject) => {
    const request = db.transaction("thiet-bi", "readonly").objectStore("thiet-bi").get("chinh");
    request.onsuccess = () => resolve((request.result as StoredCredential | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function registeredDevice(credential: StoredCredential) {
  const response = await fetch("/api/device", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "register", publicKey: credential.publicKey }),
  });
  const data = await response.json() as { device?: DeviceState; error?: string };
  if (!response.ok || !data.device) throw new Error(data.error ?? "Không đọc được trạng thái thiết bị.");
  if (data.device.status !== "approved" || !data.device.registrationComplete || data.device.accessExpired) throw new Error("Thiết bị chưa đủ quyền đồng bộ kết quả.");
  return data.device;
}

async function deviceProof(credential: StoredCredential, device: DeviceState) {
  if (!credential.privateKey || !crypto.subtle) throw new Error("Thiết bị này chưa có khóa ký an toàn. Hãy mở trang học chính và xác thực lại.");
  const response = await fetch("/api/device", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "challenge", deviceId: device.deviceId }),
  });
  const data = await response.json() as { challenge?: string; error?: string };
  if (!response.ok || !data.challenge) throw new Error(data.error ?? "Không tạo được thử thách thiết bị.");
  const message = new TextEncoder().encode(`boi-ech:${device.deviceId}:${data.challenge}`);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message);
  return { deviceId: device.deviceId, challenge: data.challenge, signature: base64Url(new Uint8Array(signature)) };
}

async function syncAnalysis(lessonNumber: string, analysis: Record<string, unknown>) {
  const credential = await readStoredCredential();
  if (!credential) throw new Error("Chưa có thiết bị Bơi ếch đã đăng ký trên trình duyệt này.");
  const device = await registeredDevice(credential);
  const proof = await deviceProof(credential, device);
  const response = await fetch("/api/video-analysis", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lessonNumber, analysis, ...proof }),
  });
  const data = await response.json() as { saved?: boolean; error?: string };
  if (!response.ok || !data.saved) throw new Error(data.error ?? "Chưa thể đồng bộ kết quả.");
}

function youtubeEmbed(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1).split("/")[0] || null;
    if (parsed.hostname.includes("youtube.com")) return parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).at(-1) || null;
  } catch { return null; }
  return null;
}

export default function VideoAnalyzer({ lessonNumber = "03" }: { lessonNumber?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState("");
  const [cameraView, setCameraView] = useState<CameraView>("rear");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Chưa chọn video.");
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [assetsReady, setAssetsReady] = useState(false);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [referenceOpen, setReferenceOpen] = useState(false);
  const youtubeId = useMemo(() => youtubeEmbed(referenceUrl), [referenceUrl]);

  useEffect(() => {
    void aiAssetsReady().then(setAssetsReady).catch(() => setAssetsReady(false));
    const online = () => { void flushPending(); };
    window.addEventListener("online", online);
    void flushPending();
    return () => window.removeEventListener("online", online);
  }, []);

  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }, [objectUrl]);

  async function flushPending() {
    if (!navigator.onLine) return;
    try {
      const pending = await readPendingResults();
      for (const item of pending) {
        const id = typeof item.id === "string" ? item.id : "";
        const lesson = typeof item.lessonNumber === "string" ? item.lessonNumber : lessonNumber;
        const analysis = item.analysis && typeof item.analysis === "object" ? item.analysis as Record<string, unknown> : null;
        if (!id || !analysis) continue;
        await syncAnalysis(lesson, analysis);
        await deletePendingResult(id);
        if (result?.id === id) setResult((current) => current ? { ...current, syncState: "synced" } : current);
      }
    } catch {
      // Giữ nguyên hàng đợi local; lần online sau sẽ thử lại.
    }
  }

  async function prepareOfflineAi() {
    if (busy) return;
    setBusy(true);
    setProgress(0);
    setStatus("Đang tải bộ AI về thiết bị…");
    try {
      await prepareAiAssets((done, total) => setProgress(Math.round(done / total * 100)));
      setAssetsReady(true);
      setStatus("Bộ AI đã được lưu trên máy. Có thể phân tích khi mất mạng.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không tải được bộ AI.");
    } finally { setBusy(false); }
  }

  function selectFile(next: File | null) {
    setResult(null);
    setProgress(0);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (!next) {
      setFile(null);
      setObjectUrl("");
      setStatus("Chưa chọn video.");
      return;
    }
    if (!next.type.startsWith("video/")) {
      setStatus("Tệp đã chọn không phải video.");
      return;
    }
    if (next.size > MAX_VIDEO_BYTES) {
      setStatus(`Video ${formatBytes(next.size)} vượt giới hạn 50 MB.`);
      return;
    }
    const url = URL.createObjectURL(next);
    setFile(next);
    setObjectUrl(url);
    setStatus(`Đã chọn ${formatBytes(next.size)}. Hãy kiểm tra góc quay rồi chạy AI.`);
  }

  async function analyze() {
    const video = videoRef.current;
    if (!video || !file || busy) return;
    if (!Number.isFinite(video.duration) || video.duration <= 0) { setStatus("Video chưa đọc được thời lượng."); return; }
    if (video.duration > MAX_VIDEO_SECONDS + 0.05) { setStatus(`Video dài ${video.duration.toFixed(1)} giây; giới hạn hiện tại là 30 giây.`); return; }
    if (!video.videoWidth || !video.videoHeight) { setStatus("Không đọc được độ phân giải video."); return; }

    setBusy(true);
    setResult(null);
    setProgress(0);
    setStatus("Đang khởi tạo AI cục bộ…");
    let cleanup = () => undefined;
    try {
      const pose = await loadPoseLandmarker();
      cleanup = pose.cleanup;
      setAssetsReady(true);
      const totalFrames = Math.max(3, Math.min(150, Math.ceil(video.duration * SAMPLE_FPS)));
      const frames: FrameMetric[] = [];
      for (let index = 0; index < totalFrames; index += 1) {
        const timeSec = Math.min(video.duration - 0.01, index / SAMPLE_FPS);
        await seekVideo(video, timeSec);
        const detected = pose.landmarker.detectForVideo(video, index * (1000 / SAMPLE_FPS) + 1);
        const landmarks = detected.landmarks?.[0];
        if (landmarks) {
          const metric = frameMetric(timeSec, landmarks);
          if (metric) frames.push(metric);
        }
        setProgress(Math.round((index + 1) / totalFrames * 82));
        if (index % 5 === 0) await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
      if (frames.length < Math.max(3, Math.ceil(totalFrames * 0.35))) {
        throw new Error("AI nhìn thấy cơ thể quá ít. Hãy quay toàn thân rõ hơn, đủ sáng và hạn chế người khác đi vào khung hình.");
      }

      const visibilityScore = mean(frames.map((frame) => frame.visibility));
      const coverageScore = frames.length / totalFrames;
      const confidence = Math.round(clamp((visibilityScore * 0.55 + coverageScore * 0.45) * 100));
      const errors = detectErrors(frames, cameraView, confidence);
      const categories = categoryScores(errors);
      let score = Math.round(categories.legs * 0.35 + categories.arms * 0.2 + categories.coordination * 0.3 + categories.bodyLine * 0.15);
      if (confidence < 55) score = Math.min(score, 75);
      const annotated: LocalFrame[] = [];
      for (const error of errors.slice(0, 4)) {
        const metric = frames[error.frameIndex];
        if (!metric) continue;
        await seekVideo(video, metric.timeSec);
        const dataUrl = drawAnnotatedFrame(video, metric, error);
        if (dataUrl) annotated.push({ timeSec: metric.timeSec, title: error.title, dataUrl });
      }
      setProgress(92);

      const analysis: VideoAnalysisResult = {
        id: `${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`,
        engineVersion: ENGINE_VERSION,
        analyzedAt: new Date().toISOString(),
        durationSec: video.duration,
        fileSizeBytes: file.size,
        width: video.videoWidth,
        height: video.videoHeight,
        sampledFrames: totalFrames,
        detectedFrames: frames.length,
        cameraView,
        score,
        confidence,
        categories,
        errors,
        localFrames: annotated,
        syncState: navigator.onLine ? "pending" : "local",
      };
      await saveLocalResult(analysis);
      await queuePendingResult(analysis);
      setResult(analysis);
      setProgress(96);
      if (navigator.onLine) {
        try {
          await syncAnalysis(lessonNumber, syncPayload(analysis));
          await deletePendingResult(analysis.id);
          const synced = { ...analysis, syncState: "synced" as const };
          await saveLocalResult(synced);
          setResult(synced);
          setStatus("Phân tích xong. Video gốc không rời thiết bị; máy chủ chỉ nhận kết quả JSON.");
        } catch {
          setStatus("Phân tích xong. Kết quả đang nằm trong hàng đợi và sẽ tự đồng bộ khi có mạng/quyền thiết bị hợp lệ.");
        }
      } else {
        setStatus("Phân tích xong khi offline. Kết quả đã lưu trên máy và sẽ tự đồng bộ khi có mạng.");
      }
      setProgress(100);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không thể phân tích video.");
    } finally {
      cleanup();
      setBusy(false);
    }
  }

  return (
    <div className={styles.shell}>
      <section className={styles.hero}>
        <div>
          <span>Breaststroke Vision · chạy trên thiết bị</span>
          <h1>Phân tích video kỹ thuật bơi ếch</h1>
          <p>Video được đọc trực tiếp trong trình duyệt. Máy chủ không nhận video gốc; chỉ nhận điểm, lỗi, thời điểm và các chỉ số sau khi AI xử lý.</p>
        </div>
        <aside>
          <strong>30 giây</strong><span>tối đa</span>
          <strong>50 MB</strong><span>tối đa</span>
          <strong>5 fps</strong><span>AI lấy mẫu</span>
        </aside>
      </section>

      <section className={styles.privacyBar}><i>✓</i><div><strong>Local-first</strong><span>Video và ảnh đánh dấu lỗi chỉ nằm trên máy học viên. Gói đồng bộ không chứa frame, ảnh, base64 hoặc blob.</span></div><b>{navigator.onLine ? "Online" : "Offline"}</b></section>

      <section className={styles.reference}>
        <header><div><span>Video mẫu</span><h2>Gắn URL để học viên xem trước khi tự quay</h2></div><small>URL chỉ để phát; không dùng làm video phân tích.</small></header>
        <div className={styles.referenceInput}><input type="url" placeholder="Dán URL YouTube hoặc video trực tiếp…" value={referenceUrl} onChange={(event) => setReferenceUrl(event.target.value)} /><button type="button" onClick={() => setReferenceOpen(Boolean(referenceUrl.trim()))} disabled={!referenceUrl.trim()}>Mở video mẫu</button></div>
        {referenceOpen && referenceUrl ? youtubeId ? <div className={styles.embed}><iframe src={`https://www.youtube-nocookie.com/embed/${youtubeId}`} title="Video mẫu bơi ếch" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div> : <video className={styles.referenceVideo} src={referenceUrl} controls preload="metadata" /> : null}
      </section>

      <section className={styles.workbench}>
        <div className={styles.videoPanel}>
          <header><div><span>01 · Video học viên</span><h2>Chọn file hoặc quay trực tiếp</h2></div><b>{file ? formatBytes(file.size) : "Chưa có file"}</b></header>
          <div className={styles.fileActions}>
            <label><input type="file" accept="video/*" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} /><span>Chọn video</span></label>
            <label><input type="file" accept="video/*" capture="environment" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} /><span>Quay bằng camera</span></label>
          </div>
          {objectUrl ? <video ref={videoRef} className={styles.studentVideo} src={objectUrl} controls preload="metadata" playsInline muted onLoadedMetadata={() => {
            const video = videoRef.current;
            if (!video) return;
            if (video.duration > MAX_VIDEO_SECONDS + 0.05) setStatus(`Video dài ${video.duration.toFixed(1)} giây; hãy chọn đoạn tối đa 30 giây.`);
          }} /> : <div className={styles.emptyVideo}><span>+</span><strong>Video không được upload lên server</strong><small>Trình duyệt dùng Object URL để đọc file tại chỗ.</small></div>}
        </div>

        <div className={styles.controlPanel}>
          <header><span>02 · Thiết lập AI</span><h2>Chọn đúng góc quay</h2></header>
          <div className={styles.viewSwitch}>
            <button type="button" className={cameraView === "rear" ? styles.active : ""} onClick={() => setCameraView("rear")}><strong>Chính diện / phía sau</strong><small>Tốt cho độ mở gối, đối xứng tay–chân</small></button>
            <button type="button" className={cameraView === "side" ? styles.active : ""} onClick={() => setCameraView("side")}><strong>Ngang bên</strong><small>Tốt cho đường thân và phối hợp pha</small></button>
          </div>
          <div className={styles.aiCache}><div><i className={assetsReady ? styles.ready : ""} /><span>{assetsReady ? "Bộ AI đã có trên máy" : "Chưa lưu đủ bộ AI offline"}</span></div><button type="button" onClick={() => void prepareOfflineAi()} disabled={busy}>{assetsReady ? "Kiểm tra lại" : "Tải AI offline"}</button></div>
          <button className={styles.analyzeButton} type="button" disabled={!file || busy} onClick={() => void analyze()}>{busy ? `Đang xử lý ${progress}%` : "Phân tích trên máy này"}</button>
          <div className={styles.progress}><i style={{ width: `${progress}%` }} /></div>
          <p className={styles.status} role="status">{status}</p>
          <small className={styles.disclaimer}>AI v1 là công cụ sàng lọc kỹ thuật từ pose landmarks, không thay thế huấn luyện viên. Ngưỡng sẽ được hiệu chỉnh tiếp bằng video bơi ếch thực tế.</small>
        </div>
      </section>

      {result ? <section className={styles.report}>
        <header><div><span>03 · Kết quả AI</span><h2>{result.errors.length ? `Phát hiện ${result.errors.length} điểm cần xem lại` : "Chưa thấy lỗi nổi bật trong các tiêu chí v1"}</h2><p>Độ tin cậy nhận diện {result.confidence}% · {result.detectedFrames}/{result.sampledFrames} khung hình hợp lệ · {result.syncState === "synced" ? "đã đồng bộ" : "đang giữ local/chờ đồng bộ"}.</p></div><strong>{result.score}<small>/100</small></strong></header>
        <div className={styles.scores}>
          <div><span>Chân</span><b>{result.categories.legs}</b></div><div><span>Tay</span><b>{result.categories.arms}</b></div><div><span>Phối hợp</span><b>{result.categories.coordination}</b></div><div><span>Đường thân</span><b>{result.categories.bodyLine}</b></div>
        </div>
        {result.errors.length ? <div className={styles.errorList}>{result.errors.map((error, index) => <article key={error.code} className={error.severity === "critical" ? styles.critical : ""}><header><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{error.title}</strong><small>{formatTime(error.timeSec)} · {error.observed}</small></div><b>{error.severity === "critical" ? "Ưu tiên" : "Cần sửa"}</b></header><p>{error.recommendation}</p><footer><span>Mốc tham chiếu</span><strong>{error.expected}</strong></footer></article>)}</div> : null}
        {result.localFrames.length ? <div className={styles.frames}><header><span>Ảnh lỗi lấy từ video local</span><small>Không đồng bộ lên server</small></header><div>{result.localFrames.map((frame) => <figure key={`${frame.timeSec}-${frame.title}`}><img src={frame.dataUrl} alt={`Khung hình lỗi ${frame.title}`} /><figcaption><strong>{frame.title}</strong><span>{formatTime(frame.timeSec)}</span></figcaption></figure>)}</div></div> : null}
      </section> : null}
    </div>
  );
}
