"use client";

import { SharedCameraProfileControl, SharedCameraProfileStatus, useCameraProfile } from "./camera-profile-session";
import { assessBilateralSymmetry } from "./phase-bilateral-symmetry.mjs";

type StrokePhase = "pull" | "breath" | "leg-recovery" | "kick" | "glide" | "unclear";
type PhaseFrame = {
  time: number;
  phase: StrokePhase;
  leftArmFlexion: number;
  rightArmFlexion: number;
  leftKneeFlexion: number;
  rightKneeFlexion: number;
  leftVisibility: number;
  rightVisibility: number;
};
type Cycle = { index: number; start: number; end: number };
type Assessment = {
  index: number;
  status: "balanced" | "review" | "weak" | "uncertain";
  evidenceConfidence: number;
  viewReliability: number;
  bilateralVisibility: number;
  armAverageDeg: number;
  armPeakDeg: number;
  kneeAverageDeg: number;
  kneePeakDeg: number;
  kickTimingLagSec: number | null;
  kickStrengthDelta: number;
  worstTime: number;
  issues: string[];
};

function statusLabel(status: Assessment["status"]) {
  if (status === "balanced") return "Cân bằng";
  if (status === "review") return "Cần xem";
  if (status === "weak") return "Lệch rõ";
  return "Chưa đủ tin cậy";
}

export default function BilateralSymmetryPanel({ frames, cycles, onJump }: { frames: PhaseFrame[]; cycles: Cycle[]; onJump: (time: number) => void }) {
  const view = useCameraProfile();
  const report = assessBilateralSymmetry(frames, cycles, view) as { ready: boolean; trustedCycles: number; note: string; cycles: Assessment[] };

  return (
    <section data-bilateral-symmetry-local-only data-shared-camera-profile-consumer style={{ border: "1px solid #d8e4ec", borderRadius: 14, background: "#f8fbff", padding: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <strong style={{ fontSize: 13 }}>Đối xứng trái–phải · thử nghiệm</strong>
          <p style={{ margin: "4px 0 0", fontSize: 10, lineHeight: 1.45, color: "#617783" }}>Tách riêng hai bên tay/gối và nhịp đạp. Không thay đổi qualityScore hay điểm chính.</p>
          <div style={{ marginTop: 5 }}><SharedCameraProfileStatus /></div>
        </div>
        <SharedCameraProfileControl compact />
      </div>

      {!report.ready ? <p style={{ margin: "9px 0 0", fontSize: 10, color: "#7a6647" }}>Chọn góc quay chung ở trên để đánh giá đối xứng. Góc từ sau là bằng chứng mạnh nhất; góc ngang chỉ tham khảo.</p> : <>
        <div style={{ marginTop: 9, display: "flex", gap: 8, flexWrap: "wrap", fontSize: 9, color: "#5f7380" }}>
          <span>Chu kỳ đủ tin cậy: <b>{report.trustedCycles}/{report.cycles.length}</b></span>
          <span>{report.note}</span>
        </div>
        <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 8 }}>
          {report.cycles.map((cycle) => <article key={cycle.index} style={{ border: "1px solid #dce7ed", borderRadius: 11, background: "#fff", padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div><b style={{ fontSize: 11 }}>Chu kỳ {cycle.index}</b><span style={{ display: "block", marginTop: 2, fontSize: 8, color: "#758792" }}>Evidence {cycle.evidenceConfidence}% · visibility hai bên {cycle.bilateralVisibility}%</span></div>
              <strong style={{ fontSize: 11 }}>{statusLabel(cycle.status)}</strong>
            </div>

            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 5 }}>
              <div style={{ borderRadius: 8, background: "#f7fafb", padding: 7 }}><span style={{ display: "block", fontSize: 8, color: "#72848d" }}>Lệch tay TB / đỉnh</span><b style={{ fontSize: 10 }}>{cycle.armAverageDeg}° / {cycle.armPeakDeg}°</b></div>
              <div style={{ borderRadius: 8, background: "#f7fafb", padding: 7 }}><span style={{ display: "block", fontSize: 8, color: "#72848d" }}>Lệch gối TB / đỉnh</span><b style={{ fontSize: 10 }}>{cycle.kneeAverageDeg}° / {cycle.kneePeakDeg}°</b></div>
              <div style={{ borderRadius: 8, background: "#f7fafb", padding: 7 }}><span style={{ display: "block", fontSize: 8, color: "#72848d" }}>Lệch thời điểm đạp</span><b style={{ fontSize: 10 }}>{cycle.kickTimingLagSec === null ? "—" : `${cycle.kickTimingLagSec.toFixed(1)}s`}</b></div>
              <div style={{ borderRadius: 8, background: "#f7fafb", padding: 7 }}><span style={{ display: "block", fontSize: 8, color: "#72848d" }}>Lệch biên độ đạp</span><b style={{ fontSize: 10 }}>{cycle.kickStrengthDelta}°/mẫu</b></div>
            </div>

            <button type="button" onClick={() => onJump(cycle.worstTime)} style={{ marginTop: 8, width: "100%", border: "1px solid #cedde4", borderRadius: 8, background: "#fff", padding: "7px 8px", cursor: "pointer", textAlign: "left", color: "#426774", fontSize: 9, fontWeight: 800 }}>Xem mốc bất đối xứng lớn nhất · {cycle.worstTime.toFixed(1)}s</button>
            {cycle.issues.length ? <ul style={{ margin: "7px 0 0", paddingLeft: 16, fontSize: 9, lineHeight: 1.4, color: cycle.status === "uncertain" ? "#78694d" : "#705044" }}>{cycle.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p style={{ margin: "7px 0 0", fontSize: 9, color: "#4f7362" }}>Chưa thấy bất đối xứng vượt ngưỡng thử nghiệm ở chu kỳ này.</p>}
          </article>)}
        </div>
      </>}
    </section>
  );
}
