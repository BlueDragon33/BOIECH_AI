"use client";

import { useEffect } from "react";
import { useCameraProfile } from "./camera-profile-session";
import { assessUnifiedTrust } from "./unified-trust-core.mjs";
import styles from "./video-analyzer.module.css";

type TrustLevel = "high" | "caution" | "reference";
type TrustReport = {
  level: TrustLevel;
  label: string;
  reasons: string[];
  note: string;
};

type PreflightStatus = "unknown" | "good" | "review" | "retry";
type CaptureStatus = "unknown" | "good" | "review" | "retry";
type ViewQualityStatus = "unknown" | "strong" | "review" | "poor" | "unselected";

function normalizedText(node?: Element | null) {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function preflightStatus(root: ParentNode): PreflightStatus {
  const text = normalizedText(root.querySelector("[data-camera-guidance-local-only]"));
  if (!text) return "unknown";
  if (text.includes("nên quay lại")) return "retry";
  if (text.includes("nên chỉnh khung")) return "review";
  if (text.includes("đạt preflight")) return "good";
  return "unknown";
}

function captureStatus(root: ParentNode): CaptureStatus {
  const text = normalizedText(root.querySelector(`.${styles.qualityPanel}`));
  if (!text) return "unknown";
  if (text.includes("cần quay lại trước khi chấm điểm") || text.includes("chưa đạt")) return "retry";
  if (text.includes("cần đọc thận trọng") || text.includes("xem lại")) return "review";
  if (text.includes("video đủ chất lượng để nhận xét")) return "good";
  return "unknown";
}

function viewQualityStatus(root: ParentNode): ViewQualityStatus {
  const nodes = Array.from(root.querySelectorAll("[data-view-quality-gate], [data-view-quality-gate-consumer]"));
  if (!nodes.length) return "unknown";
  const text = nodes.map((node) => normalizedText(node)).join(" ");
  if (text.includes("không đủ")) return "poor";
  if (text.includes("cần kiểm tra")) return "review";
  if (text.includes("đủ tín hiệu")) return "strong";
  if (text.includes("chưa chọn góc")) return "unselected";
  return "unknown";
}

function overrideActive(root: ParentNode) {
  return normalizedText(root.querySelector("[data-preflight-enforcement-local-only]")).includes("đã bỏ qua preflight cho clip hiện tại");
}

function badgePalette(level: TrustLevel) {
  if (level === "high") return { border: "#9acdad", background: "#f1faf4", color: "#315f42" };
  if (level === "caution") return { border: "#dcc58b", background: "#fffaf0", color: "#735f2d" };
  return { border: "#d49b85", background: "#fff5f0", color: "#7a432f" };
}

function ensureBadge(target: HTMLElement, trust: TrustReport) {
  let badge = target.querySelector<HTMLElement>("[data-unified-trust-badge]");
  if (!badge) {
    badge = document.createElement("div");
    badge.dataset.unifiedTrustBadge = "";
    badge.setAttribute("role", "status");
    target.insertBefore(badge, target.firstChild);
  }

  const reason = trust.reasons[0] ?? trust.note;
  const signature = `${trust.level}|${trust.label}|${reason}`;
  if (badge.dataset.trustSignature === signature) return;
  badge.dataset.trustSignature = signature;
  badge.dataset.trustLevel = trust.level;

  const palette = badgePalette(trust.level);
  badge.style.cssText = `margin:0 0 10px;padding:8px 10px;border:1px solid ${palette.border};border-radius:10px;background:${palette.background};color:${palette.color};font:600 10px/1.4 Arial,Helvetica,sans-serif`;
  badge.replaceChildren();

  const label = document.createElement("strong");
  label.textContent = `Mức tin cậy chung · ${trust.label}`;
  label.style.cssText = "display:block;font-size:10px;font-weight:900";
  const detail = document.createElement("span");
  detail.textContent = reason;
  detail.style.cssText = "display:block;margin-top:2px;font-size:8px;font-weight:600";
  badge.append(label, detail);
}

function removeBadges(root: ParentNode) {
  root.querySelectorAll("[data-unified-trust-badge]").forEach((node) => node.remove());
}

function trustTargets(root: ParentNode) {
  const selectors = [
    "[data-camera-guidance-local-only]",
    `.${styles.report}`,
    "[data-cycle-quality-local-only]",
    "[data-bilateral-symmetry-local-only]",
    "[data-threshold-advisor-local-only]",
  ];
  return selectors.flatMap((selector) => Array.from(root.querySelectorAll<HTMLElement>(selector)));
}

export default function UnifiedTrustPanel() {
  const cameraProfile = useCameraProfile();

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-breaststroke-vision]");
    if (!root) return;
    let scheduled = 0;

    const update = () => {
      scheduled = 0;
      const trust = assessUnifiedTrust({
        preflight: preflightStatus(root),
        captureQuality: captureStatus(root),
        viewQuality: viewQualityStatus(root),
        cameraProfileSelected: Boolean(cameraProfile),
        overrideActive: overrideActive(root),
      }) as TrustReport;
      root.dataset.unifiedTrustLevel = trust.level;
      trustTargets(root).forEach((target) => ensureBadge(target, trust));
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = window.setTimeout(update, 0);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "src"] });
    return () => {
      if (scheduled) window.clearTimeout(scheduled);
      observer.disconnect();
      delete root.dataset.unifiedTrustLevel;
      removeBadges(root);
    };
  }, [cameraProfile]);

  return null;
}
