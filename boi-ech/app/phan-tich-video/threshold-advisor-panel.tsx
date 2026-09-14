"use client";

import { analyzePhaseSequence, PHASE_LABEL, PHASE_THRESHOLDS } from "./phase-cycle-core.mjs";
import { adviseThresholds } from "./phase-threshold-advisor.mjs";
import { assessCalibrationCoverage, CALIBRATION_COVERAGE_RULES, CALIBRATION_VIEWS } from "./phase-calibration-coverage.mjs";

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
type Recommendation = {
  key: string;
  label: string;
  current: number;
  suggested: number;
  delta: number;
  support: number;
  baselineAccuracy: number;
  candidateAccuracy: number;
  gain: number;
};
type Advisor = {
  ready: boolean;
  minimumAnnotations: number;
  baseline: { annotated: number; accuracy: number };
  preview: { annotated: number; accuracy: number };
  recommendations: Recommendation[];
  reason: string;
};
type Coverage = {
  readyForThresholdReview: boolean;
  globalReady: boolean;
  coverageScore: number;
  annotated: number;
  counts: Record<ScoredPhase, number>;
  completeCycles: number;
  temporalCoverage: number;
  dominantShare: number;
  viewSelected: boolean;
  checks: Record<string, boolean>;
  issues: string[];
  note: string;
};

const SCORED_PHASES: ScoredPhase[] = ["pull", "breath", "leg-recovery", "kick", "glide"];

function valueLabel(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function checkLabel(key: string) {
  if (key === "enoughAnnotations") return `≥ ${CALIBRATION_COVERAGE_RULES.minimumAnnotations} nhãn`;
  if (key === "phaseCoverage") return `Mỗi pha ≥ ${CALIBRATION_COVERAGE_RULES.minimumPerPhase}`;
  if (key === "enoughCycles") return `≥ ${CALIBRATION_COVERAGE_RULES.minimumCompleteCycles} chu kỳ`;
  if (key === "temporalCoverage") return `Phủ ≥ ${Math.round(CALIBRATION_COVERAGE_RULES.minimumTemporalCoverage * 100)}% thời gian`;
  if (key === "balancedPhases") return "Phân bố pha không lệch";
  if (key === "viewSelected") return "Đã khai báo góc quay";
  return key;
}

export default function ThresholdAdvisorPanel({ frames, labelsByTime, view }: { frames: PhaseFrame[]; labelsByTime: Record<string, ScoredPhase>; view: string }) {
  const advisor = adviseThresholds(frames, labelsByTime, PHASE_THRESHOLDS) as Advisor;
  const derivedCycles = Number((analyzePhaseSequence(frames) as { completeCycles?: number }).completeCycles ?? 0);
  const coverage = assessCalibrationCoverage(frames, labelsByTime, { completeCycles: derivedCycles, view }) as Coverage;
  const gain = Math.round((advisor.preview.accuracy - advisor.baseline.accuracy) * 100);
  const trustedForClip = advisor.ready && coverage.readyForThresholdReview;
  const selectedViewLabel = CALIBRATION_VIEWS.find((item: { value: string; label: string }) => item.value === view)?.label ?? "Chưa chọn góc quay";

  return (
    <section data-threshold-advisor-local-only data-calibration-coverage-gate style={{ marginTop: 10, border: "1px solid #d9e6dd", borderRadius: 11, background: "#f8fcf8", padding: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <strong style={{ fontSize: 12 }}>Threshold Advisor · mô phỏng local</strong>
          <p style={{ margin: "4px 0 0", fontSize: 10, color: "#60766a", lineHeight: 1.45 }}>Chỉ đề xuất thay đổi ngưỡng từ Ground Truth. Không tự sửa engine, không lưu và không gửi lên máy chủ.</p>
        </div>
        <span style={{ borderRadius: 999, background: trustedForClip ? "#e8f5ec" : "#f3f0e7", padding: "5px 8px", fontSize: 10, fontWeight: 800, color: trustedForClip ? "#336b48" : "#75663f" }}>
          {trustedForClip ? "Coverage đạt cho clip" : "Coverage chưa đạt"}
        </span>
      </div>

      <div style={{ marginTop: 10, border: "1px solid #e4e9dd", borderRadius: 10, background: "#fff", padding: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <b style={{ display: "block", fontSize: 11 }}>Calibration Coverage Gate</b>
            <span style={{ display: "block", marginTop: 2, fontSize: 9, color: "#71847a" }}>Độ phủ hiện tại {coverage.coverageScore}% · chỉ đánh giá phạm vi một clip.</span>
          </div>
          <span aria-label="Góc quay clip calibration" style={{ border: "1px solid #cadbdd", borderRadius: 8, padding: "6px 8px", background: "#f8fbfb", fontSize: 10 }}>{selectedViewLabel}</span>
        </div>

        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(92px,1fr))", gap: 5 }}>
          {SCORED_PHASES.map((phase) => <div key={phase} style={{ border: "1px solid #edf0ea", borderRadius: 8, padding: 7, background: coverage.counts[phase] >= CALIBRATION_COVERAGE_RULES.minimumPerPhase ? "#f6fbf7" : "#fff9f1" }}><span style={{ display: "block", fontSize: 8, color: "#71847a" }}>{PHASE_LABEL[phase]}</span><b style={{ fontSize: 11 }}>{coverage.counts[phase]}</b><span style={{ marginLeft: 3, fontSize: 8, color: "#829188" }}>/ {CALIBRATION_COVERAGE_RULES.minimumPerPhase}+</span></div>)}
        </div>

        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 5 }}>
          {Object.entries(coverage.checks).map(([key, passed]) => <div key={key} style={{ borderRadius: 8, padding: "6px 7px", background: passed ? "#eef8f1" : "#fff5e9", color: passed ? "#426b50" : "#755d37", fontSize: 9, fontWeight: 700 }}>{passed ? "Đạt · " : "Thiếu · "}{checkLabel(key)}</div>)}
        </div>

        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 5, fontSize: 9, color: "#65786d" }}>
          <span>Ground Truth: <b>{coverage.annotated}</b></span>
          <span>Chu kỳ: <b>{coverage.completeCycles}</b></span>
          <span>Phủ thời gian: <b>{Math.round(coverage.temporalCoverage * 100)}%</b></span>
          <span>Pha lớn nhất: <b>{Math.round(coverage.dominantShare * 100)}%</b></span>
        </div>

        {coverage.issues.length ? <ul style={{ margin: "8px 0 0", paddingLeft: 17, fontSize: 9, lineHeight: 1.45, color: "#755d37" }}>{coverage.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
        <p style={{ margin: "8px 0 0", fontSize: 9, color: coverage.readyForThresholdReview ? "#426b50" : "#755d37", lineHeight: 1.45 }}><b>{coverage.readyForThresholdReview ? "Đủ coverage cho clip: " : "Chưa đủ coverage: "}</b>{coverage.note}</p>
        <p style={{ margin: "4px 0 0", fontSize: 9, color: "#7b8580", lineHeight: 1.4 }}>Ngưỡng chung toàn hệ thống vẫn bị khóa: một clip/góc quay không đủ đại diện cho nhiều người bơi và điều kiện quay khác nhau.</p>
      </div>

      {!advisor.ready ? <p style={{ margin: "9px 0 0", fontSize: 11, color: "#695f45" }}>{advisor.reason}</p> : <>
        {!coverage.readyForThresholdReview ? <div style={{ marginTop: 9, borderRadius: 9, background: "#fff4e8", color: "#72502b", padding: "8px 9px", fontSize: 10, lineHeight: 1.45 }}><b>Chỉ xem tham khảo.</b> Advisor đã đủ số nhãn tối thiểu để mô phỏng, nhưng Coverage Gate chưa đạt nên chưa coi các đề xuất dưới đây là đáng tin để hiệu chỉnh.</div> : null}

        <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 7 }}>
          <div style={{ background: "#fff", borderRadius: 9, padding: 9 }}><span style={{ display: "block", fontSize: 9, color: "#71847a" }}>Độ khớp hiện tại</span><b>{Math.round(advisor.baseline.accuracy * 100)}%</b></div>
          <div style={{ background: "#fff", borderRadius: 9, padding: 9 }}><span style={{ display: "block", fontSize: 9, color: "#71847a" }}>Mô phỏng đề xuất</span><b>{Math.round(advisor.preview.accuracy * 100)}%</b></div>
          <div style={{ background: "#fff", borderRadius: 9, padding: 9 }}><span style={{ display: "block", fontSize: 9, color: "#71847a" }}>Chênh lệch</span><b>{gain > 0 ? "+" : ""}{gain} điểm %</b></div>
          <div style={{ background: "#fff", borderRadius: 9, padding: 9 }}><span style={{ display: "block", fontSize: 9, color: "#71847a" }}>Đề xuất ngưỡng</span><b>{advisor.recommendations.length}</b></div>
        </div>

        {advisor.recommendations.length ? <div style={{ marginTop: 9, display: "grid", gap: 6 }}>
          {advisor.recommendations.slice(0, 6).map((item) => <div key={item.key} style={{ border: "1px solid #e0ebe3", borderRadius: 9, background: "#fff", padding: "8px 9px", display: "grid", gridTemplateColumns: "minmax(180px,1fr) auto", gap: 8, alignItems: "center" }}>
            <div>
              <b style={{ display: "block", fontSize: 10 }}>{item.label}</b>
              <span style={{ display: "block", marginTop: 2, fontSize: 9, color: "#71847a" }}>Hỗ trợ: {item.support} nhãn · cải thiện riêng +{Math.round(item.gain * 100)} điểm %</span>
            </div>
            <div style={{ textAlign: "right", whiteSpace: "nowrap" }}><span style={{ fontSize: 10 }}>{valueLabel(item.current)}</span><b style={{ margin: "0 5px" }}>→</b><strong style={{ fontSize: 12 }}>{valueLabel(item.suggested)}</strong></div>
          </div>)}
        </div> : <p style={{ margin: "9px 0 0", fontSize: 11, color: "#536b5c" }}>{advisor.reason}</p>}

        <p style={{ margin: "9px 0 0", fontSize: 9, color: "#71847a", lineHeight: 1.45 }}>Mô phỏng kết hợp chỉ để so sánh trong phiên hiện tại. Cần kiểm thử trên nhiều video/góc quay trước khi cân nhắc thay đổi `PHASE_THRESHOLDS` trong mã nguồn.</p>
      </>}
    </section>
  );
}
