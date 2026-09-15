"use client";

import { useEffect } from "react";
import {
  interpretAdvisorBadge,
  interpretAdvisorGateLabel,
  interpretBilateralStatus,
  interpretCycleStatus,
  interpretIssuePriority,
  interpretIssueTitle,
  interpretV1Summary,
  interpretWeakestPhaseLabel,
  interpretationPolicy,
} from "./trust-aware-interpretation-core.mjs";
import styles from "./video-analyzer.module.css";

type TrustLevel = "high" | "caution" | "reference";

function currentTrust(root: HTMLElement): TrustLevel {
  const value = root.dataset.unifiedTrustLevel;
  return value === "high" || value === "reference" ? value : "caution";
}

function originalText(node: HTMLElement) {
  const current = node.textContent ?? "";
  const stored = node.dataset.trustOriginalText;
  const applied = node.dataset.trustAppliedText;
  if (!stored || (applied && current !== applied && current !== stored)) {
    node.dataset.trustOriginalText = current;
    return current;
  }
  return stored;
}

function applyText(node: HTMLElement | null, transform: (original: string) => string) {
  if (!node || node.closest("[data-unified-trust-badge], [data-trust-aware-advisor-guard]")) return;
  const original = originalText(node);
  const next = transform(original);
  if (node.textContent !== next) node.textContent = next;
  node.dataset.trustAppliedText = next;
}

function applyV1(root: HTMLElement, level: TrustLevel) {
  const report = root.querySelector<HTMLElement>(`.${styles.report}`);
  if (!report) return;
  applyText(report.querySelector<HTMLElement>("header h2"), (value) => interpretV1Summary(value, level));
  report.querySelectorAll<HTMLElement>(`.${styles.errorList} article`).forEach((article) => {
    applyText(article.querySelector<HTMLElement>("header div strong"), (value) => interpretIssueTitle(value, level));
    applyText(article.querySelector<HTMLElement>("header > b"), (value) => interpretIssuePriority(value, level));
  });
}

function applyCycleLanguage(root: HTMLElement, level: TrustLevel) {
  const panel = root.querySelector<HTMLElement>("[data-cycle-quality-local-only]");
  if (!panel) return;
  panel.querySelectorAll<HTMLElement>("span").forEach((node) => {
    const visible = node.textContent ?? "";
    const original = node.dataset.trustOriginalText ?? visible;
    if (["Tốt", "Cần xem", "Yếu"].includes(original)) {
      applyText(node, (value) => interpretCycleStatus(value, level));
      return;
    }
    if (original.startsWith("Pha yếu nhất")) applyText(node, (value) => interpretWeakestPhaseLabel(value, level));
  });
}

function applyBilateralLanguage(root: HTMLElement, level: TrustLevel) {
  const panel = root.querySelector<HTMLElement>("[data-bilateral-symmetry-local-only]");
  if (!panel) return;
  panel.querySelectorAll<HTMLElement>("article strong").forEach((node) => {
    const visible = node.textContent ?? "";
    const original = node.dataset.trustOriginalText ?? visible;
    if (["Cân bằng", "Cần xem", "Lệch rõ", "Chưa đủ tin cậy"].includes(original)) {
      applyText(node, (value) => interpretBilateralStatus(value, level));
    }
  });
}

function ensureAdvisorGuard(panel: HTMLElement, level: TrustLevel) {
  let guard = panel.querySelector<HTMLElement>("[data-trust-aware-advisor-guard]");
  if (level === "high") {
    guard?.remove();
    return;
  }
  if (!guard) {
    guard = document.createElement("div");
    guard.dataset.trustAwareAdvisorGuard = "";
    guard.setAttribute("role", "status");
    const badge = panel.querySelector<HTMLElement>("[data-unified-trust-badge]");
    if (badge) badge.after(guard);
    else panel.insertBefore(guard, panel.firstChild);
  }
  const reference = level === "reference";
  const nextText = reference
    ? "Trust-Aware Gate: Threshold Advisor chỉ được xem như mô phỏng tham khảo; không trình bày đề xuất như ngưỡng đủ điều kiện xem xét."
    : "Trust-Aware Gate: mô phỏng vẫn hiển thị, nhưng ngôn ngữ hiệu chỉnh được hạ xuống mức thận trọng cho tới khi trust chung đạt cao.";
  guard.style.cssText = `margin:0 0 9px;padding:7px 9px;border:1px solid ${reference ? "#d49b85" : "#dcc58b"};border-radius:9px;background:${reference ? "#fff5f0" : "#fffaf0"};color:${reference ? "#7a432f" : "#735f2d"};font:700 9px/1.4 Arial,Helvetica,sans-serif`;
  if (guard.textContent !== nextText) guard.textContent = nextText;
}

function applyAdvisorLanguage(root: HTMLElement, level: TrustLevel) {
  const panel = root.querySelector<HTMLElement>("[data-threshold-advisor-local-only]");
  if (!panel) return;
  panel.querySelectorAll<HTMLElement>("span").forEach((node) => {
    const visible = node.textContent ?? "";
    const original = node.dataset.trustOriginalText ?? visible;
    if (original === "Coverage đạt cho clip" || original === "Coverage chưa đạt") {
      applyText(node, (value) => interpretAdvisorBadge(value, level));
    }
  });
  panel.querySelectorAll<HTMLElement>("b").forEach((node) => {
    const visible = node.textContent ?? "";
    const original = node.dataset.trustOriginalText ?? visible;
    if (original.startsWith("Đủ coverage + chất lượng góc cho clip:") || original.startsWith("Chưa đủ điều kiện hiệu chỉnh:")) {
      applyText(node, (value) => interpretAdvisorGateLabel(value, level));
    }
  });
  ensureAdvisorGuard(panel, level);
}

function restoreInterpretations(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-trust-original-text]").forEach((node) => {
    const original = node.dataset.trustOriginalText;
    if (original !== undefined && node.textContent !== original) node.textContent = original;
    delete node.dataset.trustOriginalText;
    delete node.dataset.trustAppliedText;
  });
  root.querySelectorAll("[data-trust-aware-advisor-guard]").forEach((node) => node.remove());
  delete root.dataset.trustAwareInterpretation;
}

export default function TrustAwareInterpretationPanel() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-breaststroke-vision]");
    if (!root) return;
    let scheduled = 0;

    const update = () => {
      scheduled = 0;
      const level = currentTrust(root);
      const policy = interpretationPolicy(level);
      root.dataset.trustAwareInterpretation = policy.level;
      applyV1(root, level);
      applyCycleLanguage(root, level);
      applyBilateralLanguage(root, level);
      applyAdvisorLanguage(root, level);
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = window.setTimeout(update, 0);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-unified-trust-level"],
    });
    return () => {
      if (scheduled) window.clearTimeout(scheduled);
      observer.disconnect();
      restoreInterpretations(root);
    };
  }, []);

  return null;
}
