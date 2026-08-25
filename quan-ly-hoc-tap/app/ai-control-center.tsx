"use client";

import { useEffect, useMemo, useState } from "react";

type ControlRole = "viewer" | "reviewer" | "publisher" | "owner";
type AiSettings = { enabled: boolean; tutorEnabled: boolean; adaptiveEnabled: boolean; contentAssistantEnabled: boolean; updatedBy: string | null; updatedAt: string | null };
type AiAlert = { level: "info" | "warning" | "critical"; code: string; text: string };
type AiLearner = { deviceId: string; deviceCode: string; learnerName: string | null; className: string | null; deviceStatus: string; aiEnabled: boolean; aiReason: string | null; interactionCount: number; lastAiAt: string | null; priorityLesson: string; averageMastery: number; alerts: AiAlert[] };
type AiFeedback = { id: string; interactionId: string; deviceId: string; deviceCode: string | null; learnerName: string | null; rating: string; note: string | null; status: string; query: string | null; response: { answer?: string }; engineVersion: string; promptVersion: string; reviewedBy: string | null; reviewedAt: string | null; createdAt: string };
type AiInteraction = { id: string; subjectId: string; deviceCode: string | null; learnerName: string | null; kind: string; lessonNumber: string | null; section: string | null; query: string | null; response: { answer?: string; safety?: string }; citations: { label?: string }[]; engineVersion: string; promptVersion: string; durationMs: number; costMicros: number; teacherRating: string | null; teacherReviewedBy: string | null; teacherReviewedAt: string | null; createdAt: string };

export type AiControlData = {
  settings?: AiSettings;
  engine?: { name: string; version: string; sourceVersion: number; visionEnabled: boolean; externalProvider: boolean; privacy: string };
  metrics?: { interactions30Days: number; learners30Days: number; averageResponseMs: number; inputUnits: number; outputUnits: number; costMicros: number; adaptiveAttempts30Days: number; adaptivePassRate: number; openReports: number; learnersAtRisk: number };
  learners?: AiLearner[];
  feedback?: AiFeedback[];
  interactions?: AiInteraction[];
  saved?: boolean;
  error?: string;
};

const ratingLabels: Record<string, string> = {
  helpful: "Hữu ích",
  not_helpful: "Chưa hữu ích",
  inappropriate: "Báo nội dung sai",
  approved: "Giáo viên chấp thuận",
  needs_review: "Cần xem lại",
  rejected: "Không đạt",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date) : "—";
}

function Toggle({ active, label, onClick, disabled }: { active: boolean; label: string; onClick: () => void; disabled: boolean }) {
  return <button type="button" className={`ai-toggle ${active ? "on" : "off"}`} aria-pressed={active} onClick={onClick} disabled={disabled}><i><b /></i><span>{label}</span><strong>{active ? "Bật" : "Tắt"}</strong></button>;
}

export default function AiControlCenter({ role, api, onNotice }: { role: ControlRole; api: (init?: { method?: "GET" | "POST"; body?: Record<string, unknown> }) => Promise<AiControlData>; onNotice: (message: string) => void }) {
  const [data, setData] = useState<AiControlData | null>(null);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState<"all" | "risk" | "reported" | "disabled">("all");
  const canReview = ["reviewer", "publisher", "owner"].includes(role);
  const canManage = ["publisher", "owner"].includes(role);

  async function load(quiet = false) {
    if (!quiet) setBusy(true);
    try {
      const result = await api();
      if (result.error) throw new Error(result.error);
      setData(result);
      if (result.settings) setSettings(result.settings);
    } catch (error) { onNotice(error instanceof Error ? error.message : "Chưa thể tải bảng điều hành AI."); }
    finally { if (!quiet) setBusy(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  // Bảng AI chỉ tải khi người quản trị chủ động mở tab.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(body: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      const result = await api({ method: "POST", body });
      if (result.error) throw new Error(result.error);
      onNotice(success);
      await load(true);
    } catch (error) { onNotice(error instanceof Error ? error.message : "Không thể cập nhật quản trị AI."); }
    finally { setBusy(false); }
  }

  async function saveSettings() {
    if (!settings) return;
    await run({ action: "update-settings", enabled: settings.enabled, tutorEnabled: settings.tutorEnabled, adaptiveEnabled: settings.adaptiveEnabled, contentAssistantEnabled: settings.contentAssistantEnabled }, "Đã cập nhật cấu hình AI và ghi nhật ký kiểm toán.");
  }

  function changeDevice(learner: AiLearner) {
    const enabled = !learner.aiEnabled;
    const reason = enabled ? "" : window.prompt("Lý do tắt AI cho học viên này:", "Tạm tắt theo quyết định quản trị")?.trim();
    if (!enabled && reason === undefined) return;
    void run({ action: "set-device-ai", deviceId: learner.deviceId, enabled, reason }, enabled ? `Đã bật lại AI cho ${learner.learnerName || learner.deviceCode}.` : `Đã tắt AI cho ${learner.learnerName || learner.deviceCode}.`);
  }

  function exportReport() {
    if (!data) return;
    const report = { exportedAt: new Date().toISOString(), title: "Báo cáo vận hành AI · Bơi ếch", ...data };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-ai-boi-ech-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const learners = useMemo(() => (data?.learners ?? []).filter((item) => filter === "all" || (filter === "risk" ? item.alerts.length > 0 : filter === "disabled" ? !item.aiEnabled : item.interactionCount > 0)), [data?.learners, filter]);
  const metrics = data?.metrics;

  if (busy && !data) return <section className="ai-control-loading"><span>Đang tổng hợp 30 ngày</span><h2>Phân tích hoạt động AI và cảnh báo học tập</h2></section>;

  return (
    <section className="ai-control-layout">
      <section className="ai-control-hero"><div><span>Trung tâm điều hành AI</span><h2>Kiểm soát trợ giảng, lộ trình và chất lượng phản hồi</h2><p>Mọi phản hồi đều có phiên bản hệ thống, nguồn bài giảng và người đánh giá. Không dùng AI thị giác, camera, ảnh hoặc video học viên.</p><div><button className="button primary" onClick={() => void load()} disabled={busy}>Cập nhật dữ liệu AI</button><button className="button" onClick={exportReport}>Xuất báo cáo AI</button></div></div><aside><span>Động cơ đang chạy</span><strong>{data?.engine?.name}</strong><small>v{data?.engine?.version} · nội dung v{data?.engine?.sourceVersion}</small><i>{data?.engine?.externalProvider ? "Có nhà cung cấp ngoài" : "Chạy nội bộ · 0đ phí mô hình"}</i></aside></section>

      <section className="ai-policy-banner"><i>✓</i><div><strong>Chính sách dữ liệu</strong><p>{data?.engine?.privacy}</p></div><span>AI thị giác: Tắt</span></section>

      <section className="ai-metric-grid"><article><span>Tương tác AI · 30 ngày</span><strong>{metrics?.interactions30Days ?? 0}</strong><small>{metrics?.learners30Days ?? 0} học viên sử dụng</small></article><article><span>Học viên cần hỗ trợ</span><strong>{metrics?.learnersAtRisk ?? 0}</strong><small>Dựa trên tiến độ, điểm và lượt làm</small></article><article><span>Báo cáo chờ xử lý</span><strong>{metrics?.openReports ?? 0}</strong><small>Phản hồi từ người học</small></article><article><span>Bài luyện thích ứng</span><strong>{metrics?.adaptivePassRate ?? 0}%</strong><small>{metrics?.adaptiveAttempts30Days ?? 0} lượt trong 30 ngày</small></article><article><span>Phản hồi trung bình</span><strong>{metrics?.averageResponseMs ?? 0} ms</strong><small>Động cơ truy xuất nội bộ</small></article><article><span>Chi phí mô hình</span><strong>{((metrics?.costMicros ?? 0) / 1_000_000).toLocaleString("vi-VN")}đ</strong><small>{(metrics?.inputUnits ?? 0) + (metrics?.outputUnits ?? 0)} đơn vị đã xử lý</small></article></section>

      <section className="ai-settings-card"><header><div><span>Công tắc an toàn</span><h2>Bật/tắt theo chức năng</h2><p>Việc tắt AI không ảnh hưởng bài giảng, tiến độ, bài kiểm tra chính thức hoặc học offline.</p></div>{canManage ? <button className="button primary" onClick={() => void saveSettings()} disabled={busy || !settings}>Lưu cấu hình</button> : <span className="role-readonly">Chỉ xem</span>}</header>{settings ? <div><Toggle active={settings.enabled} label="Toàn bộ AI" disabled={!canManage || busy} onClick={() => setSettings({ ...settings, enabled: !settings.enabled })} /><Toggle active={settings.tutorEnabled} label="Trợ giảng có nguồn" disabled={!canManage || busy} onClick={() => setSettings({ ...settings, tutorEnabled: !settings.tutorEnabled })} /><Toggle active={settings.adaptiveEnabled} label="Bài luyện thích ứng" disabled={!canManage || busy} onClick={() => setSettings({ ...settings, adaptiveEnabled: !settings.adaptiveEnabled })} /><Toggle active={settings.contentAssistantEnabled} label="Trợ lý soạn nội dung" disabled={!canManage || busy} onClick={() => setSettings({ ...settings, contentAssistantEnabled: !settings.contentAssistantEnabled })} /></div> : null}</section>

      <section className="ai-learner-panel"><header><div><span>Cảnh báo và quyền theo học viên</span><h2>Hồ sơ năng lực theo thiết bị</h2></div><div>{(["all", "risk", "reported", "disabled"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "Tất cả" : item === "risk" ? "Cần hỗ trợ" : item === "reported" ? "Đã dùng AI" : "AI đang tắt"}</button>)}</div></header><div className="ai-learner-table"><div className="ai-table-head"><span>Học viên</span><span>Năng lực</span><span>Ưu tiên</span><span>Tương tác</span><span>Quyền AI</span></div>{learners.map((learner) => <article key={learner.deviceId}><div><strong>{learner.learnerName || "Chưa gửi tên"}</strong><small>{learner.className || "Chưa có lớp"} · {learner.deviceCode}</small>{learner.alerts.map((alert) => <em key={alert.code} className={alert.level}>{alert.text}</em>)}</div><div><b>{learner.averageMastery}%</b><i><span style={{ width: `${learner.averageMastery}%` }} /></i></div><div><strong>Bài {learner.priorityLesson}</strong><small>{learner.alerts.length ? `${learner.alerts.length} cảnh báo` : "Đang ổn định"}</small></div><div><strong>{learner.interactionCount}</strong><small>{formatDate(learner.lastAiAt)}</small></div><div><span className={`ai-state ${learner.aiEnabled ? "enabled" : "disabled"}`}>{learner.aiEnabled ? "Đang bật" : "Đã tắt"}</span>{canManage ? <button onClick={() => changeDevice(learner)}>{learner.aiEnabled ? "Tắt AI" : "Bật lại"}</button> : null}</div></article>)}{learners.length === 0 ? <div className="ai-empty-row">Không có học viên phù hợp bộ lọc.</div> : null}</div></section>

      <section className="ai-review-grid"><article className="ai-feedback-panel"><header><span>Hộp thư chất lượng</span><h2>Phản hồi người học</h2></header><div>{(data?.feedback ?? []).map((item) => <section key={item.id} className={item.status}><div><span>{ratingLabels[item.rating] ?? item.rating}</span><strong>{item.learnerName || item.deviceCode || "Thiết bị học"}</strong><small>{formatDate(item.createdAt)} · {item.engineVersion}</small></div><p><b>Câu hỏi:</b> {item.query || "—"}</p><p><b>AI trả lời:</b> {item.response.answer || "—"}</p>{item.note ? <blockquote>{item.note}</blockquote> : null}{item.status === "open" && canReview ? <footer><button onClick={() => void run({ action: "resolve-feedback", feedbackId: item.id, status: "resolved" }, "Đã xử lý báo cáo AI.")}>Đã xử lý</button><button onClick={() => void run({ action: "resolve-feedback", feedbackId: item.id, status: "dismissed" }, "Đã đóng báo cáo AI.")}>Đóng báo cáo</button></footer> : <em>{item.status === "open" ? "Chờ người có quyền xử lý" : `Đã ${item.status === "resolved" ? "xử lý" : "đóng"}`}</em>}</section>)}{(data?.feedback ?? []).length === 0 ? <div className="ai-empty-row">Chưa có báo cáo chất lượng.</div> : null}</div></article>

        <article className="ai-response-panel"><header><span>Giám sát chuyên môn</span><h2>Phản hồi AI gần đây</h2></header><div>{(data?.interactions ?? []).filter((item) => item.kind === "mentor").slice(0, 20).map((item) => <section key={item.id}><div><span>Bài {item.lessonNumber || "—"} · {item.deviceCode || "—"}</span><small>{formatDate(item.createdAt)} · {item.durationMs} ms</small></div><p><b>Hỏi:</b> {item.query || "—"}</p><p><b>Trả lời:</b> {item.response.answer || "—"}</p><small>Nguồn: {item.citations.map((citation) => citation.label).filter(Boolean).join(" · ") || "Phản hồi an toàn/ngoài phạm vi"}</small>{item.teacherRating ? <em className={`teacher-${item.teacherRating}`}>{ratingLabels[item.teacherRating] ?? item.teacherRating} · {item.teacherReviewedBy}</em> : canReview ? <footer><button onClick={() => void run({ action: "review-interaction", interactionId: item.id, rating: "approved" }, "Đã đánh dấu phản hồi AI đạt chuyên môn.")}>Đạt</button><button onClick={() => void run({ action: "review-interaction", interactionId: item.id, rating: "needs_review" }, "Đã chuyển phản hồi AI sang cần xem lại.")}>Cần xem lại</button><button onClick={() => void run({ action: "review-interaction", interactionId: item.id, rating: "rejected" }, "Đã đánh dấu phản hồi AI không đạt.")}>Không đạt</button></footer> : null}</section>)}{(data?.interactions ?? []).filter((item) => item.kind === "mentor").length === 0 ? <div className="ai-empty-row">Chưa có phản hồi trợ giảng để đánh giá.</div> : null}</div></article>
      </section>
    </section>
  );
}
