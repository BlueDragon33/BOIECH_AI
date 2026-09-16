"use client";

import { useEffect, useRef, useState } from "react";
import { buildConsensusAwareCoaching, COACHING_BUCKET } from "./consensus-aware-coaching-core.mjs";

type CoachingItem = {
  domain: string;
  label: string;
  status: string;
  bucket: string;
  reason: string;
  drill: string;
  cue: string;
  check: string;
  priority?: number;
};

type CoachingReport = {
  trustLevel: string;
  trustLabel: string;
  priority: CoachingItem[];
  verify: CoachingItem[];
  monitor: CoachingItem[];
  wait: CoachingItem[];
  ready: boolean;
  note: string;
};

function readConsistency(root: HTMLElement) {
  const panel = root.querySelector<HTMLElement>("[data-cross-module-consistency]");
  if (!panel) return null;
  const domains = Array.from(panel.querySelectorAll<HTMLElement>("[data-consistency-domain]"))
    .map((node) => ({
      domain: node.dataset.consistencyDomain ?? "",
      status: node.dataset.consistencyStatus ?? "insufficient",
    }))
    .filter((item) => item.domain);
  return buildConsensusAwareCoaching({
    trustLevel: root.dataset.unifiedTrustLevel ?? "unknown",
    domains,
  }) as CoachingReport;
}

function cardStyle(bucket: string) {
  if (bucket === COACHING_BUCKET.PRIORITY) return { border: "#b8d7c0", background: "#f5fbf6", color: "#28573a" };
  if (bucket === COACHING_BUCKET.VERIFY) return { border: "#e4c59d", background: "#fffaf1", color: "#75562a" };
  if (bucket === COACHING_BUCKET.MONITOR) return { border: "#cbdde5", background: "#f7fbfd", color: "#446571" };
  return { border: "#dde4e7", background: "#fafcfd", color: "#667982" };
}

function ItemCard({ item }: { item: CoachingItem }) {
  const style = cardStyle(item.bucket);
  return (
    <article data-coaching-domain={item.domain} data-coaching-bucket={item.bucket} style={{ border: `1px solid ${style.border}`, borderRadius: 12, background: "#fff", padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div>
          <strong style={{ display: "block", color: style.color, fontSize: 12 }}>{item.label}</strong>
          {item.priority ? <span style={{ display: "inline-block", marginTop: 4, border: `1px solid ${style.border}`, borderRadius: 999, background: style.background, padding: "3px 7px", color: style.color, fontSize: 9, fontWeight: 900 }}>Ưu tiên {item.priority}</span> : null}
        </div>
        <span style={{ borderRadius: 999, background: style.background, padding: "4px 7px", color: style.color, fontSize: 9, fontWeight: 900 }}>{item.bucket === COACHING_BUCKET.PRIORITY ? "Tập trước" : item.bucket === COACHING_BUCKET.VERIFY ? "Kiểm tra lại" : item.bucket === COACHING_BUCKET.MONITOR ? "Theo dõi" : "Chờ dữ liệu"}</span>
      </div>
      <p style={{ margin: "8px 0 0", color: "#60747d", fontSize: 10, lineHeight: 1.5 }}>{item.reason}</p>
      {item.bucket === COACHING_BUCKET.PRIORITY ? (
        <div style={{ marginTop: 9, borderTop: "1px dashed #d7e2e6", paddingTop: 8, display: "grid", gap: 5 }}>
          <div style={{ fontSize: 10 }}><b>Bài tập:</b> {item.drill}</div>
          <div style={{ fontSize: 10 }}><b>Cue:</b> {item.cue}</div>
          <div style={{ fontSize: 10 }}><b>Kiểm tra lại:</b> {item.check}</div>
        </div>
      ) : item.bucket === COACHING_BUCKET.VERIFY ? (
        <div style={{ marginTop: 8, fontSize: 10, color: "#687d86" }}><b>Việc tiếp theo:</b> {item.check}</div>
      ) : null}
    </article>
  );
}

export default function ConsensusAwareCoachingPanel() {
  const [report, setReport] = useState<CoachingReport | null>(null);
  const signatureRef = useRef("");

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-breaststroke-vision]");
    if (!root) return;
    let timer = 0;

    const update = () => {
      timer = 0;
      const next = readConsistency(root);
      const signature = JSON.stringify(next);
      if (signature === signatureRef.current) return;
      signatureRef.current = signature;
      setReport(next);
    };
    const schedule = () => {
      if (timer) return;
      timer = window.setTimeout(update, 0);
    };

    schedule();
    const observer = new MutationObserver((mutations) => {
      if (mutations.every((mutation) => mutation.target instanceof Element && mutation.target.closest("[data-consensus-aware-coaching]"))) return;
      schedule();
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-unified-trust-level", "data-consistency-status"] });
    return () => {
      if (timer) window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  if (!report) return null;
  const headline = report.ready ? "Ưu tiên luyện tập đã được xác nhận chéo" : "Chưa có lỗi đủ điều kiện để ưu tiên luyện tập";
  const priorityStyle = cardStyle(report.ready ? COACHING_BUCKET.PRIORITY : COACHING_BUCKET.VERIFY);

  return (
    <section data-consensus-aware-coaching="local-only" data-consensus-coaching-non-scoring style={{ maxWidth: 1240, margin: "0 auto 28px", padding: "0 28px", fontFamily: "Arial, Helvetica, sans-serif", color: "#163346" }}>
      <div style={{ border: `1px solid ${priorityStyle.border}`, borderRadius: 18, background: priorityStyle.background, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: ".05em", color: priorityStyle.color }}>CONSENSUS-AWARE COACHING · LOCAL-ONLY</span>
            <h3 style={{ margin: "5px 0 5px", fontSize: 17 }}>{headline}</h3>
            <p style={{ margin: 0, maxWidth: 860, fontSize: 11, lineHeight: 1.5, color: "#5b727c" }}>Chỉ lỗi được nhiều nguồn độc lập xác nhận mới đi vào nhóm tập trước. Lỗi mâu thuẫn, đơn nguồn hoặc trust thấp được chuyển sang kiểm tra lại.</p>
          </div>
          <strong style={{ border: `1px solid ${priorityStyle.border}`, borderRadius: 999, background: "#fff", padding: "6px 9px", fontSize: 10, color: priorityStyle.color }}>Unified Trust · {report.trustLabel}</strong>
        </div>

        {report.priority.length ? (
          <div style={{ marginTop: 13 }}>
            <h4 style={{ margin: "0 0 7px", fontSize: 12 }}>Tập trước</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 9 }}>{report.priority.map((item) => <ItemCard key={`priority-${item.domain}`} item={item} />)}</div>
          </div>
        ) : null}

        {report.verify.length ? (
          <div style={{ marginTop: 13 }}>
            <h4 style={{ margin: "0 0 7px", fontSize: 12 }}>Cần kiểm tra lại trước khi dùng làm bài tập chính</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 9 }}>{report.verify.map((item) => <ItemCard key={`verify-${item.domain}`} item={item} />)}</div>
          </div>
        ) : null}

        {report.monitor.length ? (
          <details style={{ marginTop: 12, borderTop: "1px dashed #d4e0e4", paddingTop: 9 }}>
            <summary style={{ cursor: "pointer", fontSize: 10, fontWeight: 900, color: "#54717c" }}>Nhóm đang nhất quán, chỉ cần theo dõi ({report.monitor.length})</summary>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 9, marginTop: 8 }}>{report.monitor.map((item) => <ItemCard key={`monitor-${item.domain}`} item={item} />)}</div>
          </details>
        ) : null}

        {report.wait.length ? <p style={{ margin: "10px 0 0", fontSize: 10, color: "#72848b" }}>Còn {report.wait.length} nhóm chưa đủ dữ liệu độc lập để coaching.</p> : null}
        <p style={{ margin: "11px 0 0", fontSize: 9, lineHeight: 1.5, color: "#788a91" }}>{report.note}</p>
      </div>
    </section>
  );
}
