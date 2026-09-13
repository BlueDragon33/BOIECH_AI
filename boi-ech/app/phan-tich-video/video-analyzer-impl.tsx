"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./video-analyzer.module.css";

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 30;
const SAMPLE_FPS = 5;
const AI_CACHE = "boi-ech-pose-ai-v1";
const VIDEO_DB = "boi-ech-video-ai-v1";
const ENGINE_VERSION = "breaststroke-local-v1.0";
const VISION_VERSION = "1.0.1";
const BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/vision_bundle.mjs`;
const WASM_LOADER_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm/vision_wasm_internal.js`;
const WASM_BINARY_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm/vision_wasm_internal.wasm`;
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const AI_ASSETS = [BUNDLE_URL, WASM_LOADER_URL, WASM_BINARY_URL, MODEL_URL] as const;

type View = "rear" | "side";
type Severity = "warning" | "critical";
type Point = { x: number; y: number; z: number; visibility?: number };
type PoseResult = { landmarks?: Point[][] };
type PoseLandmarker = { detectForVideo: (video: HTMLVideoElement, timestampMs: number) => PoseResult; close?: () => void };
type Metric = {
  time: number;
  landmarks: Point[];
  visibility: number;
  kneeDelta: number;
  kneeSpread: number;
  armDelta: number;
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
type Analysis = {
  id: string;
  engineVersion: string;
  analyzedAt: string;
  durationSec: number;
  fileSizeBytes: number;
  width: number;
  height: number;
  sampledFrames: number;
  detectedFrames: number;
  cameraView: View;
  score: number;
  confidence: number;
  categories: { legs: number; arms: number; coordination: number; bodyLine: number };
  errors: AnalysisError[];
  localFrames: LocalFrame[];
  syncState: "local" | "pending" | "synced";
};
type StoredCredential = { version: 2; privateKey: CryptoKey | null; publicKey: JsonWebKey };
type DeviceState = { deviceId: string; status: "pending" | "approved" | "blocked"; registrationComplete: boolean; accessExpired: boolean };

const CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24],
  [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [29, 31], [28, 30], [30, 32],
];

function clamp(value: number, min = 0, max = 100) { return Math.min(max, Math.max(min, value)); }
function dist(a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y); }
function avg(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function mid(a: Point, b: Point): Point { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }; }
function jointAngle(a: Point, b: Point, c: Point) {
  const abx = a.x - b.x; const aby = a.y - b.y; const cbx = c.x - b.x; const cby = c.y - b.y;
  const denominator = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (denominator < 1e-6) return 180;
  return Math.acos(clamp((abx * cbx + aby * cby) / denominator, -1, 1)) * 180 / Math.PI;
}
function bytesLabel(bytes: number) { return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function timeLabel(seconds: number) { return `00:${Math.max(0, seconds).toFixed(1).padStart(4, "0")}`; }

function openLocalDb() {
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

async function putStore(storeName: "analyses" | "pending", value: unknown) {
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function pendingRecords() {
  const db = await openLocalDb();
  return new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const request = db.transaction("pending", "readonly").objectStore("pending").getAll();
    request.onsuccess = () => resolve(request.result as Record<string, unknown>[]);
    request.onerror = () => reject(request.error);
  });
}

async function deletePending(id: string) {
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction("pending", "readwrite").objectStore("pending").delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function serverPayload(result: Analysis) {
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
    errors: result.errors.map((error) => ({
      code: error.code,
      title: error.title,
      timeSec: error.timeSec,
      severity: error.severity,
      metric: error.metric,
      observed: error.observed,
      expected: error.expected,
      recommendation: error.recommendation,
      confidence: error.confidence,
    })),
  };
}

async function cachedAsset(url: string) {
  if (!("caches" in window)) {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error("Không tải được tài nguyên AI.");
    return response;
  }
  const cache = await caches.open(AI_CACHE);
  const cached = await cache.match(url);
  if (cached) return cached;
  if (!navigator.onLine) throw new Error("Bộ AI chưa có trên máy. Hãy kết nối mạng một lần và bấm Tải AI offline.");
  const response = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!response.ok) throw new Error(`Không tải được tài nguyên AI (${response.status}).`);
  await cache.put(url, response.clone());
  return response;
}

async function assetsReady() {
  if (!("caches" in window)) return false;
  const cache = await caches.open(AI_CACHE);
  return (await Promise.all(AI_ASSETS.map((url) => cache.match(url)))).every(Boolean);
}

async function prepareAssets(progress?: (done: number, total: number) => void) {
  let done = 0;
  for (const url of AI_ASSETS) {
    await cachedAsset(url);
    done += 1;
    progress?.(done, AI_ASSETS.length);
  }
}

async function createLandmarker() {
  await prepareAssets();
  const [bundle, loader, wasm, model] = await Promise.all(AI_ASSETS.map(cachedAsset));
  const bundleUrl = URL.createObjectURL(new Blob([await bundle.text()], { type: "text/javascript" }));
  const loaderUrl = URL.createObjectURL(new Blob([await loader.text()], { type: "text/javascript" }));
  const wasmUrl = URL.createObjectURL(await wasm.blob());
  const importModule = new Function("url", "return import(url)") as (url: string) => Promise<Record<string, unknown>>;
  const vision = await importModule(bundleUrl) as {
    PoseLandmarker?: { createFromOptions: (fileset: Record<string, string>, options: Record<string, unknown>) => Promise<PoseLandmarker> };
  };
  if (!vision.PoseLandmarker) throw new Error("Không khởi tạo được MediaPipe Pose Landmarker.");
  const landmarker = await vision.PoseLandmarker.createFromOptions(
    { wasmLoaderPath: loaderUrl, wasmBinaryPath: wasmUrl },
    {
      baseOptions: { modelAssetBuffer: new Uint8Array(await model.arrayBuffer()), delegate: "CPU" },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.45,
      minPosePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
    },
  );
  return {
    landmarker,
    dispose: () => {
      landmarker.close?.();
      URL.revokeObjectURL(bundleUrl); URL.revokeObjectURL(loaderUrl); URL.revokeObjectURL(wasmUrl);
    },
  };
}

function seek(video: HTMLVideoElement, seconds: number) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Không đọc được khung hình video.")), 5000);
    const done = () => { window.clearTimeout(timer); resolve(); };
    video.addEventListener("seeked", done, { once: true });
    video.currentTime = Math.min(Math.max(0, seconds), Math.max(0, video.duration - 0.01));
  });
}

function metricAt(time: number, points: Point[]): Metric | null {
  if (points.length < 33) return null;
  const observed = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  const visibility = avg(observed.map((index) => points[index].visibility ?? 1));
  if (visibility < 0.35) return null;
  const leftKnee = jointAngle(points[23], points[25], points[27]);
  const rightKnee = jointAngle(points[24], points[26], points[28]);
  const leftArm = jointAngle(points[11], points[13], points[15]);
  const rightArm = jointAngle(points[12], points[14], points[16]);
  const hipWidth = Math.max(0.025, dist(points[23], points[24]));
  const shoulderWidth = Math.max(0.025, dist(points[11], points[12]));
  const shoulderMid = mid(points[11], points[12]);
  const hipMid = mid(points[23], points[24]);
  const bodyTilt = Math.atan2(Math.abs(shoulderMid.y - hipMid.y), Math.abs(shoulderMid.x - hipMid.x) + 1e-5) * 180 / Math.PI;
  const legRecovery = (180 - (leftKnee + rightKnee) / 2) / 135;
  return {
    time,
    landmarks: points,
    visibility,
    kneeDelta: Math.abs(leftKnee - rightKnee),
    kneeSpread: dist(points[25], points[26]) / hipWidth,
    armDelta: Math.abs(leftArm - rightArm),
    bodyTilt,
    overlap: dist(points[15], points[16]) / shoulderWidth > 1.22 && legRecovery > 0.42,
  };
}

function errorItem(metric: Metric, frameIndex: number, confidence: number, code: string, title: string, observed: string, expected: string, recommendation: string, highlight: number[], critical = false): AnalysisError {
  return { code, title, timeSec: metric.time, severity: critical ? "critical" : "warning", metric: code.toLowerCase(), observed, expected, recommendation, confidence, frameIndex, highlight };
}

function detectErrors(frames: Metric[], view: View, confidence: number) {
  const output: AnalysisError[] = [];
  const worst = (test: (frame: Metric) => boolean, value: (frame: Metric) => number) => {
    const matches = frames.map((frame, index) => ({ frame, index })).filter(({ frame }) => test(frame));
    if (!matches.length) return null;
    return { ratio: matches.length / frames.length, ...matches.reduce((a, b) => value(a.frame) > value(b.frame) ? a : b) };
  };
  if (view === "rear") {
    const item = worst((frame) => frame.kneeSpread > 1.75, (frame) => frame.kneeSpread);
    if (item && item.ratio >= 0.12) output.push(errorItem(item.frame, item.index, confidence, "KNEE_SPREAD_HIGH", "Hai gối mở rộng kéo dài khi thu chân", `${item.frame.kneeSpread.toFixed(2)}× bề rộng hông`, "Giảm độ mở gối; ngưỡng hệ thống v1 < 1,75×", "Thu gót chậm và gọn hơn trước khi xoay bàn chân để đạp.", [23, 24, 25, 26, 27, 28], item.ratio > 0.3));
  }
  const legs = worst((frame) => frame.kneeDelta > 24, (frame) => frame.kneeDelta);
  if (legs && legs.ratio >= 0.14) output.push(errorItem(legs.frame, legs.index, confidence, "LEG_ASYMMETRY", "Hai chân gập không đồng đều", `Lệch ${legs.frame.kneeDelta.toFixed(0)}°`, "Hai bên nên chuyển pha gần đồng thời", "Tập thu hai gót đồng thời rồi mới đạp; ưu tiên đối xứng trước lực.", [23, 24, 25, 26, 27, 28], legs.ratio > 0.3));
  const arms = worst((frame) => frame.armDelta > 28, (frame) => frame.armDelta);
  if (arms && arms.ratio >= 0.14) output.push(errorItem(arms.frame, arms.index, confidence, "ARM_ASYMMETRY", "Hai tay thu/duỗi thiếu đối xứng", `Lệch ${arms.frame.armDelta.toFixed(0)}°`, "Hai tay nên đổi góc gần đồng thời", "Giảm biên độ kéo tay và đưa hai tay về trước cùng thời điểm.", [11, 12, 13, 14, 15, 16], arms.ratio > 0.3));
  const overlap = frames.map((frame, index) => ({ frame, index })).filter(({ frame }) => frame.overlap);
  if (overlap.length / frames.length >= 0.18) {
    const item = overlap[Math.floor(overlap.length / 2)];
    output.push(errorItem(item.frame, item.index, confidence, "ARM_LEG_OVERLAP", "Tay và chân có dấu hiệu chồng pha", `${Math.round(overlap.length / frames.length * 100)}% khung hình`, "Tay tạo lực → thu/đạp chân → lướt", "Tập nhịp chậm: kéo tay – thở – thu/đạp chân – lướt.", [15, 16, 25, 26, 27, 28], overlap.length / frames.length > 0.3));
  }
  if (view === "side") {
    const body = worst((frame) => frame.bodyTilt > 24, (frame) => frame.bodyTilt);
    if (body && body.ratio >= 0.2) output.push(errorItem(body.frame, body.index, confidence, "BODY_LINE_TILT", "Trục vai–hông thay đổi lớn", `${body.frame.bodyTilt.toFixed(0)}°`, "Giữ thân dài và ổn định ngoài pha lấy hơi", "Hạn chế nâng cả ngực quá cao và trở về tư thế lướt sớm sau đạp chân.", [11, 12, 23, 24], body.ratio > 0.3));
  }
  return output.slice(0, 6);
}

function scoreCategories(errors: AnalysisError[]) {
  const penalty = (codes: string[]) => errors.filter((error) => codes.includes(error.code)).reduce((sum, error) => sum + (error.severity === "critical" ? 26 : 15), 0);
  return {
    legs: Math.round(clamp(100 - penalty(["KNEE_SPREAD_HIGH", "LEG_ASYMMETRY"]))),
    arms: Math.round(clamp(100 - penalty(["ARM_ASYMMETRY"]))),
    coordination: Math.round(clamp(100 - penalty(["ARM_LEG_OVERLAP"]))),
    bodyLine: Math.round(clamp(100 - penalty(["BODY_LINE_TILT"]))),
  };
}

function snapshot(video: HTMLVideoElement, metric: Metric, error: AnalysisError) {
  const scale = Math.min(1, 720 / Math.max(1, video.videoWidth));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(320, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(180, Math.round(video.videoHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(89,224,255,.95)"; ctx.lineWidth = Math.max(2, canvas.width / 320);
  for (const [a, b] of CONNECTIONS) {
    const one = metric.landmarks[a]; const two = metric.landmarks[b];
    if (!one || !two) continue;
    ctx.beginPath(); ctx.moveTo(one.x * canvas.width, one.y * canvas.height); ctx.lineTo(two.x * canvas.width, two.y * canvas.height); ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,74,74,.95)";
  for (const index of error.highlight) {
    const point = metric.landmarks[index]; if (!point) continue;
    ctx.beginPath(); ctx.arc(point.x * canvas.width, point.y * canvas.height, Math.max(5, canvas.width / 95), 0, Math.PI * 2); ctx.fill();
  }
  return canvas.toDataURL("image/jpeg", 0.68);
}

async function readCredential() {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("boi-ech-doc-lap");
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  if (!db.objectStoreNames.contains("thiet-bi")) return null;
  return new Promise<StoredCredential | null>((resolve, reject) => {
    const request = db.transaction("thiet-bi", "readonly").objectStore("thiet-bi").get("chinh");
    request.onsuccess = () => resolve((request.result as StoredCredential | undefined) ?? null); request.onerror = () => reject(request.error);
  });
}

function base64Url(bytes: Uint8Array) {
  let binary = ""; bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function syncResult(lessonNumber: string, analysis: Record<string, unknown>) {
  const credential = await readCredential();
  if (!credential?.privateKey || !crypto.subtle) throw new Error("Thiết bị chưa có khóa ký an toàn.");
  const register = await fetch("/api/device", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "register", publicKey: credential.publicKey }) });
  const registered = await register.json() as { device?: DeviceState; error?: string };
  if (!register.ok || !registered.device) throw new Error(registered.error ?? "Không đọc được thiết bị.");
  const device = registered.device;
  if (device.status !== "approved" || !device.registrationComplete || device.accessExpired) throw new Error("Thiết bị chưa đủ quyền đồng bộ.");
  const challengeResponse = await fetch("/api/device", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "challenge", deviceId: device.deviceId }) });
  const challengeData = await challengeResponse.json() as { challenge?: string; error?: string };
  if (!challengeResponse.ok || !challengeData.challenge) throw new Error(challengeData.error ?? "Không tạo được thử thách thiết bị.");
  const message = new TextEncoder().encode(`boi-ech:${device.deviceId}:${challengeData.challenge}`);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message);
  const response = await fetch("/api/video-analysis", {
    method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" },
    body: JSON.stringify({ lessonNumber, analysis, deviceId: device.deviceId, challenge: challengeData.challenge, signature: base64Url(new Uint8Array(signature)) }),
  });
  const data = await response.json() as { saved?: boolean; error?: string };
  if (!response.ok || !data.saved) throw new Error(data.error ?? "Chưa thể đồng bộ kết quả.");
}

function youtubeId(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1).split("/")[0] || null;
    if (url.hostname.includes("youtube.com")) return url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).at(-1) || null;
  } catch { return null; }
  return null;
}

export default function VideoAnalyzer({ lessonNumber = "03" }: { lessonNumber?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState("");
  const [view, setView] = useState<View>("rear");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Chưa chọn video.");
  const [result, setResult] = useState<Analysis | null>(null);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [referenceOpen, setReferenceOpen] = useState(false);
  const embedId = useMemo(() => youtubeId(referenceUrl), [referenceUrl]);

  const flushPending = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      for (const item of await pendingRecords()) {
        const id = typeof item.id === "string" ? item.id : "";
        const lesson = typeof item.lessonNumber === "string" ? item.lessonNumber : lessonNumber;
        const analysis = item.analysis && typeof item.analysis === "object" ? item.analysis as Record<string, unknown> : null;
        if (!id || !analysis) continue;
        await syncResult(lesson, analysis);
        await deletePending(id);
      }
    } catch { /* giữ hàng đợi để thử lại khi có mạng */ }
  }, [lessonNumber]);

  useEffect(() => {
    void assetsReady().then(setReady).catch(() => setReady(false));
    const onOnline = () => { setOnline(true); void flushPending(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline);
    void flushPending();
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, [flushPending]);

  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }, [objectUrl]);

  async function downloadOfflineAi() {
    if (busy) return;
    setBusy(true); setProgress(0); setStatus("Đang tải bộ AI về thiết bị…");
    try {
      await prepareAssets((done, total) => setProgress(Math.round(done / total * 100)));
      setReady(true); setStatus("Bộ AI đã được lưu trên máy. Có thể phân tích khi mất mạng.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Không tải được bộ AI."); }
    finally { setBusy(false); }
  }

  function chooseFile(next: File | null) {
    setResult(null); setProgress(0);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (!next) { setFile(null); setObjectUrl(""); setStatus("Chưa chọn video."); return; }
    if (!next.type.startsWith("video/")) { setStatus("Tệp đã chọn không phải video."); return; }
    if (next.size > MAX_VIDEO_BYTES) { setStatus(`Video ${bytesLabel(next.size)} vượt giới hạn 50 MB.`); return; }
    setFile(next); setObjectUrl(URL.createObjectURL(next)); setStatus(`Đã chọn ${bytesLabel(next.size)}. Hãy kiểm tra góc quay rồi chạy AI.`);
  }

  async function analyze() {
    const video = videoRef.current;
    if (!video || !file || busy) return;
    if (!Number.isFinite(video.duration) || video.duration <= 0) { setStatus("Không đọc được thời lượng video."); return; }
    if (video.duration > MAX_VIDEO_SECONDS + 0.05) { setStatus(`Video dài ${video.duration.toFixed(1)} giây; giới hạn là 30 giây.`); return; }
    setBusy(true); setProgress(0); setResult(null); setStatus("Đang khởi tạo AI cục bộ…");
    let dispose = () => undefined;
    try {
      const pose = await createLandmarker(); dispose = pose.dispose; setReady(true);
      const sampleCount = Math.max(3, Math.min(150, Math.ceil(video.duration * SAMPLE_FPS)));
      const frames: Metric[] = [];
      for (let index = 0; index < sampleCount; index += 1) {
        const time = Math.min(video.duration - 0.01, index / SAMPLE_FPS);
        await seek(video, time);
        const points = pose.landmarker.detectForVideo(video, index * 200 + 1).landmarks?.[0];
        const metric = points ? metricAt(time, points) : null;
        if (metric) frames.push(metric);
        setProgress(Math.round((index + 1) / sampleCount * 82));
        if (index % 5 === 0) await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
      if (frames.length < Math.max(3, Math.ceil(sampleCount * 0.35))) throw new Error("AI nhìn thấy cơ thể quá ít. Hãy quay toàn thân rõ hơn và đủ sáng.");
      const confidence = Math.round(clamp((avg(frames.map((frame) => frame.visibility)) * .55 + frames.length / sampleCount * .45) * 100));
      const errors = detectErrors(frames, view, confidence);
      const categories = scoreCategories(errors);
      let score = Math.round(categories.legs * .35 + categories.arms * .2 + categories.coordination * .3 + categories.bodyLine * .15);
      if (confidence < 55) score = Math.min(score, 75);
      const localFrames: LocalFrame[] = [];
      for (const error of errors.slice(0, 4)) {
        const metric = frames[error.frameIndex]; if (!metric) continue;
        await seek(video, metric.time); const dataUrl = snapshot(video, metric, error);
        if (dataUrl) localFrames.push({ timeSec: metric.time, title: error.title, dataUrl });
      }
      const analysis: Analysis = {
        id: `${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`,
        engineVersion: ENGINE_VERSION, analyzedAt: new Date().toISOString(), durationSec: video.duration, fileSizeBytes: file.size,
        width: video.videoWidth, height: video.videoHeight, sampledFrames: sampleCount, detectedFrames: frames.length, cameraView: view,
        score, confidence, categories, errors, localFrames, syncState: navigator.onLine ? "pending" : "local",
      };
      await putStore("analyses", analysis);
      await putStore("pending", { id: analysis.id, lessonNumber, analysis: serverPayload(analysis), createdAt: new Date().toISOString() });
      setResult(analysis); setProgress(95);
      if (navigator.onLine) {
        try {
          await syncResult(lessonNumber, serverPayload(analysis)); await deletePending(analysis.id);
          const synced = { ...analysis, syncState: "synced" as const }; await putStore("analyses", synced); setResult(synced);
          setStatus("Phân tích xong. Video gốc không rời thiết bị; máy chủ chỉ nhận kết quả JSON.");
        } catch { setStatus("Phân tích xong. Kết quả đang chờ đồng bộ; video vẫn chỉ nằm trên thiết bị."); }
      } else setStatus("Phân tích xong khi offline. Kết quả sẽ tự đồng bộ khi có mạng.");
      setProgress(100);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Không thể phân tích video."); }
    finally { dispose(); setBusy(false); }
  }

  return <div className={styles.shell}>
    <section className={styles.hero}>
      <div><span>Breaststroke Vision · chạy trên thiết bị</span><h1>Phân tích video kỹ thuật bơi ếch</h1><p>Video được đọc trực tiếp trong trình duyệt. Máy chủ không nhận video gốc; chỉ nhận điểm, lỗi, thời điểm và chỉ số sau khi AI xử lý.</p></div>
      <aside><strong>30 giây</strong><span>tối đa</span><strong>50 MB</strong><span>tối đa</span><strong>5 fps</strong><span>AI lấy mẫu</span></aside>
    </section>

    <section className={styles.privacyBar}><i>✓</i><div><strong>Local-first</strong><span>Video và ảnh đánh dấu lỗi chỉ nằm trên máy học viên. Gói đồng bộ không chứa frame, ảnh, base64 hoặc blob.</span></div><b>{online ? "Online" : "Offline"}</b></section>

    <section className={styles.reference}>
      <header><div><span>Video mẫu</span><h2>Gắn URL để học viên xem trước khi tự quay</h2></div><small>URL chỉ để phát; không dùng làm video phân tích.</small></header>
      <div className={styles.referenceInput}><input type="url" placeholder="Dán URL YouTube hoặc video trực tiếp…" value={referenceUrl} onChange={(event) => setReferenceUrl(event.target.value)} /><button type="button" onClick={() => setReferenceOpen(Boolean(referenceUrl.trim()))} disabled={!referenceUrl.trim()}>Mở video mẫu</button></div>
      {referenceOpen && referenceUrl ? embedId ? <div className={styles.embed}><iframe src={`https://www.youtube-nocookie.com/embed/${embedId}`} title="Video mẫu bơi ếch" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div> : <video className={styles.referenceVideo} src={referenceUrl} controls preload="metadata" /> : null}
    </section>

    <section className={styles.workbench}>
      <div className={styles.videoPanel}>
        <header><div><span>01 · Video học viên</span><h2>Chọn file hoặc quay trực tiếp</h2></div><b>{file ? bytesLabel(file.size) : "Chưa có file"}</b></header>
        <div className={styles.fileActions}><label><input type="file" accept="video/*" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} /><span>Chọn video</span></label><label><input type="file" accept="video/*" capture="environment" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} /><span>Quay bằng camera</span></label></div>
        {objectUrl ? <video ref={videoRef} className={styles.studentVideo} src={objectUrl} controls preload="metadata" playsInline muted onLoadedMetadata={() => { const video = videoRef.current; if (video && video.duration > MAX_VIDEO_SECONDS + .05) setStatus(`Video dài ${video.duration.toFixed(1)} giây; hãy chọn đoạn tối đa 30 giây.`); }} /> : <div className={styles.emptyVideo}><span>+</span><strong>Video không được upload lên server</strong><small>Trình duyệt đọc file trực tiếp bằng Object URL.</small></div>}
      </div>

      <div className={styles.controlPanel}>
        <header><span>02 · Thiết lập AI</span><h2>Chọn đúng góc quay</h2></header>
        <div className={styles.viewSwitch}><button type="button" className={view === "rear" ? styles.active : ""} onClick={() => setView("rear")}><strong>Chính diện / phía sau</strong><small>Độ mở gối và đối xứng tay–chân</small></button><button type="button" className={view === "side" ? styles.active : ""} onClick={() => setView("side")}><strong>Ngang bên</strong><small>Đường thân và phối hợp pha</small></button></div>
        <div className={styles.aiCache}><div><i className={ready ? styles.ready : ""} /><span>{ready ? "Bộ AI đã có trên máy" : "Chưa lưu đủ bộ AI offline"}</span></div><button type="button" onClick={() => void downloadOfflineAi()} disabled={busy}>{ready ? "Kiểm tra lại" : "Tải AI offline"}</button></div>
        <button className={styles.analyzeButton} type="button" disabled={!file || busy} onClick={() => void analyze()}>{busy ? `Đang xử lý ${progress}%` : "Phân tích trên máy này"}</button>
        <div className={styles.progress}><i style={{ width: `${progress}%` }} /></div><p className={styles.status} role="status">{status}</p><small className={styles.disclaimer}>AI v1 là công cụ sàng lọc kỹ thuật từ pose landmarks, không thay thế huấn luyện viên. Ngưỡng sẽ được hiệu chỉnh tiếp bằng video bơi thực tế.</small>
      </div>
    </section>

    {result ? <section className={styles.report}>
      <header><div><span>03 · Kết quả AI</span><h2>{result.errors.length ? `Phát hiện ${result.errors.length} điểm cần xem lại` : "Chưa thấy lỗi nổi bật trong các tiêu chí v1"}</h2><p>Độ tin cậy {result.confidence}% · {result.detectedFrames}/{result.sampledFrames} khung hình hợp lệ · {result.syncState === "synced" ? "đã đồng bộ" : "đang giữ local/chờ đồng bộ"}.</p></div><strong>{result.score}<small>/100</small></strong></header>
      <div className={styles.scores}><div><span>Chân</span><b>{result.categories.legs}</b></div><div><span>Tay</span><b>{result.categories.arms}</b></div><div><span>Phối hợp</span><b>{result.categories.coordination}</b></div><div><span>Đường thân</span><b>{result.categories.bodyLine}</b></div></div>
      {result.errors.length ? <div className={styles.errorList}>{result.errors.map((error, index) => <article key={error.code} className={error.severity === "critical" ? styles.critical : ""}><header><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{error.title}</strong><small>{timeLabel(error.timeSec)} · {error.observed}</small></div><b>{error.severity === "critical" ? "Ưu tiên" : "Cần sửa"}</b></header><p>{error.recommendation}</p><footer><span>Mốc tham chiếu</span><strong>{error.expected}</strong></footer></article>)}</div> : null}
      {result.localFrames.length ? <div className={styles.frames}><header><span>Ảnh lỗi lấy từ video local</span><small>Không đồng bộ lên server</small></header><div>{result.localFrames.map((frame) => <figure key={`${frame.timeSec}-${frame.title}`}><img src={frame.dataUrl} alt={`Khung hình lỗi ${frame.title}`} /><figcaption><strong>{frame.title}</strong><span>{timeLabel(frame.timeSec)}</span></figcaption></figure>)}</div></div> : null}
    </section> : null}
  </div>;
}
