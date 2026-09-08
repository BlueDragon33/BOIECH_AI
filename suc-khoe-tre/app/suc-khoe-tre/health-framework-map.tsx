"use client";

import { useMemo, useState } from "react";
import { HEALTH_AGE_STAGES, type HealthAgeStageId } from "./health-age-scope";
import { HEALTH_DOMAINS, HEALTH_FRAMEWORK_COUNTS, healthDomainsForStage, type HealthNavArea, type HealthPrivacyLevel } from "./health-domain-catalog";
import "./health-framework-map.css";

const privacyLabels: Record<HealthPrivacyLevel, string> = {
  standard: "Thông thường",
  sensitive: "Nhạy cảm",
  "highly-sensitive": "Rất nhạy cảm",
};

const navLabels: Record<HealthNavArea, string> = {
  today: "Hôm nay",
  growth: "Tăng trưởng",
  nutrition: "Dinh dưỡng",
  activity: "Vận động",
  care: "Chăm sóc",
  journal: "Nhật ký",
  profile: "Hồ sơ",
};

const baselineDomainIds = new Set([
  "growth-development",
  "nutrition-hydration",
  "physical-activity",
  "sleep-recovery",
  "oral-skin-hygiene",
  "eyes-hearing-school",
  "symptoms-illness-first-aid",
  "records-appointments-documents",
]);

export default function HealthFrameworkMap() {
  const [stage, setStage] = useState<HealthAgeStageId | "all">("all");
  const visible = useMemo(() => stage === "all" ? HEALTH_DOMAINS : healthDomainsForStage(stage), [stage]);

  return <details className="hfm-shell">
    <summary>
      <div>
        <span className="hfm-kicker">Bản đồ bộ khung 9–18 tuổi</span>
        <strong>{HEALTH_FRAMEWORK_COUNTS.domains} miền sức khỏe · {HEALTH_FRAMEWORK_COUNTS.stages} giai đoạn · {HEALTH_FRAMEWORK_COUNTS.navAreas} khu vực chính</strong>
        <small>Mở để xem toàn bộ phạm vi đã khóa trước khi triển khai sâu.</small>
      </div>
      <span className="hfm-open">Xem khung</span>
    </summary>

    <div className="hfm-body">
      <section className="hfm-stage-bar" aria-label="Lọc theo giai đoạn tuổi">
        <button type="button" className={stage === "all" ? "is-active" : ""} onClick={() => setStage("all")}>Toàn bộ 9–18</button>
        {HEALTH_AGE_STAGES.map((item) => <button key={item.id} type="button" className={stage === item.id ? "is-active" : ""} onClick={() => setStage(item.id)}>{item.shortLabel}</button>)}
      </section>

      <div className="hfm-stage-roadmap">
        {HEALTH_AGE_STAGES.map((item, index) => <article key={item.id}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{item.label}</strong>
          <small>{item.focus.join(" · ")}</small>
        </article>)}
      </div>

      <div className="hfm-legend"><span><i className="is-baseline" /> Có nền vận hành</span><span><i className="is-framework" /> Đã khóa khung, làm sâu sau</span></div>

      <section className="hfm-grid" aria-label="Các miền chức năng Sức khỏe Y tế">
        {visible.map((domain) => {
          const hasBaseline = baselineDomainIds.has(domain.id);
          return <article className="hfm-card" key={domain.id}>
            <div className="hfm-card-head"><span>{navLabels[domain.navArea]}</span><b className={`privacy-${domain.privacy}`}>{privacyLabels[domain.privacy]}</b></div>
            <div className={hasBaseline ? "hfm-status is-baseline" : "hfm-status is-framework"}>{hasBaseline ? "Có nền" : "Khung sẵn sàng"}</div>
            <h3>{domain.title}</h3>
            <p>{domain.summary}</p>
            <div className="hfm-capabilities">{domain.capabilities.map((item) => <span key={item}>{item}</span>)}</div>
            {domain.guardrail ? <small className="hfm-guardrail">{domain.guardrail}</small> : null}
          </article>;
        })}
      </section>

      <div className="hfm-boundary">
        <strong>Ranh giới không thay đổi</strong>
        <span>Site Quản trị chỉ quản lý thiết bị, quyền, phiên, policy, audit và quy trình duyệt. Hồ sơ sức khỏe, nhật ký, thuốc, dậy thì, tâm lý và tài liệu y tế không mặc định được gửi về Trung tâm.</span>
      </div>
    </div>
  </details>;
}
