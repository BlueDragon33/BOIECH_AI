"use client";

import { useState } from "react";

const SAMPLE_FPS = 5;
const AI_CACHE = "boi-ech-pose-ai-v1";
const VISION_VERSION = "1.0.1";
const BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/vision_bundle.mjs`;
const WASM_LOADER_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm/vision_wasm_internal.js`;
const WASM_BINARY_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm/vision_wasm_internal.wasm`;
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

type Point = { x: number; y: number; z: number; visibility?: number };
type PoseResult = { landmarks?: Point[][] };
type PoseLandmarker = { detectForVideo: (video: HTMLVideoElement, timestampMs: number) => PoseResult; close?: () => void };
type StrokePhase = "pull" | "breath" | "leg-recovery" | "kick" | "glide" | "unclear";
type PhaseFrame = {
  time: number;
  phase: StrokePhase;
  armFlexion: number;
  kneeFlexion: number;
  wristSpread: number;
  ankleSpread: number;
  visibility: number;
};
type PhaseSegment = { phase: StrokePhase; start: number; end: number; frames: number };
type CycleReport = {
  confidence: number;
  completeCycles: number;
  orderScore: number;
  sequence: PhaseSegment[];
  phaseDurations: Record<Exclude<StrokePhase, "unclear">, number>;
  warnings: string[];
};

const PHASE_LABEL: Record<StrokePhase, string> = {
  pull: "Kéo tay",
  breath: "Lấy hơi / trả tay",
  "leg-recovery": "Thu chân",
  kick: "Đạp chân",
  glide: "Lướt",
  unclear: "Chưa rõ",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function jointAngle(a: Point, b: Point, c: Point) {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const denominator = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (denominator < 1e-6) return 180;
  const cosine = clamp((abx * cbx + aby * cby) / denominator, -1, 1);
  return Math.acos(cosine) * 180 / Math.PI;
}

async function cachedAsset(url: string) {
  if (!("caches" in window)) {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error("Không tải được tài nguyên AI chu kỳ.");
    return response;
  }
  const cache = await caches.open(AI_CACHE);
  const cached = await cache.match(url);
  if (cached) return cached;
  if (!navigator.onLine) throw new Error("Bộ AI chưa được lưu đủ trên máy. Hãy dùng nút Tải AI offline phía trên trước.");
  const response = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!response.ok) throw new Error(`Không tải được tài nguyên AI (${response.status}).`);
  await cache.put(url, response.clone());
  return response;
}

async function createLandmarker() {
  const [bundle, loader, wasm, model] = await Promise.all([
    cachedAsset(BUNDLE_URL),
    cachedAsset(WASM_LOADER_URL),
    cachedAsset(WASM_BINARY_URL),
    cachedAsset(MODEL_URL),
  ]);
  const bundleUrl = URL.createObjectURL(new Blob([await bundle.text()], { type: "text/javascript" }));
  const loaderUrl = URL.createObjectURL(new Blob([await loader.text()], { type: "text/javascript" }));
  const wasmUrl = URL.createObjectURL(await wasm.blob());
  const importModule = new Function("url", "return import(url)") as (url: string) => Promise<Record<string, unknown>>;
  const vision = await importModule(bundleUrl) as {
    PoseLandmarker?: { createFromOptions: (fileset: Record<string, string>, options: Record<string, unknown>) => Promise<PoseLandmarker> };
  };
  if (!vision.PoseLandmarker) throw new Error("Không khởi tạo được bộ nhận dạng pha.");
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

function seek(video: HTMLVideoElement, seconds: number) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Không đọc được khung hình để nhận dạng chu kỳ.")), 5000);
    const done = () => {
      window.clearTimeout(timer);
      resolve();
    };
    video.addEventListener("seeked", done, { once: true });
    video.currentTime = Math.min(Math.max(0, seconds), Math.max(0, video.duration - 0.01));
  });
}

function phaseMetrics(time: number, points: Point[], previousKneeFlexion: number | null): PhaseFrame | null {
  if (points.length < 33) return null;
  const observed = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  const visibility = avg(observed.map((index) => points[index]?.visibility ?? 0));
  if (visibility < 0.38) return null;

  const leftArm = jointAngle(points[11], points[13], points[15]);
  const rightArm = jointAngle(points[12], points[14], points[16]);
  const leftKnee = jointAngle(points[23], points[25], points[27]);
  const rightKnee = jointAngle(points[24], points[26], points[28]);
  const armFlexion = 180 - (leftArm + rightArm) / 2;
  const kneeFlexion = 180 - (leftKnee + rightKnee) / 2;
  const shoulderWidth = Math.max(0.025, dist(points[11], points[12]));
  const hipWidth = Math.max(0.025, dist(points[23], points[24]));
  const wristSpread = dist(points[15], points[16]) / shoulderWidth;
  const ankleSpread = dist(points[27], points[28]) / hipWidth;
  const kickVelocity = previousKneeFlexion === null ? 0 : previousKneeFlexion - kneeFlexion;

  let phase: StrokePhase = "unclear";
  if (armFlexion < 24 && kneeFlexion < 22 && wristSpread < 1.18 && ankleSpread < 1.35) {
    phase = "glide";
  } else if (kickVelocity > 5 && kneeFlexion >= 10) {
    phase = "kick";
  } else if (kneeFlexion > 42) {
    phase = "leg-recovery";
  } else if (armFlexion > 48 && wristSpread > 1.12) {
    phase = "pull";
  } else if (armFlexion > 24 && armFlexion <= 48 && kneeFlexion < 42) {
    phase = "breath";
  }

  return { time, phase, armFlexion, kneeFlexion, wristSpread, ankleSpread, visibility };
}

function smoothPhases(frames: PhaseFrame[]) {
  return frames.map((frame, index) => {
    if (frame.phase !== "unclear") return frame;
    const before = frames[index - 1]?.phase;
    const after = frames[index + 1]?.phase;
    if (before && before === after && before !== "unclear") return { ...frame, phase: before };
    return frame;
  });
}

function segmentsFor(frames: PhaseFrame[]) {
  const segments: PhaseSegment[] = [];
  for (const frame of frames) {
    const current = segments.at(-1);
    if (!current || current.phase !== frame.phase) {
      segments.push({ phase: frame.phase, start: frame.time, end: frame.time, frames: 1 });
    } else {
      current.end = frame.time;
      current.frames += 1;
    }
  }
  return segments.filter((segment) => segment.frames >= 2 || segment.phase === "glide");
}

function analyzeSequence(frames: PhaseFrame[]): CycleReport {
  const smoothed = smoothPhases(frames);
  const sequence = segmentsFor(smoothed);
  const expected: Exclude<StrokePhase, "unclear">[] = ["pull", "breath", "leg-recovery", "kick", "glide"];
  const visible = sequence.filter((segment) => segment.phase !== "unclear");
  let expectedIndex = 0;
  let matched = 0;
  let completeCycles = 0;
  for (const segment of visible) {
    if (segment.phase === expected[expectedIndex]) {
      matched += 1;
      expectedIndex += 1;
      if (expectedIndex === expected.length) {
        completeCycles += 1;
        expectedIndex = 0;
      }
    } else if (segment.phase === "pull") {
      expectedIndex = 1;
      matched += 1;
    }
  }

  const phaseDurations = {
    pull: 0,
    breath: 0,
    "leg-recovery": 0,
    kick: 0,
    glide: 0,
  };
  for (const segment of visible) {
    if (segment.phase === "unclear") continue;
    phaseDurations[segment.phase] += Math.max(1 / SAMPLE_FPS, segment.end - segment.start + 1 / SAMPLE_FPS);
  }

  const warnings: string[] = [];
  const phasesSeen = new Set(visible.map((segment) => segment.phase));
  for (const phase of expected) {
    if (!phasesSeen.has(phase)) warnings.push(`Chưa nhận dạng ổn định pha “${PHASE_LABEL[phase]}”.`);
  }
  const overlapping = smoothed.filter((frame) => frame.armFlexion > 38 && frame.kneeFlexion > 42).length / Math.max(1, smoothed.length);
  if (overlapping > 0.18) warnings.push("Tay và chân có dấu hiệu cùng thu mạnh trong một khoảng dài; cần kiểm tra nhịp phối hợp.");
  if (completeCycles === 0) warnings.push("Chưa thấy trọn một chu kỳ 5 pha; nên quay đủ ít nhất 2 nhịp bơi liên tiếp.");
  if (phaseDurations.glide > 0 && phaseDurations.glide < phaseDurations.pull * 0.45) warnings.push("Pha lướt khá ngắn so với pha kéo tay; có thể đang vào nhịp mới quá sớm.");

  const recognizedRatio = smoothed.filter((frame) => frame.phase !== "unclear").length / Math.max(1, smoothed.length);
  const confidence = Math.round(clamp((avg(smoothed.map((frame) => frame.visibility)) * 0.55 + recognizedRatio * 0.45) * 100, 0, 100));
  const orderScore = Math.round(clamp(matched / Math.max(expected.length, visible.length) * 100, 0, 100));
  return { confidence, completeCycles, orderScore, sequence, phaseDurations, warnings };
}

function durationLabel(seconds: number) {
  return `${seconds.toFixed(1)}s`;
}

export default function PhaseCycleAnalyzer() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Dùng chính video học viên đã chọn ở phần trên.");
  const [report, setReport] = useState<CycleReport | null>(null);

  async function run() {
    if (busy) return;
    const video = document.querySelector<HTMLVideoElement>("[data-breaststroke-vision] video[playsinline]");
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      setStatus("Chưa có video học viên hợp lệ ở phần trên.");
      return;
    }
    setBusy(true);
    setReport(null);
    setProgress(0);
    setStatus("Đang nhận dạng chu kỳ kéo tay → lấy hơi → thu chân → đạp → lướt…");
    let dispose = () => undefined;
    try {
      const pose = await createLandmarker();
      dispose = pose.dispose;
      const sampleCount = Math.max(5, Math.min(150, Math.ceil(video.duration * SAMPLE_FPS)));
      const frames: PhaseFrame[] = [];
      let previousKneeFlexion: number | null = null;
      for (let index = 0; index < sampleCount; index += 1) {
        const time = Math.min(video.duration - 0.01, index / SAMPLE_FPS);
        await seek(video, time);
        const points = pose.landmarker.detectForVideo(video, index * 200 + 1).landmarks?.[0];
        const metric = points ? phaseMetrics(time, points, previousKneeFlexion) : null;
        if (metric) {
          frames.push(metric);
          previousKneeFlexion = metric.kneeFlexion;
        }
        setProgress(Math.round((index + 1) / sampleCount * 100));
        if (index % 5 === 0) await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
      if (frames.length < Math.max(5, sampleCount * 0.45)) throw new Error("Không thấy đủ tư thế để nhận dạng chu kỳ. Hãy quay rõ toàn thân hơn.");
      const nextReport = analyzeSequence(frames);
      setReport(nextReport);
      setStatus(`Đã nhận dạng ${nextReport.completeCycles} chu kỳ hoàn chỉnh; dữ liệu pha chỉ tồn tại trên thiết bị.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không thể nhận dạng chu kỳ bơi.");
    } finally {
      dispose();
      setBusy(false);
    }
  }

  const panelStyle = { border: "1px solid #d7e7e8", borderRadius: 20, background: "#ffffff", padding: 22 } as const;
  const miniStyle = { border: "1px solid #e0ebec", borderRadius: 14, padding: 14, background: "#f8fbfb" } as const;

  return (
    <section style={{ maxWidth: 1240, margin: "18px auto 0", padding: "0 28px 28px", fontFamily: "Arial, Helvetica, sans-serif", color: "#163346" }}>
      <div style={panelStyle}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <span style={{ color: "#08727b", fontSize: 12, fontWeight: 900, letterSpacing: ".05em" }}>04 · CHU KỲ ĐỘNG TÁC V2 · THỬ NGHIỆM</span>
            <h2 style={{ margin: "6px 0 8px", fontSize: 23 }}>Nhận dạng 5 pha bơi ếch trên chính video local</h2>
            <p style={{ margin: 0, maxWidth: 760, color: "#526d78", lineHeight: 1.6, fontSize: 13 }}>Engine này chưa tham gia điểm chính. Nó dùng pose landmarks để kiểm tra thứ tự kéo tay → lấy hơi/trả tay → thu chân → đạp chân → lướt trước khi hợp nhất vào Breaststroke Vision.</p>
          </div>
          <button type="button" onClick={() => void run()} disabled={busy} style={{ border: 0, borderRadius: 12, padding: "11px 16px", background: busy ? "#a9babc" : "#08727b", color: "#ffffff", fontWeight: 900, cursor: busy ? "wait" : "pointer" }}>
            {busy ? `Đang nhận dạng ${progress}%` : "Phân tích chu kỳ v2"}
          </button>
        </header>
        <div style={{ height: 6, borderRadius: 999, background: "#e8f0f1", overflow: "hidden", marginTop: 16 }}><i style={{ display: "block", height: "100%", width: `${progress}%`, background: "#15919a" }} /></div>
        <p role="status" style={{ margin: "10px 0 0", fontSize: 13, color: "#49656f" }}>{status}</p>

        {report ? <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
            <div style={miniStyle}><span style={{ fontSize: 12, color: "#67808a" }}>Chu kỳ hoàn chỉnh</span><strong style={{ display: "block", marginTop: 5, fontSize: 24 }}>{report.completeCycles}</strong></div>
            <div style={miniStyle}><span style={{ fontSize: 12, color: "#67808a" }}>Đúng thứ tự pha</span><strong style={{ display: "block", marginTop: 5, fontSize: 24 }}>{report.orderScore}%</strong></div>
            <div style={miniStyle}><span style={{ fontSize: 12, color: "#67808a" }}>Độ tin cậy pha</span><strong style={{ display: "block", marginTop: 5, fontSize: 24 }}>{report.confidence}%</strong></div>
          </div>

          <div style={miniStyle}>
            <strong style={{ fontSize: 13 }}>Thời lượng các pha đã nhận dạng</strong>
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
              {(Object.entries(report.phaseDurations) as [Exclude<StrokePhase, "unclear">, number][]).map(([phase, seconds]) => <div key={phase} style={{ padding: 10, borderRadius: 10, background: "#ffffff" }}><span style={{ display: "block", fontSize: 11, color: "#6a838c" }}>{PHASE_LABEL[phase]}</span><b style={{ fontSize: 16 }}>{durationLabel(seconds)}</b></div>)}
            </div>
          </div>

          <div style={miniStyle}>
            <strong style={{ fontSize: 13 }}>Timeline pha</strong>
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {report.sequence.map((segment, index) => <span key={`${segment.phase}-${segment.start}-${index}`} style={{ borderRadius: 999, padding: "7px 10px", background: segment.phase === "unclear" ? "#eef1f2" : "#e4f5f4", color: segment.phase === "unclear" ? "#6f7e83" : "#075f68", fontSize: 12, fontWeight: 800 }}>{PHASE_LABEL[segment.phase]} · {segment.start.toFixed(1)}–{segment.end.toFixed(1)}s</span>)}
            </div>
          </div>

          {report.warnings.length ? <div style={{ ...miniStyle, background: "#fffaf1", borderColor: "#f0dfbf" }}><strong style={{ fontSize: 13 }}>Điểm cần kiểm tra thêm</strong><ul style={{ margin: "8px 0 0", paddingLeft: 20, color: "#66543d", lineHeight: 1.6, fontSize: 13 }}>{report.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
        </div> : null}
      </div>
    </section>
  );
}
