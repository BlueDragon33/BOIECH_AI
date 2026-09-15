"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./video-analyzer.module.css";

type GateStatus = "unknown" | "clear" | "blocked";

function learnerVideo(root: ParentNode) {
  return root.querySelector<HTMLVideoElement>("video[playsinline]");
}

function videoSource(video?: HTMLVideoElement | null) {
  return video?.currentSrc || video?.src || "";
}

function guidanceGateStatus(root: ParentNode): GateStatus {
  const guidance = root.querySelector<HTMLElement>("[data-camera-guidance-local-only]");
  if (!guidance) return "unknown";
  const labels = Array.from(guidance.querySelectorAll("b")).map((node) => node.textContent?.trim() ?? "");
  if (labels.includes("Nên quay lại")) return "blocked";
  if (labels.includes("Đạt preflight") || labels.includes("Nên chỉnh khung")) return "clear";
  return "unknown";
}

function removeInputQualityBanner(root: ParentNode) {
  root.querySelector<HTMLElement>("[data-preflight-input-quality-low]")?.remove();
}

function ensureInputQualityBanner(root: ParentNode, active: boolean) {
  if (!active) {
    removeInputQualityBanner(root);
    return;
  }
  const report = root.querySelector<HTMLElement>(`.${styles.report}`);
  if (!report || report.querySelector("[data-preflight-input-quality-low]")) return;
  const banner = document.createElement("div");
  banner.dataset.preflightInputQualityLow = "";
  banner.setAttribute("role", "status");
  banner.style.cssText = "margin:0 0 12px;padding:10px 12px;border:1px solid #c77d42;border-radius:12px;background:#fff5e8;color:#75431d;font:700 12px/1.45 Arial,Helvetica,sans-serif";
  banner.innerHTML = "<strong style=\"display:block;margin-bottom:3px\">Chất lượng đầu vào thấp</strong><span style=\"font-weight:500\">Phân tích này được chạy sau khi chủ động bỏ qua preflight ‘Nên quay lại’. Điểm và lỗi chỉ mang tính tham khảo; nên quay clip đạt preflight trước khi dùng để đánh giá kỹ thuật.</span>";
  report.insertBefore(banner, report.firstChild);
}

export default function PreflightEnforcementPanel() {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [source, setSource] = useState("");
  const [gateStatus, setGateStatus] = useState<GateStatus>("unknown");
  const [overrideSource, setOverrideSource] = useState("");
  const [notice, setNotice] = useState("");
  const sourceRef = useRef("");

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-breaststroke-vision]");
    if (!root) return;
    let host: HTMLElement | null = null;

    const update = () => {
      const nextSource = videoSource(learnerVideo(root));
      if (nextSource !== sourceRef.current) {
        sourceRef.current = nextSource;
        setSource(nextSource);
        setOverrideSource("");
        setNotice("");
        removeInputQualityBanner(root);
      }
      setGateStatus(guidanceGateStatus(root));
      if (!host?.isConnected) {
        const analyzeButton = root.querySelector<HTMLButtonElement>(`.${styles.analyzeButton}`);
        if (analyzeButton?.parentElement) {
          host = document.createElement("div");
          host.dataset.preflightEnforcementHost = "";
          host.style.margin = "0 0 10px";
          analyzeButton.parentElement.insertBefore(host, analyzeButton);
          setPortalHost(host);
        }
      }
    };

    const initialTimer = window.setTimeout(update, 0);
    const observer = new MutationObserver(update);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    return () => {
      window.clearTimeout(initialTimer);
      observer.disconnect();
      removeInputQualityBanner(root);
      host?.remove();
    };
  }, []);

  const overrideActive = Boolean(source && gateStatus === "blocked" && overrideSource === source);
  const softBlocked = Boolean(source && gateStatus === "blocked" && !overrideActive);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-breaststroke-vision]");
    if (!root) return;
    const button = root.querySelector<HTMLButtonElement>(`.${styles.analyzeButton}`);
    if (!button) return;

    if (softBlocked) {
      button.dataset.preflightSoftLocked = "";
      button.setAttribute("aria-disabled", "true");
      button.title = "Camera Guidance đang ở mức Nên quay lại. Hãy quay lại hoặc chọn Vẫn phân tích thử.";
      button.style.opacity = ".58";
      button.style.cursor = "not-allowed";
    } else {
      delete button.dataset.preflightSoftLocked;
      button.removeAttribute("aria-disabled");
      button.removeAttribute("title");
      button.style.removeProperty("opacity");
      button.style.removeProperty("cursor");
    }

    const intercept = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest(`.${styles.analyzeButton}`) : null;
      if (!target || !softBlocked) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setNotice("Phân tích đang khóa mềm vì preflight ở mức ‘Nên quay lại’. Quay lại clip hoặc chọn ‘Vẫn phân tích thử’. ");
    };
    root.addEventListener("click", intercept, true);
    return () => {
      root.removeEventListener("click", intercept, true);
      if (button.dataset.preflightSoftLocked !== undefined) {
        delete button.dataset.preflightSoftLocked;
        button.removeAttribute("aria-disabled");
        button.removeAttribute("title");
        button.style.removeProperty("opacity");
        button.style.removeProperty("cursor");
      }
    };
  }, [softBlocked]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-breaststroke-vision]");
    if (!root) return;
    const active = overrideActive;
    const updateBanner = () => ensureInputQualityBanner(root, active);
    const timer = window.setTimeout(updateBanner, 0);
    const observer = new MutationObserver(updateBanner);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      if (!active) removeInputQualityBanner(root);
    };
  }, [overrideActive]);

  if (!portalHost || gateStatus !== "blocked") return null;

  const content = (
    <section data-preflight-enforcement-local-only style={{ border: `1px solid ${overrideActive ? "#c99a50" : "#cb6f6f"}`, borderRadius: 11, background: overrideActive ? "#fff8ec" : "#fff3f3", padding: 9, color: overrideActive ? "#704a20" : "#7c3434" }}>
      <strong style={{ display: "block", fontSize: 10 }}>{overrideActive ? "Đã bỏ qua preflight cho clip hiện tại" : "Preflight Enforcement · phân tích đang khóa mềm"}</strong>
      <p style={{ margin: "4px 0 0", fontSize: 8, lineHeight: 1.45 }}>{overrideActive ? "Bạn vẫn có thể phân tích thử, nhưng kết quả của clip này sẽ được gắn nhãn ‘Chất lượng đầu vào thấp’." : "Camera Guidance đánh giá clip ở mức ‘Nên quay lại’. Khóa này ngăn vô tình dùng một clip đầu vào yếu như kết quả kỹ thuật đáng tin cậy."}</p>
      <div style={{ marginTop: 7, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {overrideActive ? <button type="button" onClick={() => { setOverrideSource(""); setNotice("Đã bật lại khóa preflight cho clip hiện tại."); }} style={{ border: "1px solid #b47b34", borderRadius: 8, background: "#fff", color: "#704a20", padding: "6px 8px", fontSize: 8, fontWeight: 900, cursor: "pointer" }}>Bật lại khóa</button> : <button type="button" onClick={() => { setOverrideSource(source); setNotice("Đã cho phép phân tích thử clip đầu vào thấp. Kết quả sẽ có cảnh báo rõ ràng."); }} style={{ border: 0, borderRadius: 8, background: "#8b4343", color: "#fff", padding: "7px 9px", fontSize: 8, fontWeight: 900, cursor: "pointer" }}>Vẫn phân tích thử</button>}
        <span style={{ fontSize: 8, lineHeight: 1.35 }}>{overrideActive ? "Chỉ áp dụng cho đúng video local hiện tại." : "Khuyến nghị: quay lại theo Guided Retake trước."}</span>
      </div>
      {notice ? <p role="status" style={{ margin: "6px 0 0", fontSize: 8, fontWeight: 700 }}>{notice}</p> : null}
    </section>
  );

  return createPortal(content, portalHost);
}
