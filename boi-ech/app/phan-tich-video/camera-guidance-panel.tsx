"use client";

import { useEffect, useState } from "react";
import { assessCameraGuidance } from "./camera-guidance-core.mjs";
import { SharedCameraProfileControl, SharedCameraProfileStatus, useCameraProfile } from "./camera-profile-session";
import { capturePlaybackState, restorePlaybackState } from "./video-playback-state.mjs";

const AI_CACHE = "boi-ech-pose-ai-v1";
const VISION_VERSION = "1.0.1";
const BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/vision_bundle.mjs`;
const WASM_LOADER_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm/vision_wasm_internal.js`;
const WASM_BINARY_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm/vision_wasm_internal.wasm`;
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

type Point = { x: number; y: number; z: number; visibility?: number };
type PoseResult = { landmarks?: Point[][] };
type PoseLandmarker = { detectForVideo: (video: HTMLVideoElement, timestampMs: number) => PoseResult; close?: () => void };
type GuidanceReport = {
  ready: boolean;
  status: "good" | "review" | "retry";
  score: number;
  metrics: {
    detectionRate: number;
    visibility: number;
    bodyCoverage: number;
    edgeSafety: number;
    stability: number;
    leftVisibility: number;
    rightVisibility: number;
    bilateralVisibility: number;
    primarySideVisibility: number;
  };
  checks: Record<string, boolean>;
  issues: string[];
};

type GuidanceSample = {
  detected: boolean;
  visibility: number;
  leftVisibility: number;
  rightVisibility: number;
  bodySpan: number;
  edgeSafe: boolean;
};

const avg = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function learnerVideo() {
  return document.querySelector<HTMLVideoElement>("[data-breaststroke-vision] video[playsinline]");
}

function seek(video: HTMLVideoElement, seconds: number) {
  const target = Math.min(Math.max(0, seconds), Math.max(0, video.duration - 0.01));
  if (Math.abs(video.currentTime - target) < 0.001) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", done);
    };
    const done = () => { cleanup(); resolve(); };
    const timer = window.setTimeout(() => { cleanup(); reject(new Error("Không đọc được mốc video để kiểm tra khung quay.")); }, 5000);
    video.addEventListener("seeked", done, { once: true });
    try { video.currentTime = target; } catch (error) { cleanup(); reject(error); }
  });
}

async function cachedAsset(url: string) {
  if (!("caches" in window)) {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error("Không tải được tài nguyên AI kiểm tra khung quay.");
    return response;
  }
  const cache = await caches.open(AI_CACHE);
  const cached = await cache.match(url);
  if (cached) return cached;
  if (!navigator.onLine) throw new Error("Bộ AI chưa được lưu đủ trên máy. Hãy tải AI offline khi có mạng rồi thử lại.");
  const response = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!response.ok) throw new Error(`Không tải được tài nguyên AI (${response.status}).`);
  await cache.put(url, response.clone());
  return response;
}

async function createLandmarker() {
  const [bundle, loader, wasm, model] = await Promise.all([
    cachedAsset(BUNDLE_URL), cachedAsset(WASM_LOADER_URL), cachedAsset(WASM_BINARY_URL), cachedAsset(MODEL_URL),
  ]);
  const bundleUrl = URL.createObjectURL(new Blob([await bundle.text()], { type: "text/javascript" }));
  const loaderUrl = URL.createObjectURL(new Blob([await loader.text()], { type: "text/javascript" }));
  const wasmUrl = URL.createObjectURL(await wasm.blob());
  const importModule = new Function("url", "return import(url)") as (url: string) => Promise<Record<string, unknown>>;
  const vision = await importModule(bundleUrl) as {
    PoseLandmarker?: { createFromOptions: (fileset: Record<string, string>, options: Record<string, unknown>) => Promise<PoseLandmarker> };
  };
  if (!vision.PoseLandmarker) throw new Error("Không khởi tạo được AI kiểm tra khung quay.");
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
      URL.revokeObjectURL(bundleUrl);
      URL.revokeObjectURL(loaderUrl);
      URL.revokeObjectURL(wasmUrl);
    },
  };
}

function guidanceSample(points?: Point[]): GuidanceSample {
  if (!points || points.length < 33) return { detected: false, visibility: 0, leftVisibility: 0, rightVisibility: 0, bodySpan: 0, edgeSafe: false };
  const main = [0, 11, 12, 15, 16, 23, 24, 27, 28];
  const observed = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  const left = [11, 13, 15, 23, 25, 27];
  const right = [12, 14, 16, 24, 26, 28];
  const visibleMain = main.map((index) => points[index]).filter((point) => point && (point.visibility ?? 0) >= 0.35);
  const visibility = avg(observed.map((index) => points[index]?.visibility ?? 0));
  const leftVisibility = avg(left.map((index) => points[index]?.visibility ?? 0));
  const rightVisibility = avg(right.map((index) => points[index]?.visibility ?? 0));
  if (visibleMain.length < 5 || visibility < 0.3) return { detected: false, visibility, leftVisibility, rightVisibility, bodySpan: 0, edgeSafe: false };
  const xs = visibleMain.map((point) => point.x);
  const ys = visibleMain.map((point) => point.y);
  const bodySpan = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const edgeSafe = visibleMain.every((point) => point.x >= 0.02 && point.x <= 0.98 && point.y >= 0.02 && point.y <= 0.98);
  return { detected: true, visibility, leftVisibility, rightVisibility, bodySpan, edgeSafe };
}

function metricPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function CameraGuidancePanel() {
  const view = useCameraProfile();
  const [hasVideo, setHasVideo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<GuidanceReport | null>(null);
  const [status, setStatus] = useState("Chọn hoặc quay video, chọn góc quay chung rồi kiểm tra khung trước khi phân tích.");

  useEffect(() => {
    const root = document.querySelector("[data-breaststroke-vision]");
    if (!root) return;
    const update = () => setHasVideo(Boolean(learnerVideo()));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setReport(null);
    setProgress(0);
  }, [view, hasVideo]);

  async function runGuidance() {
    if (busy) return;
    const video = learnerVideo();
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      setStatus("Chưa có video hợp lệ để kiểm tra khung quay.");
      return;
    }
    if (!view) {
      setStatus("Hãy chọn góc quay chung trước khi kiểm tra khung.");
      return;
    }
    const playbackState = capturePlaybackState(video);
    video.pause();
    setBusy(true);
    setReport(null);
    setProgress(0);
    setStatus("Đang kiểm tra nhanh khung quay trên thiết bị…");
    let dispose = () => undefined;
    try {
      const pose = await createLandmarker();
      dispose = pose.dispose;
      const sampleCount = 12;
      const samples: GuidanceSample[] = [];
      for (let index = 0; index < sampleCount; index += 1) {
        const ratio = sampleCount === 1 ? 0 : index / (sampleCount - 1);
        const time = Math.min(video.duration - 0.01, Math.max(0, (video.duration - 0.02) * ratio));
        await seek(video, time);
        const points = pose.landmarker.detectForVideo(video, index * 250 + 1).landmarks?.[0];
        samples.push(guidanceSample(points));
        setProgress(Math.round((index + 1) / sampleCount * 100));
        if (index % 3 === 0) await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
      const next = assessCameraGuidance(samples, view) as GuidanceReport;
      setReport(next);
      setStatus(next.status === "good"
        ? "Khung quay đạt preflight; có thể chạy phân tích đầy đủ."
        : next.status === "review"
          ? "Khung quay dùng được nhưng còn điểm cần lưu ý trước khi phân tích."
          : "Khung quay chưa đủ tốt; nên quay lại trước khi chạy phân tích đầy đủ.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không thể kiểm tra khung quay.");
    } finally {
      try { dispose(); } catch { /* luôn ưu tiên khôi phục video */ }
      await restorePlaybackState(video, playbackState, seek);
      setBusy(false);
    }
  }

  const tone = report?.status === "good" ? "#2f6b4d" : report?.status === "review" ? "#7b632f" : "#8b4343";
  const background = report?.status === "good" ? "#f2fbf6" : report?.status === "review" ? "#fffaf0" : "#fff6f6";

  return (
    <section data-camera-guidance-local-only style={{ maxWidth: 1240, margin: "0 auto 22px", padding: "0 28px", fontFamily: "Arial, Helvetica, sans-serif", color: "#163346" }}>
      <div style={{ border: "1px solid #d7e5e7", borderRadius: 20, background: "#fff", padding: 18, boxShadow: "0 12px 34px rgba(17,66,75,.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 700 }}>
            <span style={{ display: "block", color: "#08727b", fontSize: 10, fontWeight: 900, letterSpacing: ".08em" }}>KIỂM TRA KHUNG QUAY TRƯỚC PHÂN TÍCH</span>
            <h2 style={{ margin: "5px 0 6px", fontSize: 19 }}>Camera Guidance · local-only</h2>
            <p style={{ margin: 0, color: "#607780", fontSize: 11, lineHeight: 1.5 }}>AI đọc 12 mốc rải đều trong video để cảnh báo sớm pose đứt quãng, người bơi quá nhỏ, tay/chân sát mép hoặc che khuất. Không lưu frame và không gửi dữ liệu lên máy chủ.</p>
            <div style={{ marginTop: 6 }}><SharedCameraProfileStatus /></div>
          </div>
          <SharedCameraProfileControl compact />
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={() => void runGuidance()} disabled={busy || !hasVideo} style={{ border: 0, borderRadius: 10, padding: "9px 12px", background: busy || !hasVideo ? "#aababc" : "#08727b", color: "#fff", fontSize: 11, fontWeight: 900, cursor: busy || !hasVideo ? "not-allowed" : "pointer" }}>{busy ? `Đang kiểm tra ${progress}%` : "Kiểm tra khung quay"}</button>
          <span style={{ fontSize: 10, color: hasVideo ? "#57717b" : "#846747" }}>{hasVideo ? "Video local đã sẵn sàng cho preflight." : "Chưa có video học viên."}</span>
        </div>
        <div style={{ height: 5, marginTop: 9, borderRadius: 999, background: "#e8f0f1", overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: `${progress}%`, background: "#15919a" }} /></div>
        <p role="status" style={{ margin: "8px 0 0", fontSize: 10, color: "#566f79" }}>{status}</p>

        {report ? <div style={{ marginTop: 12, border: `1px solid ${tone}33`, borderRadius: 12, background, padding: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ color: tone, fontSize: 12 }}>{report.status === "good" ? "Đạt preflight" : report.status === "review" ? "Nên chỉnh trước khi quay/phân tích" : "Nên quay lại"}</strong>
            <b style={{ color: tone, fontSize: 13 }}>{report.score}% checklist</b>
          </div>
          <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 6 }}>
            <div style={{ borderRadius: 8, background: "#fff", padding: 8 }}><span style={{ display: "block", fontSize: 8, color: "#71858c" }}>Pose liên tục</span><b style={{ fontSize: 11 }}>{metricPercent(report.metrics.detectionRate)}</b></div>
            <div style={{ borderRadius: 8, background: "#fff", padding: 8 }}><span style={{ display: "block", fontSize: 8, color: "#71858c" }}>Độ rõ khớp</span><b style={{ fontSize: 11 }}>{metricPercent(report.metrics.visibility)}</b></div>
            <div style={{ borderRadius: 8, background: "#fff", padding: 8 }}><span style={{ display: "block", fontSize: 8, color: "#71858c" }}>Cơ thể đủ lớn</span><b style={{ fontSize: 11 }}>{metricPercent(report.metrics.bodyCoverage)}</b></div>
            <div style={{ borderRadius: 8, background: "#fff", padding: 8 }}><span style={{ display: "block", fontSize: 8, color: "#71858c" }}>Không sát mép</span><b style={{ fontSize: 11 }}>{metricPercent(report.metrics.edgeSafety)}</b></div>
            <div style={{ borderRadius: 8, background: "#fff", padding: 8 }}><span style={{ display: "block", fontSize: 8, color: "#71858c" }}>Ổn định khung</span><b style={{ fontSize: 11 }}>{metricPercent(report.metrics.stability)}</b></div>
          </div>
          <ul style={{ margin: "9px 0 0", paddingLeft: 17, color: tone, fontSize: 10, lineHeight: 1.5 }}>{report.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
        </div> : null}
      </div>
    </section>
  );
}
