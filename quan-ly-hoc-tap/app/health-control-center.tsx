"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  connectAdminDevice,
  roleLabels,
  upstreamJson,
  type AdminAccess,
  type AdminBootstrap,
  type ControlRole,
} from "./admin-device-client";
import styles from "./application-admin.module.css";

type HealthStatus = "permission_requested" | "draft" | "review" | "published" | "changes_requested" | "denied" | "cancelled" | "archived";
type HealthVersion = {
  id: string;
  version_number: number;
  status: HealthStatus;
  summary: string | null;
  created_by: string;
  editor_device_code?: string | null;
  edit_scope?: string | null;
  edit_scope_label?: string | null;
  permission_note?: string | null;
  permission_reviewed_by?: string | null;
  submitted_at?: string | null;
  reviewed_by?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
};
type HealthControlData = {
  application: "child-health";
  versions: HealthVersion[];
  versionId?: string;
  editScope?: { lessonNumber: string; section: string; sectionLabel: string; label: string; value: string };
  currentSection?: unknown;
  proposedSection?: unknown;
  validationErrors?: string[];
};
type Tab = "overview" | "review" | "versions";

const statusLabels: Record<HealthStatus, string> = {
  permission_requested: "Xin quyền",
  draft: "Bản nháp",
  review: "Chờ duyệt",
  published: "Đang xuất bản",
  changes_requested: "Yêu cầu sửa lại",
  denied: "Từ chối",
  cancelled: "Đã hủy",
  archived: "Lưu trữ",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date) : "—";
}

function Gate({ access, busy, error, retry }: { access: AdminAccess | null; busy: boolean; error: string; retry: () => void }) {
  return <main className={styles.gateShell}><section className={styles.gateCard}>
    <span className={styles.sectionEyebrow}>Sức khỏe trẻ · quản trị riêng</span>
    <h1>{access?.status === "pending" ? "Thiết bị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Đang xác thực quản trị…"}</h1>
    <p>{error || "Khu vực này dùng cùng danh tính quản trị trung tâm nhưng dữ liệu và thao tác chỉ thuộc ứng dụng Sức khỏe trẻ."}</p>
    {access?.deviceCode ? <div className={styles.gateCode}><span>Mã thiết bị</span><strong>{access.deviceCode}</strong></div> : null}
    <button className={styles.primaryButton} onClick={retry} disabled={busy}>{busy ? "Đang kiểm tra…" : "Kiểm tra lại"}</button>
  </section></main>;
}

function canReview(role: ControlRole) { return ["reviewer", "publisher", "owner"].includes(role); }
function canPublish(role: ControlRole) { return ["publisher", "owner"].includes(role); }

export default function HealthControlCenter({ user }: { user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [bootstrap, setBootstrap] = useState<AdminBootstrap | null>(null);
  const [versions, setVersions] = useState<HealthVersion[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [currentSection, setCurrentSection] = useState<unknown>(null);
  const [proposedSection, setProposedSection] = useState<unknown>(null);
  const [scopeLabel, setScopeLabel] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadVersions(bridge: AdminBootstrap["boiBridge"]) {
    const data = await upstreamJson<HealthControlData>(bridge, "/api/control/health-content");
    setVersions(data.versions ?? []);
    return data.versions ?? [];
  }

  async function initialize() {
    setBusy(true);
    setError("");
    try {
      const result = await connectAdminDevice();
      setAccess(result.access);
      setBootstrap(result.bootstrap);
      if (result.access.status === "approved" && result.bootstrap) await loadVersions(result.bootstrap.boiBridge);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể mở quản trị Sức khỏe trẻ.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void initialize(); }, []);

  const counts = useMemo(() => ({
    permission: versions.filter((item) => item.status === "permission_requested").length,
    review: versions.filter((item) => item.status === "review").length,
    changes: versions.filter((item) => item.status === "changes_requested").length,
    published: versions.filter((item) => item.status === "published").length,
  }), [versions]);

  const reviewVersions = versions.filter((item) => ["permission_requested", "review", "changes_requested"].includes(item.status));
  const selected = versions.find((item) => item.id === selectedId) ?? null;

  async function selectVersion(id: string) {
    if (!bootstrap) return;
    setBusy(true); setError(""); setSelectedId(id); setCurrentSection(null); setProposedSection(null); setScopeLabel("");
    try {
      const data = await upstreamJson<HealthControlData>(bootstrap.boiBridge, "/api/control/health-content", { query: `?versionId=${encodeURIComponent(id)}` });
      setVersions(data.versions ?? []);
      setCurrentSection(data.currentSection ?? null);
      setProposedSection(data.proposedSection ?? null);
      setScopeLabel(data.editScope?.label ?? "");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể tải phiên bản."); }
    finally { setBusy(false); }
  }

  async function run(action: string, success: string) {
    if (!bootstrap || !selectedId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await upstreamJson<HealthControlData>(bootstrap.boiBridge, "/api/control/health-content", { method: "POST", body: { action, versionId: selectedId, note } });
      setVersions(data.versions ?? []);
      setNotice(success);
      setNote("");
      if (data.versionId) setSelectedId(data.versionId);
      if (action === "approve-publish" || action === "rollback" || action === "cancel" || action === "deny-edit") {
        setCurrentSection(null); setProposedSection(null); setScopeLabel("");
      } else {
        await selectVersion(data.versionId ?? selectedId);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể thực hiện thao tác."); }
    finally { setBusy(false); }
  }

  if (!access || access.status !== "approved" || !bootstrap) return <Gate access={access} busy={busy} error={error} retry={() => void initialize()} />;

  return <main className={styles.appShell}><div className={styles.appFrame}>
    <Link href="/" className={styles.backLink}>← Trung tâm · chọn ứng dụng</Link>
    <header className={styles.appHeader}>
      <div><span>Ứng dụng độc lập</span><h1>Quản trị Sức khỏe trẻ 9 tháng–5 tuổi</h1><p>Chỉ quản lý nội dung giáo trình và quy trình biên tập của Sức khỏe trẻ. Không hiển thị thiết bị học, tiến độ, thanh toán hay dữ liệu cá nhân của Bơi ếch.</p></div>
      <div className={styles.headerActions}><a className={styles.secondaryButton} href="https://boi-ech.boiech-ai.workers.dev/suc-khoe-tre" target="_blank" rel="noreferrer">Mở ứng dụng</a><a className={styles.secondaryButton} href="https://boi-ech.boiech-ai.workers.dev/bien-tap-suc-khoe-tre" target="_blank" rel="noreferrer">Mở trình biên tập</a></div>
    </header>

    <div className={styles.boundary}><strong>Ranh giới dữ liệu:</strong> Trung tâm này chỉ nhận phiên bản nội dung cần duyệt. Hồ sơ bé, triệu chứng, nhiệt độ, SpO₂, nhật ký bệnh và kết quả phân tầng nguy cơ không được đưa vào quản trị trung tâm.</div>
    {error ? <div className={styles.error}>{error}</div> : null}
    {notice ? <div className={styles.notice}>{notice}</div> : null}

    <section className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span>Xin quyền sửa</span><strong>{counts.permission}</strong><small>Chờ kiểm duyệt viên quyết định</small></article>
      <article className={styles.summaryCard}><span>Chờ duyệt</span><strong>{counts.review}</strong><small>Bản đã gửi Trung tâm</small></article>
      <article className={styles.summaryCard}><span>Cần sửa lại</span><strong>{counts.changes}</strong><small>Đã trả về người biên tập</small></article>
      <article className={styles.summaryCard}><span>Đang xuất bản</span><strong>{counts.published}</strong><small>Phiên bản hiệu lực</small></article>
    </section>

    <nav className={styles.tabs}>
      {([['overview','Tổng quan'],['review','Duyệt chỉnh sửa'],['versions','Lịch sử phiên bản']] as const).map(([id,label]) => <button key={id} className={`${styles.tabButton} ${tab === id ? styles.tabActive : ""}`} onClick={() => setTab(id)}>{label}</button>)}
    </nav>

    {tab === "overview" ? <section className={styles.panel}><div className={styles.panelHeader}><div><span className={styles.sectionEyebrow}>Phạm vi quản trị</span><h2>Sức khỏe trẻ có quy trình riêng</h2></div><div className={styles.userCard}><strong>{user.displayName}</strong><small>{roleLabels[access.role]}</small><small>{access.deviceCode}</small></div></div><p>Quản trị viên xử lý quyền sửa, kiểm tra nội dung thay đổi, yêu cầu sửa lại, xuất bản hoặc khôi phục phiên bản. Các chức năng quản lý học viên/thiết bị của Bơi ếch không xuất hiện tại đây.</p><div className={styles.actionBar}><button className={styles.primaryButton} onClick={() => { setTab("review"); const first = reviewVersions[0]; if (first) void selectVersion(first.id); }}>Mở hàng đợi duyệt ({reviewVersions.length})</button><button className={styles.secondaryButton} onClick={() => void loadVersions(bootstrap.boiBridge)} disabled={busy}>Cập nhật dữ liệu</button></div></section> : null}

    {tab === "review" ? <section className={styles.panel}><div className={styles.panelHeader}><div><span className={styles.sectionEyebrow}>Hàng đợi riêng</span><h2>Yêu cầu Sức khỏe trẻ</h2></div><small>{reviewVersions.length} mục cần theo dõi</small></div>
      <div className={styles.versionList}>{reviewVersions.length ? reviewVersions.map((item) => <button key={item.id} className={`${styles.versionRow} ${selectedId === item.id ? styles.versionSelected : ""}`} onClick={() => void selectVersion(item.id)}><span className={styles.versionStatus}>{statusLabels[item.status]}</span><span className={styles.versionMeta}><strong>V{item.version_number} · {item.edit_scope_label ?? item.edit_scope ?? "Nội dung"}</strong><small>{item.created_by} · {formatDate(item.updated_at)}</small></span><span>{item.editor_device_code ?? "—"}</span></button>) : <p>Không có yêu cầu Sức khỏe trẻ đang chờ xử lý.</p>}</div>
      {selected ? <><div className={styles.reviewGrid}><article className={styles.reviewBox}><h3>Đang xuất bản {scopeLabel ? `· ${scopeLabel}` : ""}</h3><pre>{currentSection == null ? "Không có dữ liệu so sánh ở trạng thái này." : JSON.stringify(currentSection, null, 2)}</pre></article><article className={styles.reviewBox}><h3>Đề xuất chỉnh sửa</h3><pre>{proposedSection == null ? "Chưa có nội dung đề xuất để so sánh." : JSON.stringify(proposedSection, null, 2)}</pre></article></div><textarea className={styles.noteInput} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú kiểm duyệt / lý do yêu cầu sửa lại…" maxLength={1000} /><div className={styles.actionBar}>
        {selected.status === "permission_requested" && canReview(access.role) ? <><button className={styles.primaryButton} disabled={busy} onClick={() => void run("approve-edit", "Đã cấp quyền chỉnh sửa Sức khỏe trẻ.")}>Cho phép chỉnh sửa</button><button className={styles.dangerButton} disabled={busy} onClick={() => void run("deny-edit", "Đã từ chối yêu cầu chỉnh sửa.")}>Từ chối</button></> : null}
        {selected.status === "review" && canReview(access.role) ? <button className={styles.secondaryButton} disabled={busy} onClick={() => void run("request-changes", "Đã yêu cầu chỉnh sửa lại.")}>Yêu cầu sửa lại</button> : null}
        {selected.status === "review" && canPublish(access.role) ? <button className={styles.primaryButton} disabled={busy || selected.created_by === access.email} onClick={() => void run("approve-publish", "Đã xuất bản nội dung Sức khỏe trẻ.")}>Phê duyệt & xuất bản</button> : null}
        {["permission_requested","draft","changes_requested","review"].includes(selected.status) && canReview(access.role) ? <button className={styles.dangerButton} disabled={busy} onClick={() => void run("cancel", "Đã hủy phiên bản.")}>Hủy phiên bản</button> : null}
      </div>{selected.created_by === access.email && selected.status === "review" ? <div className={styles.error}>Người tạo bản nháp không được tự phê duyệt phiên bản của mình.</div> : null}</> : null}
    </section> : null}

    {tab === "versions" ? <section className={styles.panel}><div className={styles.panelHeader}><div><span className={styles.sectionEyebrow}>Lịch sử riêng</span><h2>Phiên bản Sức khỏe trẻ</h2></div><button className={styles.secondaryButton} onClick={() => void loadVersions(bootstrap.boiBridge)}>Cập nhật</button></div><div className={styles.versionList}>{versions.map((item) => <button key={item.id} className={`${styles.versionRow} ${selectedId === item.id ? styles.versionSelected : ""}`} onClick={() => void selectVersion(item.id)}><span className={styles.versionStatus}>{statusLabels[item.status]}</span><span className={styles.versionMeta}><strong>V{item.version_number} · {item.summary || item.edit_scope_label || "Phiên bản nội dung"}</strong><small>{formatDate(item.updated_at)} · {item.reviewed_by || item.created_by}</small></span><span>{item.status === "published" ? "Hiệu lực" : ""}</span></button>)}</div>{selected && ["archived","published"].includes(selected.status) && canPublish(access.role) ? <div className={styles.actionBar}><button className={styles.secondaryButton} disabled={busy} onClick={() => void run("rollback", `Đã khôi phục từ V${selected.version_number}.`)}>Khôi phục phiên bản này</button></div> : null}</section> : null}
  </div></main>;
}
