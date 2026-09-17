"use client";

import { useEffect, useRef, useState } from "react";
import {
  assessCrossModuleConsistency,
  CONSISTENCY_DOMAIN,
  CONSISTENCY_SIGNAL,
  CONSISTENCY_STATUS,
} from "./cross-module-consistency-core.mjs";
import styles from "./video-analyzer.module.css";

type Signal = "positive" | "negative" | "unknown";
type Finding = { domain: string; module: string; signal: Signal; eligible?: boolean; detail?: string };
type DomainReport = {
  domain: string;
  label: string;
  status: string;
  statusLabel: string;
  sources: Array<{ module: string; signal: Signal; detail: string }>;
  conclusion: string;
};
type ConsistencyReport = {
  status: string;
  statusLabel: string;
  domains: DomainReport[];
  note: string;
};
type Snapshot = { report: ConsistencyReport; unpaired: string[]; trust: string; available: boolean };

const MODULE_LABEL: Record<string, string> = {
  v1: "AI v1",
  bilateral: "Đối xứng trái–phải",
  phase: "Engine 5 pha",
};

function text(node?: Element | null) {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function originalText(node?: HTMLElement | null) {
  return node?.dataset.trustOriginalText || text(node);
}

function numberFrom(value: string, pattern: RegExp) {
  const match = pattern.exec(value);
  return match ? Number(match[1]) : null;
}

function metricBox(article: HTMLElement, label: string) {
  return Array.from(article.querySelectorAll<HTMLElement>("div"))
    .find((node) => text(node.querySelector("span")) === label);
}

function degreePair(value: string) {
  const numbers = [...value.matchAll(/(\d+(?:\.\d+)?)°/g)].map((match) => Number(match[1]));
  return { average: numbers[0] ?? null, peak: numbers[1] ?? null };
}

function v1Findings(root: HTMLElement) {
  const report = root.querySelector<HTMLElement>(`.${styles.report}`);
  if (!report) return { findings: [] as Finding[], unpaired: [] as string[], available: false };
  const captureBadge = root.querySelector<HTMLElement>(`.${styles.qualityPanel} header > b`);
  const capture = originalText(captureBadge);
  const eligible = capture !== "Chưa đạt";
  const articles = Array.from(report.querySelectorAll<HTMLElement>(`.${styles.errorList} > article`));
  const titles = articles.map((article) => originalText(article.querySelector<HTMLElement>("header div strong")));

  const signalFor = (title: string): Signal => titles.includes(title)
    ? CONSISTENCY_SIGNAL.POSITIVE
    : eligible ? CONSISTENCY_SIGNAL.NEGATIVE : CONSISTENCY_SIGNAL.UNKNOWN;
  const detailFor = (title: string, clear: string) => {
    const index = titles.indexOf(title);
    if (index < 0) return eligible ? clear : `Capture Quality: ${capture || "chưa có dữ liệu"}.`;
    const observed = text(articles[index].querySelector("header div small"));
    return observed || title;
  };

  const findings: Finding[] = [
    {
      domain: CONSISTENCY_DOMAIN.ARM_SYMMETRY,
      module: "v1",
      signal: signalFor("Hai tay thu/duỗi thiếu đối xứng"),
      eligible,
      detail: detailFor("Hai tay thu/duỗi thiếu đối xứng", "AI v1 không phát hiện bất đối xứng tay vượt ngưỡng hiện tại."),
    },
    {
      domain: CONSISTENCY_DOMAIN.LEG_SYMMETRY,
      module: "v1",
      signal: signalFor("Hai chân gập không đồng đều"),
      eligible,
      detail: detailFor("Hai chân gập không đồng đều", "AI v1 không phát hiện chênh góc hai chân vượt ngưỡng hiện tại."),
    },
    {
      domain: CONSISTENCY_DOMAIN.COORDINATION,
      module: "v1",
      signal: signalFor("Tay và chân có dấu hiệu chồng pha"),
      eligible,
      detail: detailFor("Tay và chân có dấu hiệu chồng pha", "AI v1 không phát hiện tỷ lệ chồng pha vượt ngưỡng hiện tại."),
    },
  ];

  const unpaired: string[] = [];
  if (titles.includes("Hai gối mở rộng kéo dài khi thu chân")) unpaired.push("Mở gối rộng: hiện chỉ AI v1 đo trực tiếp, chưa có detector độc lập tương đương để xác nhận chéo.");
  if (titles.includes("Trục vai–hông thay đổi lớn")) unpaired.push("Trục thân nghiêng: hiện chỉ AI v1 đo trực tiếp, chưa có detector độc lập tương đương để xác nhận chéo.");
  return { findings, unpaired, available: true };
}

function bilateralFindings(root: HTMLElement) {
  const panel = root.querySelector<HTMLElement>("[data-bilateral-symmetry-local-only]");
  if (!panel) return { findings: [] as Finding[], available: false };
  const qualityLabels = Array.from(panel.querySelectorAll<HTMLElement>("[data-view-quality-gate] strong"))
    .map((node) => originalText(node));
  const viewStrong = qualityLabels.some((label) => label.startsWith("Đủ tín hiệu"));
  const cards = Array.from(panel.querySelectorAll<HTMLElement>(":scope article"));

  const trusted = cards.map((article) => {
    const evidenceLine = Array.from(article.querySelectorAll<HTMLElement>("span")).map(text).find((value) => value.startsWith("Evidence ")) ?? "";
    const evidence = numberFrom(evidenceLine, /Evidence\s+(\d+)%/i) ?? 0;
    const arm = degreePair(text(metricBox(article, "Lệch tay TB / đỉnh")?.querySelector("b")));
    const knee = degreePair(text(metricBox(article, "Lệch gối TB / đỉnh")?.querySelector("b")));
    const timingText = text(metricBox(article, "Lệch thời điểm đạp")?.querySelector("b"));
    const strengthText = text(metricBox(article, "Lệch biên độ đạp")?.querySelector("b"));
    return {
      evidence,
      arm,
      knee,
      timing: numberFrom(timingText, /(\d+(?:\.\d+)?)s/i),
      strength: numberFrom(strengthText, /(\d+(?:\.\d+)?)°/i),
    };
  }).filter((item) => viewStrong && item.evidence >= 70);

  const max = (values: Array<number | null>) => {
    const safe = values.filter((value): value is number => value !== null && Number.isFinite(value));
    return safe.length ? Math.max(...safe) : 0;
  };
  const armAvg = max(trusted.map((item) => item.arm.average));
  const armPeak = max(trusted.map((item) => item.arm.peak));
  const kneeAvg = max(trusted.map((item) => item.knee.average));
  const kneePeak = max(trusted.map((item) => item.knee.peak));
  const timing = max(trusted.map((item) => item.timing));
  const strength = max(trusted.map((item) => item.strength));
  const armPositive = armAvg >= 10 || armPeak >= 20;
  const legPositive = kneeAvg >= 10 || kneePeak >= 20 || timing >= 0.2 || strength >= 8;
  const usable = trusted.length > 0;

  const findings: Finding[] = [
    {
      domain: CONSISTENCY_DOMAIN.ARM_SYMMETRY,
      module: "bilateral",
      signal: usable ? (armPositive ? CONSISTENCY_SIGNAL.POSITIVE : CONSISTENCY_SIGNAL.NEGATIVE) : CONSISTENCY_SIGNAL.UNKNOWN,
      eligible: usable,
      detail: usable ? `Chu kỳ đủ evidence: ${trusted.length}; lệch tay lớn nhất TB ${armAvg.toFixed(1)}° / đỉnh ${armPeak.toFixed(1)}°.` : "Chưa có chu kỳ bilateral đủ View Quality + evidence ≥70%.",
    },
    {
      domain: CONSISTENCY_DOMAIN.LEG_SYMMETRY,
      module: "bilateral",
      signal: usable ? (legPositive ? CONSISTENCY_SIGNAL.POSITIVE : CONSISTENCY_SIGNAL.NEGATIVE) : CONSISTENCY_SIGNAL.UNKNOWN,
      eligible: usable,
      detail: usable ? `Chu kỳ đủ evidence: ${trusted.length}; gối TB ${kneeAvg.toFixed(1)}° / đỉnh ${kneePeak.toFixed(1)}°, lệch nhịp đạp ${timing.toFixed(1)}s.` : "Chưa có chu kỳ bilateral đủ View Quality + evidence ≥70%.",
    },
  ];
  return { findings, available: true };
}

function phaseFindings(root: HTMLElement) {
  const panel = root.querySelector<HTMLElement>("[data-cycle-quality-local-only]");
  if (!panel) return { findings: [] as Finding[], available: false };
  const cards = Array.from(panel.querySelectorAll<HTMLElement>(":scope > div:last-child > article"));
  const usable = cards.map((article) => {
    const spans = Array.from(article.querySelectorAll<HTMLElement>("span")).map(text);
    const pose = numberFrom(spans.find((value) => value.startsWith("Pose ")) ?? "", /Pose\s+(\d+)%/i);
    const recognized = numberFrom(spans.find((value) => value.startsWith("Nhận pha ")) ?? "", /Nhận pha\s+(\d+)%/i);
    const overlap = numberFrom(spans.find((value) => value.startsWith("Chồng pha ")) ?? "", /Chồng pha\s+(\d+)%/i);
    return { pose, recognized, overlap };
  }).filter((item) => (item.pose ?? 0) >= 70 && (item.recognized ?? 0) >= 85 && item.overlap !== null);
  const maxOverlap = usable.length ? Math.max(...usable.map((item) => item.overlap ?? 0)) : 0;
  const findings: Finding[] = [{
    domain: CONSISTENCY_DOMAIN.COORDINATION,
    module: "phase",
    signal: usable.length ? (maxOverlap > 18 ? CONSISTENCY_SIGNAL.POSITIVE : CONSISTENCY_SIGNAL.NEGATIVE) : CONSISTENCY_SIGNAL.UNKNOWN,
    eligible: usable.length > 0,
    detail: usable.length ? `${usable.length} chu kỳ đủ pose/nhận pha; chồng pha lớn nhất ${maxOverlap}%.` : "Chưa có chu kỳ 5 pha đủ pose ≥70% và nhận dạng pha ≥85% để đối chiếu phối hợp.",
  }];
  return { findings, available: true };
}

function buildSnapshot(root: HTMLElement): Snapshot {
  const v1 = v1Findings(root);
  const bilateral = bilateralFindings(root);
  const phase = phaseFindings(root);
  const findings = [...v1.findings, ...bilateral.findings, ...phase.findings];
  const report = assessCrossModuleConsistency(findings) as ConsistencyReport;
  return {
    report,
    unpaired: v1.unpaired,
    trust: root.dataset.unifiedTrustLevel ?? "unknown",
    available: v1.available || bilateral.available || phase.available,
  };
}

function statusStyle(status: string) {
  if (status === CONSISTENCY_STATUS.CORROBORATED) return { border: "#b9d8c3", background: "#f4fbf6", color: "#355f42" };
  if (status === CONSISTENCY_STATUS.CONFLICT) return { border: "#e3b7a8", background: "#fff6f2", color: "#7a4432" };
  if (status === CONSISTENCY_STATUS.SINGLE_SOURCE) return { border: "#e1cf9e", background: "#fffaf0", color: "#705c2e" };
  return { border: "#d9e4e8", background: "#f8fbfc", color: "#536b75" };
}

function signalLabel(signal: Signal) {
  if (signal === CONSISTENCY_SIGNAL.POSITIVE) return "Có tín hiệu";
  if (signal === CONSISTENCY_SIGNAL.NEGATIVE) return "Chưa thấy tín hiệu";
  return "Chưa đủ dữ liệu";
}

export default function CrossModuleConsistencyPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const signatureRef = useRef("");

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-breaststroke-vision]");
    if (!root) return;
    let timer = 0;

    const update = () => {
      timer = 0;
      const next = buildSnapshot(root);
      const signature = JSON.stringify(next);
      if (signature === signatureRef.current) return;
      signatureRef.current = signature;
      setSnapshot(next);
    };
    const schedule = () => {
      if (timer) return;
      timer = window.setTimeout(update, 0);
    };

    schedule();
    const observer = new MutationObserver((mutations) => {
      if (mutations.every((mutation) => mutation.target instanceof Element && mutation.target.closest("[data-cross-module-consistency]"))) return;
      schedule();
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-unified-trust-level"] });
    return () => {
      if (timer) window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  if (!snapshot?.available) return null;
  const overall = statusStyle(snapshot.report.status);

  return (
    <section data-cross-module-consistency="local-only" data-cross-module-non-scoring style={{ maxWidth: 1240, margin: "0 auto 26px", padding: "0 28px", fontFamily: "Arial, Helvetica, sans-serif", color: "#163346" }}>
      <div style={{ border: `1px solid ${overall.border}`, borderRadius: 18, background: overall.background, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: ".05em", color: overall.color }}>ĐỐI CHIẾU CHÉO BẰNG CHỨNG · LOCAL-ONLY</span>
            <h3 style={{ margin: "5px 0 5px", fontSize: 17 }}>AI v1 ↔ 5 pha ↔ đối xứng trái–phải</h3>
            <p style={{ margin: 0, maxWidth: 820, fontSize: 11, lineHeight: 1.5, color: "#5b727c" }}>{snapshot.report.note}</p>
          </div>
          <strong style={{ border: `1px solid ${overall.border}`, borderRadius: 999, background: "#fff", padding: "6px 9px", fontSize: 10, color: overall.color }}>{snapshot.report.statusLabel}</strong>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 9, marginTop: 12 }}>
          {snapshot.report.domains.map((domain) => {
            const style = statusStyle(domain.status);
            return <article key={domain.domain} data-consistency-domain={domain.domain} data-consistency-status={domain.status} style={{ border: `1px solid ${style.border}`, borderRadius: 12, background: "#fff", padding: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <b style={{ fontSize: 11 }}>{domain.label}</b>
                <span style={{ fontSize: 9, fontWeight: 900, color: style.color }}>{domain.statusLabel}</span>
              </div>
              <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
                {domain.sources.map((source) => <div key={source.module} style={{ borderRadius: 8, background: "#f7fafb", padding: "6px 7px", fontSize: 9, lineHeight: 1.4 }}>
                  <strong>{MODULE_LABEL[source.module] ?? source.module}: {signalLabel(source.signal)}</strong>
                  {source.detail ? <span style={{ display: "block", marginTop: 2, color: "#687c84" }}>{source.detail}</span> : null}
                </div>)}
              </div>
              <p style={{ margin: "7px 0 0", fontSize: 9, lineHeight: 1.45, color: style.color }}>{domain.conclusion}</p>
            </article>;
          })}
        </div>

        {snapshot.unpaired.length ? <div style={{ marginTop: 10, borderTop: "1px dashed #d7e2e5", paddingTop: 9 }}>
          <b style={{ fontSize: 10 }}>Tín hiệu chưa có detector độc lập tương đương</b>
          <ul style={{ margin: "5px 0 0", paddingLeft: 17, fontSize: 9, lineHeight: 1.5, color: "#657981" }}>{snapshot.unpaired.map((item) => <li key={item}>{item}</li>)}</ul>
        </div> : null}
        <p style={{ margin: "9px 0 0", fontSize: 9, color: "#6a7c83" }}>Unified Trust hiện tại: <b>{snapshot.trust}</b>. Consistency không nâng trust và không được dùng để cộng điểm giữa các module.</p>
      </div>
    </section>
  );
}
