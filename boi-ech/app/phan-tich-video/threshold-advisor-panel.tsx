"use client";

import { PHASE_THRESHOLDS } from "./phase-cycle-core.mjs";
import { adviseThresholds } from "./phase-threshold-advisor.mjs";

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

function valueLabel(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

export default function ThresholdAdvisorPanel({ frames, labelsByTime }: { frames: PhaseFrame[]; labelsByTime: Record<string, ScoredPhase> }) {
  const advisor = adviseThresholds(frames, labelsByTime, PHASE_THRESHOLDS) as Advisor;
  const gain = Math.round((advisor.preview.accuracy - advisor.baseline.accuracy) * 100);

  return (
    <section data-threshold-advisor-local-only style={{ marginTop: 10, border: "1px solid #d9e6dd", borderRadius: 11, background: "#f8fcf8", padding: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <strong style={{ fontSize: 12 }}>Threshold Advisor · mô phỏng local</strong>
          <p style={{ margin: "4px 0 0", fontSize: 10, color: "#60766a", lineHeight: 1.45 }}>Chỉ đề xuất thay đổi ngưỡng từ Ground Truth. Không tự sửa engine, không lưu và không gửi lên máy chủ.</p>
        </div>
        <span style={{ borderRadius: 999, background: advisor.ready ? "#e8f5ec" : "#f3f0e7", padding: "5px 8px", fontSize: 10, fontWeight: 800, color: advisor.ready ? "#336b48" : "#75663f" }}>
          {advisor.baseline.annotated}/{advisor.minimumAnnotations} mốc tối thiểu
        </span>
      </div>

      {!advisor.ready ? <p style={{ margin: "9px 0 0", fontSize: 11, color: "#695f45" }}>{advisor.reason}</p> : <>
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
