"use client";

import { useState } from "react";
import { analyzePhaseSequence, classifyPhase, PHASE_LABEL, PHASE_THRESHOLDS, SAMPLE_FPS, summarizeCalibration } from "./phase-cycle-core.mjs";

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
type ScoredPhase = Exclude<StrokePhase, "unclear">;
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
type CycleQuality = {
  index: number;
  start: number;
  end: number;
  duration: number;
  qualityScore: number;
  status: "good" | "review" | "weak";
  weakestPhase: ScoredPhase;
  weakestPhaseScore: number;
  phaseScores: Record<ScoredPhase, number>;
  phaseStarts: Record<ScoredPhase, number>;
  visibilityAvg: number;
  recognizedRatio: number;
  overlapRatio: number;
  orderPurity: number;
  issues: string[];
};
type CycleReport = {
  confidence: number;
  completeCycles: number;
  orderScore: number;
  cycleQualityAvg: number;
  cycles: CycleQuality[];
  sequence: PhaseSegment[];
  phaseDurations: Record<ScoredPhase, number>;
  warnings: string[];
};
type MetricStats = { min: number; max: number; avg: number };
type CalibrationSummary = {
  sampledFrames: number;
  recognizedRatio: number;
  overlapRatio: number;
  visibilityAvg: number;
  visibilityMin: number;
  metrics: Record<"armFlexion" | "kneeFlexion" | "wristSpread" | "ankleSpread", MetricStats>;
  phases: Record<StrokePhase, number>;
};

const SCORED_PHASES: ScoredPhase[] = ["pull", "breath", "leg-recovery", "kick", "glide"];

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
  const cosine = Math.min(1, Math.max(-1, (abx * cbx + aby * cby) / denominator));
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

function learnerVideo() {
  return document.querySelector<HTMLVideoElement>("[data-breaststroke-vision] video[playsinline]");
}

function jumpToFrame(time: number) {
  const video = learnerVideo();
  if (!video) return;
  video.currentTime = Math.min(Math.max(0, time), Math.max(0, video.duration - 0.01));
  video.scrollIntoView({ behavior: "smooth", block: "center" });
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
  const phase = classifyPhase({ armFlexion, kneeFlexion, wristSpread, ankleSpread, previousKneeFlexion }) as StrokePhase;

  return { time, phase, armFlexion, kneeFlexion, wristSpread, ankleSpread, visibility };
}

function durationLabel(seconds: number) {
  return `${seconds.toFixed(1)}s`;
}

function metricLabel(stats: MetricStats, digits = 1) {
  return `${stats.min.toFixed(digits)}–${stats.max.toFixed(digits)} · TB ${stats.avg.toFixed(digits)}`;
}

function qualityLabel(status: CycleQuality["status"]) {
  if (status === "good") return "Tốt";
  if (status === "review") return "Cần xem";
  return "Yếu";
}

export default function PhaseCycleAnalyzer() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Dùng chính video học viên đã chọn ở phần trên.");
  const [report, setReport] = useState<CycleReport | null>(null);
  const [calibrationFrames, setCalibrationFrames] = useState<PhaseFrame[]>([]);
  const [showCalibration, setShowCalibration] = useState(false);

  const calibration = calibrationFrames.length ? summarizeCalibration(calibrationFrames) as CalibrationSummary : null;
  const calibrationStep = Math.max(1, Math.ceil(calibrationFrames.length / 60));
  const calibrationRows = calibrationFrames.filter((_, index) => index % calibrationStep === 0);

  async function run() {
    if (busy) return;
    const video = learnerVideo();
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      setStatus("Chưa có video học viên hợp lệ ở phần trên.");
      return;
    }
    setBusy(true);
    setReport(null);
    setCalibrationFrames([]);
    setShowCalibration(false);
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
      const nextReport = analyzePhaseSequence(frames) as CycleReport;
      setCalibrationFrames(frames);
      setReport(nextReport);
      setStatus(`Đã nhận dạng ${nextReport.completeCycles} chu kỳ hoàn chỉnh; dữ liệu pha, chất lượng chu kỳ và calibration chỉ tồn tại trên thiết bị.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không thể nhận dạng chu kỳ bơi.");
    } finally {
      dispose();
      setBusy(false);
    }
  }

  const panelStyle = { border: "1px solid #d7e7e8", borderRadius: 20, background: "#ffffff", padding: 22 } as const;
  const miniStyle = { border: "1px solid #e0ebec", borderRadius: 14, padding: 14, background: "#f8fbfb" } as const;
  const cellStyle = { padding: "8px 10px", borderBottom: "1px solid #e8eff0", whiteSpace: "nowrap", fontSize: 12 } as const;

  return (
    <section style={{ maxWidth: 1240, margin: "18px auto 0", padding: "0 28px 28px", fontFamily: "Arial, Helvetica, sans-serif", color: "#163346" }}>
      <div style={panelStyle}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <span style={{ color: "#08727b", fontSize: 12, fontWeight: 900, letterSpacing: ".05em" }}>04 · CHU KỲ ĐỘNG TÁC V2.1 · THỬ NGHIỆM</span>
            <h2 style={{ margin: "6px 0 8px", fontSize: 23 }}>Nhận dạng 5 pha và chất lượng từng chu kỳ trên video local</h2>
            <p style={{ margin: 0, maxWidth: 820, color: "#526d78", lineHeight: 1.6, fontSize: 13 }}>Engine này chưa tham gia điểm chính. Điểm từng chu kỳ chỉ là độ tin cậy kỹ thuật theo tín hiệu pose/ngưỡng thử nghiệm để tìm đoạn cần xem lại, chưa phải điểm sinh cơ học đã hiệu chuẩn.</p>
          </div>
          <button type="button" onClick={() => void run()} disabled={busy} style={{ border: 0, borderRadius: 12, padding: "11px 16px", background: busy ? "#a9babc" : "#08727b", color: "#ffffff", fontWeight: 900, cursor: busy ? "wait" : "pointer" }}>
            {busy ? `Đang nhận dạng ${progress}%` : "Phân tích chu kỳ v2.1"}
          </button>
        </header>
        <div style={{ height: 6, borderRadius: 999, background: "#e8f0f1", overflow: "hidden", marginTop: 16 }}><i style={{ display: "block", height: "100%", width: `${progress}%`, background: "#15919a" }} /></div>
        <p role="status" style={{ margin: "10px 0 0", fontSize: 13, color: "#49656f" }}>{status}</p>

        {report ? <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
            <div style={miniStyle}><span style={{ fontSize: 12, color: "#67808a" }}>Chu kỳ hoàn chỉnh</span><strong style={{ display: "block", marginTop: 5, fontSize: 24 }}>{report.completeCycles}</strong></div>
            <div style={miniStyle}><span style={{ fontSize: 12, color: "#67808a" }}>Đúng thứ tự pha</span><strong style={{ display: "block", marginTop: 5, fontSize: 24 }}>{report.orderScore}%</strong></div>
            <div style={miniStyle}><span style={{ fontSize: 12, color: "#67808a" }}>Độ tin cậy pha</span><strong style={{ display: "block", marginTop: 5, fontSize: 24 }}>{report.confidence}%</strong></div>
            <div style={miniStyle}><span style={{ fontSize: 12, color: "#67808a" }}>Chất lượng chu kỳ TB</span><strong style={{ display: "block", marginTop: 5, fontSize: 24 }}>{report.cycles.length ? `${report.cycleQualityAvg}%` : "—"}</strong></div>
          </div>

          <div style={miniStyle}>
            <strong style={{ fontSize: 13 }}>Thời lượng các pha đã nhận dạng</strong>
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
              {(Object.entries(report.phaseDurations) as [ScoredPhase, number][]).map(([phase, seconds]) => <div key={phase} style={{ padding: 10, borderRadius: 10, background: "#ffffff" }}><span style={{ display: "block", fontSize: 11, color: "#6a838c" }}>{PHASE_LABEL[phase]}</span><b style={{ fontSize: 16 }}>{durationLabel(seconds)}</b></div>)}
            </div>
          </div>

          <div style={miniStyle}>
            <strong style={{ fontSize: 13 }}>Timeline pha</strong>
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {report.sequence.map((segment, index) => <button type="button" onClick={() => jumpToFrame(segment.start)} key={`${segment.phase}-${segment.start}-${index}`} style={{ border: 0, borderRadius: 999, padding: "7px 10px", background: segment.phase === "unclear" ? "#eef1f2" : "#e4f5f4", color: segment.phase === "unclear" ? "#6f7e83" : "#075f68", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{PHASE_LABEL[segment.phase]} · {segment.start.toFixed(1)}–{segment.end.toFixed(1)}s</button>)}
            </div>
          </div>

          {report.cycles.length ? <div style={{ ...miniStyle, background: "#f7fbff" }} data-cycle-quality-local-only>
            <div>
              <strong style={{ fontSize: 14 }}>Chất lượng từng chu kỳ · v2.1</strong>
              <p style={{ margin: "5px 0 0", color: "#5b737d", fontSize: 12, lineHeight: 1.5 }}>Dùng để khoanh vùng chu kỳ/pha cần xem lại. Không gửi điểm pha hay trace chu kỳ lên máy chủ.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 10, marginTop: 12 }}>
              {report.cycles.map((cycle) => <article key={cycle.index} style={{ border: "1px solid #dce8ef", borderRadius: 14, background: "#ffffff", padding: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div>
                    <strong style={{ fontSize: 15 }}>Chu kỳ {cycle.index}</strong>
                    <button type="button" onClick={() => jumpToFrame(cycle.start)} style={{ display: "block", marginTop: 4, padding: 0, border: 0, background: "transparent", color: "#47717e", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>{cycle.start.toFixed(1)}–{cycle.end.toFixed(1)}s · {durationLabel(cycle.duration)}</button>
                  </div>
                  <div style={{ textAlign: "right" }}><b style={{ display: "block", fontSize: 22 }}>{cycle.qualityScore}%</b><span style={{ fontSize: 11, fontWeight: 800 }}>{qualityLabel(cycle.status)}</span></div>
                </div>

                <button type="button" onClick={() => jumpToFrame(cycle.phaseStarts[cycle.weakestPhase])} style={{ width: "100%", marginTop: 10, border: "1px solid #ead9b6", borderRadius: 10, background: "#fffaf0", padding: "8px 10px", textAlign: "left", cursor: "pointer", color: "#66543d" }}>
                  <span style={{ display: "block", fontSize: 10 }}>Pha yếu nhất · bấm để xem</span>
                  <b>{PHASE_LABEL[cycle.weakestPhase]} · {cycle.weakestPhaseScore}%</b>
                </button>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 4, marginTop: 9 }}>
                  {SCORED_PHASES.map((phase) => <button type="button" key={phase} onClick={() => jumpToFrame(cycle.phaseStarts[phase])} title={`Xem pha ${PHASE_LABEL[phase]}`} style={{ border: "1px solid #e1ebef", borderRadius: 8, background: phase === cycle.weakestPhase ? "#fff7e8" : "#f8fbfc", padding: "6px 3px", cursor: "pointer", minWidth: 0 }}><span style={{ display: "block", fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{PHASE_LABEL[phase]}</span><b style={{ fontSize: 12 }}>{cycle.phaseScores[phase]}%</b></button>)}
                </div>

                <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5, fontSize: 10, color: "#5d737d" }}>
                  <span>Pose {Math.round(cycle.visibilityAvg * 100)}%</span>
                  <span>Nhận pha {Math.round(cycle.recognizedRatio * 100)}%</span>
                  <span>Chồng pha {Math.round(cycle.overlapRatio * 100)}%</span>
                </div>
                {cycle.issues.length ? <ul style={{ margin: "8px 0 0", paddingLeft: 17, fontSize: 11, lineHeight: 1.45, color: "#6b5740" }}>{cycle.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p style={{ margin: "8px 0 0", fontSize: 11, color: "#50726c" }}>Không có cảnh báo chu kỳ theo ngưỡng thử nghiệm hiện tại.</p>}
              </article>)}
            </div>
          </div> : null}

          {report.warnings.length ? <div style={{ ...miniStyle, background: "#fffaf1", borderColor: "#f0dfbf" }}><strong style={{ fontSize: 13 }}>Điểm cần kiểm tra thêm</strong><ul style={{ margin: "8px 0 0", paddingLeft: 20, color: "#66543d", lineHeight: 1.6, fontSize: 13 }}>{report.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}

          {calibration ? <div style={{ ...miniStyle, background: "#f4fafa" }} data-phase-calibration-local-only>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <strong style={{ fontSize: 14 }}>Calibration Mode · local-only</strong>
                <p style={{ margin: "5px 0 0", color: "#5b737d", fontSize: 12, lineHeight: 1.5 }}>Dữ liệu này dùng để hiệu chỉnh ngưỡng nhận pha trên video thực tế; không gửi lên `/api/video-analysis` và không lưu vào lịch sử phân tích.</p>
              </div>
              <button type="button" onClick={() => setShowCalibration((value) => !value)} style={{ border: "1px solid #9fc7c9", borderRadius: 10, background: "#ffffff", color: "#075f68", padding: "9px 12px", fontWeight: 800, cursor: "pointer" }}>{showCalibration ? "Ẩn calibration" : "Hiện calibration"}</button>
            </div>

            {showCalibration ? <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
                <div style={{ background: "#fff", borderRadius: 10, padding: 10 }}><span style={{ display: "block", fontSize: 11, color: "#67808a" }}>Khung pose hợp lệ</span><b>{calibration.sampledFrames}</b></div>
                <div style={{ background: "#fff", borderRadius: 10, padding: 10 }}><span style={{ display: "block", fontSize: 11, color: "#67808a" }}>Nhận được pha</span><b>{Math.round(calibration.recognizedRatio * 100)}%</b></div>
                <div style={{ background: "#fff", borderRadius: 10, padding: 10 }}><span style={{ display: "block", fontSize: 11, color: "#67808a" }}>Visibility TB / thấp nhất</span><b>{Math.round(calibration.visibilityAvg * 100)}% / {Math.round(calibration.visibilityMin * 100)}%</b></div>
                <div style={{ background: "#fff", borderRadius: 10, padding: 10 }}><span style={{ display: "block", fontSize: 11, color: "#67808a" }}>Tỷ lệ chồng tay–chân</span><b>{Math.round(calibration.overlapRatio * 100)}%</b></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
                <div style={{ background: "#fff", borderRadius: 10, padding: 10 }}><b style={{ fontSize: 12 }}>Arm flexion</b><span style={{ display: "block", marginTop: 3, fontSize: 12 }}>{metricLabel(calibration.metrics.armFlexion)}</span></div>
                <div style={{ background: "#fff", borderRadius: 10, padding: 10 }}><b style={{ fontSize: 12 }}>Knee flexion</b><span style={{ display: "block", marginTop: 3, fontSize: 12 }}>{metricLabel(calibration.metrics.kneeFlexion)}</span></div>
                <div style={{ background: "#fff", borderRadius: 10, padding: 10 }}><b style={{ fontSize: 12 }}>Wrist spread</b><span style={{ display: "block", marginTop: 3, fontSize: 12 }}>{metricLabel(calibration.metrics.wristSpread, 2)}</span></div>
                <div style={{ background: "#fff", borderRadius: 10, padding: 10 }}><b style={{ fontSize: 12 }}>Ankle spread</b><span style={{ display: "block", marginTop: 3, fontSize: 12 }}>{metricLabel(calibration.metrics.ankleSpread, 2)}</span></div>
              </div>

              <details>
                <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: 12 }}>Ngưỡng engine hiện tại</summary>
                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 7, fontSize: 12 }}>
                  <span>Lướt: tay &lt; {PHASE_THRESHOLDS.glideArmFlexionMax}°, gối &lt; {PHASE_THRESHOLDS.glideKneeFlexionMax}°</span>
                  <span>Kéo tay: tay &gt; {PHASE_THRESHOLDS.pullArmFlexionMin}°, wrist spread &gt; {PHASE_THRESHOLDS.pullWristSpreadMin}</span>
                  <span>Thu chân: gối &gt; {PHASE_THRESHOLDS.legRecoveryKneeFlexionMin}°</span>
                  <span>Đạp: giảm knee flexion &gt; {PHASE_THRESHOLDS.kickVelocityMin}° / mẫu</span>
                  <span>Chồng pha: tay &gt; {PHASE_THRESHOLDS.overlapArmFlexionMin}° và gối &gt; {PHASE_THRESHOLDS.overlapKneeFlexionMin}°</span>
                </div>
              </details>

              <div style={{ overflowX: "auto", maxHeight: 360, border: "1px solid #dce9ea", borderRadius: 12, background: "#fff" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                  <thead style={{ position: "sticky", top: 0, background: "#eef7f7", zIndex: 1 }}><tr><th style={cellStyle}>Thời gian</th><th style={cellStyle}>Pha AI</th><th style={cellStyle}>Tay °</th><th style={cellStyle}>Gối °</th><th style={cellStyle}>Wrist spread</th><th style={cellStyle}>Ankle spread</th><th style={cellStyle}>Visibility</th></tr></thead>
                  <tbody>{calibrationRows.map((frame) => <tr key={`${frame.time}-${frame.phase}`} onClick={() => jumpToFrame(frame.time)} style={{ cursor: "pointer" }} title="Bấm để nhảy video tới mốc này"><td style={cellStyle}>{frame.time.toFixed(1)}s</td><td style={cellStyle}><b>{PHASE_LABEL[frame.phase]}</b></td><td style={cellStyle}>{frame.armFlexion.toFixed(1)}</td><td style={cellStyle}>{frame.kneeFlexion.toFixed(1)}</td><td style={cellStyle}>{frame.wristSpread.toFixed(2)}</td><td style={cellStyle}>{frame.ankleSpread.toFixed(2)}</td><td style={cellStyle}>{Math.round(frame.visibility * 100)}%</td></tr>)}</tbody>
                </table>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "#6b8189" }}>Bảng chỉ hiển thị tối đa khoảng 60 mốc để giữ giao diện nhẹ. Bấm một dòng để đối chiếu đúng thời điểm trên video.</p>
            </div> : null}
          </div> : null}
        </div> : null}
      </div>
    </section>
  );
}
