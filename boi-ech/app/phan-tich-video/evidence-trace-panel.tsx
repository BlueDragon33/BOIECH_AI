"use client";

import { useEffect } from "react";
import { useCameraProfile } from "./camera-profile-session";
import { buildEvidenceTrace, EVIDENCE_KIND, evidenceTraceSignature, parseEvidenceTime } from "./evidence-trace-core.mjs";
import styles from "./video-analyzer.module.css";

type TrustLevel = "high" | "caution" | "reference" | "unknown";
type GateStatus = "good" | "strong" | "review" | "retry" | "poor" | "unselected" | "unknown";
type Trace = {
  kind: string;
  title: string;
  timeSec: number | null;
  facts: Array<{ label: string; value: string }>;
  gates: Array<{ name: string; status: string; label: string; detail?: string }>;
  conclusion: string;
};

function text(node?: Element | null) {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function originalText(node?: HTMLElement | null) {
  return node?.dataset.trustOriginalText || text(node);
}

function numberFrom(textValue: string, pattern: RegExp) {
  const match = pattern.exec(textValue);
  return match ? Number(match[1]) : null;
}

function currentTrust(root: HTMLElement): TrustLevel {
  const value = root.dataset.unifiedTrustLevel;
  return value === "high" || value === "caution" || value === "reference" ? value : "unknown";
}

function captureQuality(root: HTMLElement): GateStatus {
  const badge = root.querySelector<HTMLElement>(`.${styles.qualityPanel} header > b`);
  const label = originalText(badge).toLowerCase();
  if (label === "đạt") return "good";
  if (label === "xem lại") return "review";
  if (label === "chưa đạt") return "retry";
  return "unknown";
}

function viewQuality(root: HTMLElement): GateStatus {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-view-quality-gate] strong, [data-view-quality-gate-consumer] b"));
  const labels = nodes.map((node) => originalText(node).toLowerCase());
  if (labels.some((label) => label.includes("không đủ"))) return "poor";
  if (labels.some((label) => label.includes("cần kiểm tra"))) return "review";
  if (labels.some((label) => label.includes("đủ tín hiệu"))) return "strong";
  if (labels.some((label) => label.includes("chưa chọn góc"))) return "unselected";
  return "unknown";
}

function confidenceFromReport(report: HTMLElement | null) {
  const value = text(report?.querySelector(":scope > header p"));
  return numberFrom(value, /Độ tin cậy\s+(\d+)%/i);
}

function findMetric(article: HTMLElement, label: string) {
  const boxes = Array.from(article.querySelectorAll<HTMLElement>("div"));
  const box = boxes.find((node) => text(node.querySelector("span")) === label);
  return text(box?.querySelector("b"));
}

function ensureTrace(target: HTMLElement, trace: Trace, root: HTMLElement) {
  const signature = evidenceTraceSignature(trace);
  let details = target.querySelector<HTMLElement>(":scope > [data-evidence-trace]") as HTMLDetailsElement | null;
  if (details?.dataset.evidenceSignature === signature) return;

  const wasOpen = details instanceof HTMLDetailsElement ? details.open : false;
  if (!details) {
    details = document.createElement("details");
    details.dataset.evidenceTrace = "";
    target.appendChild(details);
  }
  details.dataset.evidenceSignature = signature;
  details.style.cssText = "margin-top:9px;border:1px solid #dbe6ea;border-radius:9px;background:#fbfdfe;padding:7px 8px;color:#48636f;font:600 9px/1.45 Arial,Helvetica,sans-serif";
  details.replaceChildren();

  const summary = document.createElement("summary");
  summary.textContent = trace.title;
  summary.style.cssText = "cursor:pointer;font-weight:900;color:#315d69";
  details.appendChild(summary);

  const content = document.createElement("div");
  content.style.cssText = "margin-top:7px;display:grid;gap:5px";
  for (const item of trace.facts) {
    const row = document.createElement("div");
    row.textContent = `${item.label}: ${item.value}`;
    content.appendChild(row);
  }
  for (const item of trace.gates) {
    const row = document.createElement("div");
    row.textContent = `Gate · ${item.name}: ${item.label}${item.detail ? ` · ${item.detail}` : ""}`;
    content.appendChild(row);
  }
  const conclusion = document.createElement("div");
  conclusion.textContent = trace.conclusion;
  conclusion.style.cssText = "margin-top:2px;padding-top:6px;border-top:1px dashed #d6e1e5;line-height:1.5";
  content.appendChild(conclusion);

  if (trace.timeSec !== null) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `Xem bằng chứng tại ${trace.timeSec.toFixed(1)}s`;
    button.style.cssText = "justify-self:start;border:1px solid #c9dedf;border-radius:8px;padding:6px 8px;background:#f4fbfb;color:#075a64;font:800 9px Arial,Helvetica,sans-serif;cursor:pointer";
    button.addEventListener("click", () => {
      const video = root.querySelector<HTMLVideoElement>("video[playsinline]");
      if (!video || !Number.isFinite(video.duration)) return;
      video.currentTime = Math.min(Math.max(0, trace.timeSec ?? 0), Math.max(0, video.duration - 0.01));
      video.pause();
      video.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    content.appendChild(button);
  }

  details.appendChild(content);
  (details as HTMLDetailsElement).open = wasOpen;
}

function traceV1(root: HTMLElement, cameraProfile: string, trust: TrustLevel, capture: GateStatus) {
  const report = root.querySelector<HTMLElement>(`.${styles.report}`);
  if (!report) return;
  const confidence = confidenceFromReport(report);
  const errorList = report.querySelector<HTMLElement>(`.${styles.errorList}`);
  errorList?.querySelectorAll<HTMLElement>(":scope > article").forEach((article) => {
    const small = text(article.querySelector("header div small"));
    const pieces = small.split("·").map((part) => part.trim());
    const timeSec = parseEvidenceTime(pieces[0]);
    const trace = buildEvidenceTrace({
      kind: EVIDENCE_KIND.V1_ERROR,
      trustLevel: trust,
      cameraProfile,
      timeSec,
      confidence,
      observed: pieces.slice(1).join(" · "),
      expected: text(article.querySelector("footer div strong")),
      captureQuality: capture,
    }) as Trace;
    ensureTrace(article, trace, root);
  });
}

function traceCycles(root: HTMLElement, cameraProfile: string, trust: TrustLevel, view: GateStatus) {
  const panel = root.querySelector<HTMLElement>("[data-cycle-quality-local-only]");
  if (!panel) return;
  panel.querySelectorAll<HTMLElement>(":scope > div:last-child > article").forEach((article) => {
    const cycleTitle = text(article.querySelector("div strong"));
    const cycleIndex = numberFrom(cycleTitle, /Chu kỳ\s+(\d+)/i);
    const rangeButton = Array.from(article.querySelectorAll<HTMLButtonElement>("button")).find((node) => /\d+(?:\.\d+)?–\d+(?:\.\d+)?s/.test(text(node)));
    const range = text(rangeButton);
    const timeSec = parseEvidenceTime(range.match(/^(\d+(?:\.\d+)?)s?/)?.[1] ? `${range.match(/^(\d+(?:\.\d+)?)s?/)?.[1]}s` : "");
    const percentageValues = Array.from(article.querySelectorAll<HTMLElement>("b")).map(text).filter((value) => /^\d+%$/.test(value));
    const qualityScore = percentageValues.length ? Number(percentageValues[0].replace("%", "")) : null;
    const statText = Array.from(article.querySelectorAll<HTMLElement>("span")).map(text);
    const visibility = numberFrom(statText.find((value) => value.startsWith("Pose ")) ?? "", /Pose\s+(\d+)%/i);
    const recognized = numberFrom(statText.find((value) => value.startsWith("Nhận pha ")) ?? "", /Nhận pha\s+(\d+)%/i);
    const overlap = numberFrom(statText.find((value) => value.startsWith("Chồng pha ")) ?? "", /Chồng pha\s+(\d+)%/i);
    const weakButton = Array.from(article.querySelectorAll<HTMLButtonElement>("button")).find((node) => /Pha (?:yếu nhất|nên xem lại)/i.test(text(node)));
    const weakestPhase = text(weakButton?.querySelector("b"));
    const trace = buildEvidenceTrace({
      kind: EVIDENCE_KIND.CYCLE,
      trustLevel: trust,
      cameraProfile,
      timeSec,
      range: range.split("·")[0]?.trim(),
      cycleIndex,
      qualityScore,
      visibility,
      recognized,
      overlap,
      weakestPhase,
      viewQuality: view,
    }) as Trace;
    ensureTrace(article, trace, root);
  });
}

function traceBilateral(root: HTMLElement, cameraProfile: string, trust: TrustLevel, view: GateStatus) {
  const panel = root.querySelector<HTMLElement>("[data-bilateral-symmetry-local-only]");
  if (!panel) return;
  panel.querySelectorAll<HTMLElement>(":scope article").forEach((article) => {
    const cycleIndex = numberFrom(text(article.querySelector("b")), /Chu kỳ\s+(\d+)/i);
    const evidenceLine = Array.from(article.querySelectorAll<HTMLElement>("span")).map(text).find((value) => value.startsWith("Evidence ")) ?? "";
    const evidenceConfidence = numberFrom(evidenceLine, /Evidence\s+(\d+)%/i);
    const bilateralVisibility = numberFrom(evidenceLine, /visibility hai bên\s+(\d+)%/i);
    const jump = Array.from(article.querySelectorAll<HTMLButtonElement>("button")).find((node) => text(node).includes("mốc bất đối xứng"));
    const timeSec = parseEvidenceTime(text(jump));
    const trace = buildEvidenceTrace({
      kind: EVIDENCE_KIND.BILATERAL,
      trustLevel: trust,
      cameraProfile,
      timeSec,
      cycleIndex,
      evidenceConfidence,
      bilateralVisibility,
      armDelta: findMetric(article, "Lệch tay TB / đỉnh"),
      kneeDelta: findMetric(article, "Lệch gối TB / đỉnh"),
      kickTiming: findMetric(article, "Lệch thời điểm đạp"),
      viewQuality: view,
    }) as Trace;
    ensureTrace(article, trace, root);
  });
}

function traceAdvisor(root: HTMLElement, cameraProfile: string, trust: TrustLevel, view: GateStatus) {
  const panel = root.querySelector<HTMLElement>("[data-threshold-advisor-local-only]");
  if (!panel) return;
  const spans = Array.from(panel.querySelectorAll<HTMLElement>("span"));
  const coverageLine = spans.map((node) => originalText(node)).find((value) => value.includes("Độ phủ hiện tại")) ?? "";
  const coverageScore = numberFrom(coverageLine, /Độ phủ hiện tại\s+(\d+)%/i);
  const badge = spans.find((node) => ["Coverage đạt cho clip", "Coverage chưa đạt"].includes(originalText(node)));
  const advisorStatus = originalText(badge) || "Chưa có trạng thái coverage";
  const coverageReady = advisorStatus === "Coverage đạt cho clip";
  const trace = buildEvidenceTrace({
    kind: EVIDENCE_KIND.ADVISOR,
    trustLevel: trust,
    cameraProfile,
    coverageScore,
    advisorStatus,
    coverageReady,
    viewQuality: view,
  }) as Trace;
  ensureTrace(panel, trace, root);
}

function removeTraces(root: HTMLElement) {
  root.querySelectorAll("[data-evidence-trace]").forEach((node) => node.remove());
  delete root.dataset.evidenceTraceability;
}

export default function EvidenceTracePanel() {
  const cameraProfile = useCameraProfile();

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-breaststroke-vision]");
    if (!root) return;
    let scheduled = 0;

    const update = () => {
      scheduled = 0;
      const trust = currentTrust(root);
      const capture = captureQuality(root);
      const view = viewQuality(root);
      root.dataset.evidenceTraceability = "local-only";
      traceV1(root, cameraProfile ?? "", trust, capture);
      traceCycles(root, cameraProfile ?? "", trust, view);
      traceBilateral(root, cameraProfile ?? "", trust, view);
      traceAdvisor(root, cameraProfile ?? "", trust, view);
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = window.setTimeout(update, 0);
    };

    schedule();
    const observer = new MutationObserver((mutations) => {
      if (mutations.every((mutation) => mutation.target instanceof Element && mutation.target.closest("[data-evidence-trace]"))) return;
      schedule();
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-unified-trust-level"] });
    return () => {
      if (scheduled) window.clearTimeout(scheduled);
      observer.disconnect();
      removeTraces(root);
    };
  }, [cameraProfile]);

  return null;
}
