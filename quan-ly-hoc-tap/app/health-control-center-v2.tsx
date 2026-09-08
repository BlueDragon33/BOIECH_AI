"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  bridgeForApplication,
  connectAdminDevice,
  roleLabels,
  upstreamJson,
  type AdminAccess,
  type AdminBootstrap,
  type ApplicationBridge,
  type ControlRole,
} from "./admin-device-client";
import styles from "./health-control-plane-v2.module.css";

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
  submitted_at?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
};
type HealthDevice = {
  deviceId: string;
  deviceCode: string;
  status: "pending" | "approved" | "blocked";
  deviceType: "desktop" | "phone" | "tablet";
  detectedDeviceType: "desktop" | "phone" | "tablet";
  deviceTypeOverride: "desktop" | "phone" | "tablet" | null;
  deviceTypeOverrideBy: string | null;
  deviceTypeOverrideAt: string | null;
  environmentChanged: boolean;
  environmentChangeReason: string | null;
  autoLabel: string | null;
  platform: string | null;
  osName: string | null;
  browser: string | null;
  browserVersion: string | null;
  installationId: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  touchPoints: number;
  mobileHint: boolean;
  pwaMode: boolean;
  language: string | null;
  timezone: string | null;
  classificationConfidence: "high" | "medium" | "low";
  classificationReason: string | null;
  metadataUpdatedAt: string | null;
  label: string | null;
  editEnabled: boolean;
  calendarEnabled: boolean;
  createdAt: string;
  approvedAt: string | null;
  blockedAt: string | null;
  lastSeenAt: string;
  lastActivityAt: string;
  offlineSinceAt: string | null;
  active: boolean;
};
type HealthPolicy = {
  accessEnabled: boolean;
  pendingPollSeconds: number;
  heartbeatSeconds: number;
  sessionTimeoutSeconds: number;
  sessionTtlMinutes: number;
  systemNoticeEnabled: boolean;
  systemNotice: string | null;
  updatedBy: string | null;
  updatedAt: string;
};
type HealthSession = {
  sessionId: string;
  deviceId: string;
  deviceCode: string;
  deviceLabel: string | null;
  deviceType: "desktop" | "phone" | "tablet";
  deviceStatus: "pending" | "approved" | "blocked";
  status: "active" | "revoked" | "expired";
  startedAt: string;
  lastSeenAt: string;
  expiresAt: number;
  revokedAt: string | null;
  revokedBy: string | null;
  revokeReason: string | null;
  active: boolean;
};
type HealthAudit = {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail: Record<string, unknown>;
  createdAt: string;
};
type HealthControlStatus = {
  application: "child-health";
  canonicalApplication?: "suc-khoe-y-te";
  applicationAliases?: readonly string[];
  controlProtocol?: "health-control-plane";
  contractVersion: number;
  capabilities?: readonly string[];
  boundary?: { healthDataInControlPlane?: boolean; deviceIdentity?: string };
  service: "online" | "paused";
  serverTime: string;
  devices: { total: number; pending: number; approved: number; blocked: number };
  sessions: { total: number; active: number; revoked: number; expired: number };
  policy: HealthPolicy;
};
type ContentData = {
  application: "child-health";
  versions: HealthVersion[];
  versionId?: string;
  editScope?: { label: string };
  currentSection?: unknown;
  proposedSection?: unknown;
  validationErrors?: string[];
};
type DeviceData = { application: "child-health"; devices: HealthDevice[] };
type SessionData = { application: "child-health"; sessions: HealthSession[] };
type PolicyData = { application: "child-health"; policy: HealthPolicy };
type AuditData = { application: "child-health"; audit: HealthAudit[] };
type Tab = "overview" | "devices" | "sessions" | "policy" | "audit" | "review" | "versions";
type DeviceFilter = "all" | "pending" | "approved" | "blocked" | "desktop" | "phone" | "tablet" | "unnamed" | "attention";

const statusLabels: Record<HealthStatus, string> = {
  permission_requested: "Xin quyền",
  draft: "Bản nháp",
  review: "Chờ duyệt",
  published: "Đang xuất bản",
  changes_requested: "Cần sửa lại",
  denied: "Từ chối",
  cancelled: "Đã hủy",
  archived: "Lưu trữ",
};
const deviceTypeLabels = { desktop: "Máy tính", phone: "Điện thoại", tablet: "Máy tính bảng / iPad" } as const;
const deviceConfidenceLabels = { high: "Tin cậy cao", medium: "Tin cậy vừa", low: "Cần kiểm tra" } as const;
const deviceReasonLabels: Record<string, string> = {
  "ipad-signal": "Tín hiệu iPad/iPadOS",
  "tablet-user-agent": "Dấu hiệu máy tính bảng",
  "phone-user-agent": "Dấu hiệu điện thoại",
  "mobile-hint-large-touch-screen": "Mobile + màn hình cảm ứng lớn",
  "client-hints-mobile": "Client Hints xác nhận thiết bị di động",
  "small-touch-screen": "Màn hình cảm ứng nhỏ",
  "desktop-platform": "Nền tảng máy tính",
  "large-touch-screen": "Màn hình cảm ứng lớn",
  "fallback-desktop": "Suy luận dự phòng",
};
const deviceStatusLabels = { pending: "Chờ duyệt", approved: "Được truy cập", blocked: "Đã khóa" } as const;
const sessionStatusLabels = { active: "Đang hoạt động", revoked: "Đã thu hồi", expired: "Hết hạn" } as const;
const auditLabels: Record<string, string> = {
  site_device_registered: "Thiết bị đăng ký",
  site_device_approved: "Cấp quyền thiết bị",
  site_device_blocked: "Khóa thiết bị",
  site_device_unblocked: "Mở khóa thiết bị",
  site_device_edit_enabled: "Cấp quyền sửa",
  site_device_edit_disabled: "Thu quyền sửa",
  site_device_calendar_enabled: "Cấp Google Calendar",
  site_device_calendar_disabled: "Thu Google Calendar",
  site_device_label_updated: "Đổi tên gợi nhớ",
  site_device_type_overridden: "Điều chỉnh loại thiết bị",
  site_device_type_override_cleared: "Trả phân loại về tự động",
  site_device_environment_changed: "Môi trường thiết bị thay đổi",
  site_device_environment_acknowledged: "Đã kiểm tra thay đổi thiết bị",
  site_session_started: "Tạo phiên truy cập",
  site_session_revoked: "Thu hồi phiên",
  site_device_sessions_revoked: "Thu hồi phiên thiết bị",
  site_policy_updated: "Cập nhật chính sách",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date) : "—";
}
function formatEpoch(value?: number | null) {
  return value ? formatDate(new Date(value).toISOString()) : "—";
}
function canReview(role: ControlRole) { return ["reviewer", "publisher", "owner"].includes(role); }
function canPublish(role: ControlRole) { return ["publisher", "owner"].includes(role); }
function canOwn(role: ControlRole) { return role === "owner"; }
function shortSession(value: string) { return value.length > 18 ? `${value.slice(0, 9)}…${value.slice(-6)}` : value; }
function shortInstallation(value?: string | null) {
  if (!value) return "—";
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}
function screenLabel(device: HealthDevice) {
  if (!device.screenWidth || !device.screenHeight) return "Màn hình chưa rõ";
  return `${device.screenWidth}×${device.screenHeight}`;
}

function Gate({ access, busy, error, retry }: { access: AdminAccess | null; busy: boolean; error: string; retry: () => void }) {
  return <main className={styles.gate}><section className={styles.gateCard}>
    <span className={styles.eyebrow}>Sức khỏe Y tế · Control Plane</span>
    <h1>{access?.status === "pending" ? "Thiết bị quản trị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Đang xác thực Trung tâm Quản trị…"}</h1>
    <p>{error || "Chỉ thiết bị quản trị đã được cấp quyền mới có thể điều khiển Sức khỏe Y tế."}</p>
    {access?.deviceCode ? <div className={styles.gateCode}><span>Mã thiết bị quản trị</span><strong>{access.deviceCode}</strong></div> : null}
    <button className={styles.primary} type="button" disabled={busy} onClick={retry}>{busy ? "Đang kiểm tra…" : "Kiểm tra lại"}</button>
  </section></main>;
}

export default function HealthControlCenterV2({ user }: { user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [bootstrap, setBootstrap] = useState<AdminBootstrap | null>(null);
  const [controlStatus, setControlStatus] = useState<HealthControlStatus | null>(null);
  const [policy, setPolicy] = useState<HealthPolicy | null>(null);
  const [policyDraft, setPolicyDraft] = useState<HealthPolicy | null>(null);
  const [devices, setDevices] = useState<HealthDevice[]>([]);
  const [sessions, setSessions] = useState<HealthSession[]>([]);
  const [audit, setAudit] = useState<HealthAudit[]>([]);
  const [versions, setVersions] = useState<HealthVersion[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>("all");
  const [selectedId, setSelectedId] = useState("");
  const [currentSection, setCurrentSection] = useState<unknown>(null);
  const [proposedSection, setProposedSection] = useState<unknown>(null);
  const [scopeLabel, setScopeLabel] = useState("");
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function applyDevices(list: HealthDevice[]) {
    setDevices(list);
    setLabels(Object.fromEntries(list.map((device) => [device.deviceId, device.label ?? ""])));
  }

  async function connectFresh() {
    const result = await connectAdminDevice("child-health");
    setAccess(result.access);
    setBootstrap(result.bootstrap);
    if (result.access.status !== "approved" || !result.bootstrap) throw new Error("Thiết bị quản trị chưa được cấp quyền.");
    return { access: result.access, bootstrap: result.bootstrap, bridge: bridgeForApplication(result.bootstrap) };
  }

  async function usableBridge(force = false): Promise<ApplicationBridge> {
    if (!force && bootstrap) {
      const current = bridgeForApplication(bootstrap);
      if (current.expiresAt > Date.now() + 15_000) return current;
    }
    return (await connectFresh()).bridge;
  }

  async function loadOperations(bridge: ApplicationBridge, role: ControlRole) {
    const [statusData, deviceData, sessionData, policyData] = await Promise.all([
      upstreamJson<HealthControlStatus>(bridge, "/api/control/status"),
      upstreamJson<DeviceData>(bridge, "/api/control/devices"),
      upstreamJson<SessionData>(bridge, "/api/control/sessions"),
      upstreamJson<PolicyData>(bridge, "/api/control/policy"),
    ]);
    setControlStatus(statusData);
    applyDevices(deviceData.devices ?? []);
    setSessions(sessionData.sessions ?? []);
    setPolicy(policyData.policy);
    setPolicyDraft(policyData.policy);
    if (canReview(role)) {
      const [auditData, contentData] = await Promise.all([
        upstreamJson<AuditData>(bridge, "/api/control/audit"),
        upstreamJson<ContentData>(bridge, "/api/control/health-content"),
      ]);
      setAudit(auditData.audit ?? []);
      setVersions(contentData.versions ?? []);
    } else {
      setAudit([]);
      setVersions([]);
    }
  }

  async function initialize() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await connectFresh();
      await loadOperations(result.bridge, result.access.role);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể mở Control Plane Sức khỏe Y tế.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void initialize(); }, []);

  const counts = useMemo(() => ({
    pending: devices.filter((item) => item.status === "pending").length,
    online: devices.filter((item) => item.active).length,
    unnamed: devices.filter((item) => !item.label?.trim()).length,
    desktop: devices.filter((item) => item.deviceType === "desktop").length,
    phone: devices.filter((item) => item.deviceType === "phone").length,
    tablet: devices.filter((item) => item.deviceType === "tablet").length,
    lowConfidence: devices.filter((item) => item.classificationConfidence === "low").length,
    attention: devices.filter((item) => item.environmentChanged || item.classificationConfidence === "low").length,
    overridden: devices.filter((item) => item.deviceTypeOverride != null).length,
    calendar: devices.filter((item) => item.calendarEnabled).length,
    edit: devices.filter((item) => item.editEnabled).length,
    activeSessions: sessions.filter((item) => item.active).length,
    review: versions.filter((item) => item.status === "permission_requested" || item.status === "review").length,
  }), [devices, sessions, versions]);

  const query = search.trim().toLocaleLowerCase("vi");
  const visibleDevices = devices.filter((device) => {
    const matchesFilter = deviceFilter === "all" ? true
      : deviceFilter === "unnamed" ? !device.label?.trim()
      : deviceFilter === "attention" ? device.environmentChanged || device.classificationConfidence === "low"
      : deviceFilter === "desktop" || deviceFilter === "phone" || deviceFilter === "tablet" ? device.deviceType === deviceFilter
      : device.status === deviceFilter;
    if (!matchesFilter) return false;
    if (!query) return true;
    return [
      device.label,
      device.autoLabel,
      device.deviceCode,
      device.platform,
      device.osName,
      device.browser,
      device.browserVersion,
      device.installationId,
      device.deviceTypeOverrideBy,
      device.environmentChangeReason,
      device.timezone,
      deviceTypeLabels[device.deviceType],
      deviceConfidenceLabels[device.classificationConfidence],
    ].filter(Boolean).join(" ").toLocaleLowerCase("vi").includes(query);
  });

  const reviewVersions = versions.filter((item) => ["permission_requested", "review", "changes_requested"].includes(item.status));
  const selected = versions.find((item) => item.id === selectedId) ?? null;
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Tổng quan" },
    { id: "devices", label: "Thiết bị & quyền" },
    { id: "sessions", label: "Phiên truy cập" },
    { id: "policy", label: "Chính sách" },
    ...(access && canReview(access.role) ? [{ id: "audit" as Tab, label: "Nhật ký" }, { id: "review" as Tab, label: "Duyệt nội dung" }, { id: "versions" as Tab, label: "Phiên bản" }] : []),
  ];

  async function refreshOperations() {
    if (!access) return;
    const bridge = await usableBridge();
    await loadOperations(bridge, access.role);
  }

  async function deviceAction(device: HealthDevice, action: string, extra: Record<string, unknown> = {}) {
    const capabilities = controlStatus?.capabilities ?? [];
    const supportsDeviceReview = capabilities.includes("device-review-v1") || (capabilities.length === 0 && (controlStatus?.contractVersion ?? 0) >= 3);
    if (["set-device-type", "clear-device-type", "ack-environment"].includes(action) && !supportsDeviceReview) {
      setError("Health_Care production chưa công bố capability device-review-v1. Chức năng này sẽ tự mở khi backend Health tương thích được deploy.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const bridge = await usableBridge();
      const body: Record<string, unknown> = { action, deviceId: device.deviceId, ...extra };
      if (action === "label") body.label = labels[device.deviceId] ?? "";
      const data = await upstreamJson<DeviceData>(bridge, "/api/control/devices", { method: "POST", body });
      applyDevices(data.devices ?? []);
      await refreshOperations();
      setNotice(action === "approve" ? "Đã cấp quyền truy cập thiết bị."
        : action === "block" ? "Đã khóa thiết bị và thu hồi các phiên đang hoạt động."
        : action === "unblock" ? "Đã mở khóa thiết bị."
        : action === "enable-edit" ? "Đã cấp quyền sửa."
        : action === "disable-edit" ? "Đã thu quyền sửa."
        : action === "enable-calendar" ? "Đã cấp Google Calendar."
        : action === "disable-calendar" ? "Đã thu Google Calendar."
        : action === "set-device-type" ? "Đã lưu phân loại thủ công. Hệ thống vẫn giữ kết quả tự nhận diện để đối chiếu."
        : action === "clear-device-type" ? "Đã trả loại thiết bị về kết quả tự động."
        : action === "ack-environment" ? "Đã xác nhận kiểm tra thay đổi môi trường thiết bị."
        : "Đã lưu tên gợi nhớ.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị.");
    } finally { setBusy(false); }
  }

  async function sessionAction(action: "revoke-session" | "revoke-device-sessions", session: HealthSession) {
    setBusy(true); setError(""); setNotice("");
    try {
      const bridge = await usableBridge();
      const body = action === "revoke-session"
        ? { action, sessionId: session.sessionId, reason: "Thu hồi thủ công từ Trung tâm Quản trị" }
        : { action, deviceId: session.deviceId, reason: "Thu hồi toàn bộ phiên của thiết bị từ Trung tâm Quản trị" };
      const data = await upstreamJson<SessionData>(bridge, "/api/control/sessions", { method: "POST", body });
      setSessions(data.sessions ?? []);
      await refreshOperations();
      setNotice(action === "revoke-session" ? "Đã thu hồi phiên truy cập." : "Đã thu hồi toàn bộ phiên của thiết bị.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể thu hồi phiên.");
    } finally { setBusy(false); }
  }

  async function savePolicy() {
    if (!policyDraft || !access || !canOwn(access.role)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const bridge = await usableBridge();
      const data = await upstreamJson<PolicyData>(bridge, "/api/control/policy", {
        method: "POST",
        body: {
          accessEnabled: policyDraft.accessEnabled,
          pendingPollSeconds: policyDraft.pendingPollSeconds,
          heartbeatSeconds: policyDraft.heartbeatSeconds,
          sessionTimeoutSeconds: policyDraft.sessionTimeoutSeconds,
          sessionTtlMinutes: policyDraft.sessionTtlMinutes,
          systemNoticeEnabled: policyDraft.systemNoticeEnabled,
          systemNotice: policyDraft.systemNotice ?? "",
        },
      });
      setPolicy(data.policy); setPolicyDraft(data.policy);
      await refreshOperations();
      setNotice("Đã áp dụng chính sách mới cho Sức khỏe Y tế.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể lưu chính sách.");
    } finally { setBusy(false); }
  }

  async function selectVersion(id: string) {
    setBusy(true); setError(""); setSelectedId(id);
    try {
      const bridge = await usableBridge();
      const data = await upstreamJson<ContentData>(bridge, "/api/control/health-content", { query: `?versionId=${encodeURIComponent(id)}` });
      setVersions(data.versions ?? []);
      setCurrentSection(data.currentSection ?? null);
      setProposedSection(data.proposedSection ?? null);
      setScopeLabel(data.editScope?.label ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải phiên bản.");
    } finally { setBusy(false); }
  }

  async function contentAction(action: string, success: string, id = selectedId) {
    if (!id) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const bridge = await usableBridge();
      const data = await upstreamJson<ContentData>(bridge, "/api/control/health-content", { method: "POST", body: { action, versionId: id, note } });
      setVersions(data.versions ?? []);
      setNotice(success); setNote("");
      if (data.versionId) setSelectedId(data.versionId);
      if (["approve-publish", "rollback", "cancel", "deny-edit"].includes(action)) {
        setCurrentSection(null); setProposedSection(null); setScopeLabel("");
      } else if (data.versionId ?? id) await selectVersion(data.versionId ?? id);
      await refreshOperations();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể thực hiện thao tác nội dung.");
    } finally { setBusy(false); }
  }

  async function openEditor() {
    setError("");
    try {
      const bridge = await usableBridge(true);
      window.open(`${bridge.baseUrl}/api/editor/session?ticket=${encodeURIComponent(bridge.token)}`, "_blank", "noopener,noreferrer");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể mở trình biên tập."); }
  }

  if (!access || access.status !== "approved" || !bootstrap) return <Gate access={access} busy={busy} error={error} retry={() => void initialize()} />;
  const appBridge = bridgeForApplication(bootstrap);
  const healthCapabilities = controlStatus?.capabilities ?? [];
  const deviceReviewSupported = healthCapabilities.includes("device-review-v1") || (healthCapabilities.length === 0 && (controlStatus?.contractVersion ?? 0) >= 3);
  const canonicalHealthId = controlStatus?.canonicalApplication ?? "suc-khoe-y-te";

  return <main className={styles.shell}><div className={styles.frame}>
    <Link href="/" className={styles.back}>← Trung tâm quản trị ứng dụng</Link>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>Ứng dụng độc lập · Control Plane v2</span><h1>Sức khỏe Y tế</h1><p>Trung tâm chỉ quản trị thiết bị, quyền, phiên, chính sách và quy trình nội dung. Hồ sơ sức khỏe cá nhân không đi qua Control Plane.</p></div>
      <div className={styles.headerActions}>
        <a className={styles.secondary} href={`${appBridge.baseUrl}/suc-khoe-tre`} target="_blank" rel="noreferrer">Mở Web App</a>
        {canReview(access.role) ? <button className={styles.secondary} type="button" onClick={() => void openEditor()}>Mở trình biên tập</button> : null}
        <button className={styles.primary} type="button" disabled={busy} onClick={() => void initialize()}>Cập nhật</button>
      </div>
    </header>

    <section className={styles.boundary}><strong>Ranh giới bắt buộc:</strong><span>SK device / access / policy / audit thuộc Control Plane; số đo, nhật ký, dinh dưỡng, vận động và hồ sơ cá nhân thuộc riêng Web App.</span></section>
    {error ? <div className={styles.error}>{error}</div> : null}
    {notice ? <div className={styles.notice}>{notice}</div> : null}

    <section className={styles.summary}>
      <article><span>Dịch vụ</span><strong className={controlStatus?.service === "paused" ? styles.paused : styles.online}>{controlStatus?.service === "paused" ? "Tạm dừng" : "Online"}</strong><small>{canonicalHealthId} · Contract v{controlStatus?.contractVersion ?? "—"}</small></article>
      <article><span>Chờ duyệt</span><strong>{counts.pending}</strong><small>Thiết bị SK mới</small></article>
      <article><span>Đang online</span><strong>{counts.online}</strong><small>{counts.activeSessions} phiên còn tín hiệu</small></article>
      <article><span>Quyền tính năng</span><strong>{counts.edit}/{counts.calendar}</strong><small>Sửa / Calendar</small></article>
      <article><span>Phân loại thiết bị</span><strong>{devices.length}</strong><small>PC {counts.desktop} · Phone {counts.phone} · Tablet {counts.tablet} · Cần xem {counts.attention}</small></article>
    </section>

    <nav className={styles.tabs}>{tabs.map((item) => <button type="button" key={item.id} className={tab === item.id ? styles.activeTab : styles.tab} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>

    {tab === "overview" ? <section className={styles.panel}>
      <div className={styles.panelHead}><div><span className={styles.eyebrow}>Kết nối hai hệ thống</span><h2>Trạng thái Control Plane</h2><p>Đây là lớp kết nối, không phải dashboard sức khỏe của trẻ. Danh tính chuẩn: {canonicalHealthId}; alias kỹ thuật cũ vẫn được giữ để tương thích.</p></div><div className={styles.actor}><strong>{user.displayName}</strong><small>{roleLabels[access.role]} · {access.deviceCode}</small></div></div>
      <div className={styles.statusGrid}>
        <article><span>Thiết bị</span><strong>{controlStatus?.devices.total ?? devices.length}</strong><small>{controlStatus?.devices.approved ?? 0} được cấp · {controlStatus?.devices.blocked ?? 0} khóa</small></article>
        <article><span>Phiên truy cập</span><strong>{controlStatus?.sessions.active ?? counts.activeSessions}</strong><small>{controlStatus?.sessions.revoked ?? 0} thu hồi · {controlStatus?.sessions.expired ?? 0} hết hạn</small></article>
        <article><span>Heartbeat</span><strong>{policy?.heartbeatSeconds ?? 60}s</strong><small>Offline sau {policy?.sessionTimeoutSeconds ?? 180}s không tín hiệu</small></article>
        <article><span>Vé quản trị</span><strong>5 phút</strong><small>Gắn app + quản trị viên + thiết bị quản trị</small></article>
      </div>
      {policy?.systemNoticeEnabled && policy.systemNotice ? <div className={styles.systemNotice}><strong>Thông báo đang phát tới Web App</strong><span>{policy.systemNotice}</span></div> : null}
      <div className={styles.quickActions}><button type="button" className={styles.primary} onClick={() => setTab("devices")}>Thiết bị & quyền</button><button type="button" className={styles.secondary} onClick={() => setTab("sessions")}>Phiên truy cập</button><button type="button" className={styles.secondary} onClick={() => setTab("policy")}>Chính sách</button>{canReview(access.role) ? <button type="button" className={styles.secondary} onClick={() => setTab("audit")}>Nhật ký</button> : null}</div>
    </section> : null}

    {tab === "devices" ? <section className={styles.panel}>
      <div className={styles.panelHead}><div><span className={styles.eyebrow}>Thiết bị đầu vào · tự động</span><h2>Nhận diện, phân loại và cấp quyền</h2><p>Health_Care tự nhận diện Máy tính / Điện thoại / Máy tính bảng trước khi thiết bị xuất hiện tại đây. Phân loại chỉ hỗ trợ quản trị; quyền truy cập vẫn phải được cấp riêng.</p></div><strong>{deviceReviewSupported ? (counts.attention ? `${counts.attention} thiết bị cần kiểm tra` : `Ổn định · ${counts.overridden} chỉnh thủ công`) : `Contract v${controlStatus?.contractVersion ?? "—"} · chờ capability device-review-v1`}</strong></div>
      <div className={styles.searchRow}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, mã SK, OS, trình duyệt hoặc Installation ID…" /><span>{visibleDevices.length}/{devices.length}</span></div>
      <div className={styles.filters}>{([['all','Tất cả'],['pending','Chờ duyệt'],['approved','Được truy cập'],['blocked','Đã khóa'],['unnamed','Chưa đặt tên'],['attention','Cần kiểm tra'],['desktop','Máy tính'],['phone','Điện thoại'],['tablet','Tablet/iPad']] as const).map(([id,label]) => <button type="button" key={id} data-active={deviceFilter === id} onClick={() => setDeviceFilter(id)}>{label}</button>)}</div>
      <div className={styles.deviceList}>{visibleDevices.map((device) => <article className={device.status === "pending" ? styles.pendingDevice : styles.device} key={device.deviceId}>
        <div className={styles.deviceIdentity}><div><strong>{device.label || device.autoLabel || device.deviceCode}</strong><span>{deviceTypeLabels[device.deviceType]} · {device.deviceTypeOverride ? "Đã chỉnh thủ công" : "Tự động"} · {deviceConfidenceLabels[device.classificationConfidence]}</span></div><small>{device.deviceCode} · {device.osName || device.platform || "Hệ điều hành chưa rõ"} · {device.browser || "Trình duyệt chưa rõ"}{device.browserVersion ? ` ${device.browserVersion}` : ""}</small><small>{screenLabel(device)} · Cảm ứng {device.touchPoints ?? 0} điểm · PWA {device.pwaMode ? "Có" : "Không"} · Installation {shortInstallation(device.installationId)}</small><small>Cơ sở phân loại: {deviceReasonLabels[device.classificationReason || ""] || device.classificationReason || "Chưa có"}{device.metadataUpdatedAt ? ` · cập nhật ${formatDate(device.metadataUpdatedAt)}` : ""}</small>{device.deviceTypeOverride ? <small>Đối chiếu tự động: {deviceTypeLabels[device.detectedDeviceType]} · chỉnh bởi {device.deviceTypeOverrideBy || "quản trị"} {device.deviceTypeOverrideAt ? `· ${formatDate(device.deviceTypeOverrideAt)}` : ""}</small> : null}{device.environmentChanged ? <small>⚠ Cần kiểm tra: {device.environmentChangeReason || "Môi trường thiết bị đã thay đổi đáng kể."}</small> : null}<div className={styles.labelRow}><input value={labels[device.deviceId] ?? ""} maxLength={80} disabled={!canPublish(access.role)} onChange={(event) => setLabels((current) => ({ ...current, [device.deviceId]: event.target.value }))} placeholder="Tên gợi nhớ, ví dụ: Laptop của Nam" /><button type="button" disabled={busy || !canPublish(access.role)} onClick={() => void deviceAction(device, "label")}>Lưu tên</button></div>{deviceReviewSupported ? <div className={styles.labelRow}><select value={device.deviceTypeOverride ?? ""} disabled={busy || !canPublish(access.role)} onChange={(event) => { const next = event.target.value; void deviceAction(device, next ? "set-device-type" : "clear-device-type", next ? { deviceType: next } : {}); }}><option value="">Theo tự động ({deviceTypeLabels[device.detectedDeviceType]})</option><option value="desktop">Máy tính</option><option value="phone">Điện thoại</option><option value="tablet">Máy tính bảng / iPad</option></select>{device.environmentChanged ? <button type="button" disabled={busy || !canPublish(access.role)} onClick={() => void deviceAction(device, "ack-environment")}>Đã kiểm tra</button> : <span />}</div> : <small>Phân loại thủ công và xác nhận cảnh báo sẽ mở khi Health_Care production công bố capability device-review-v1.</small>}</div>
        <div className={styles.deviceFacts}><span>Truy cập</span><strong>{deviceStatusLabels[device.status]}</strong><small>{device.active ? "Online" : `Cuối ${formatDate(device.lastSeenAt)}`}</small></div>
        <div className={styles.deviceFacts}><span>Tính năng</span><strong>Sửa: {device.editEnabled ? "Có" : "Không"}</strong><small>Calendar: {device.calendarEnabled ? "Có" : "Khóa"}</small></div>
        <div className={styles.rowActions}>{canPublish(access.role) ? <>{device.status === "pending" ? <button className={styles.primary} type="button" disabled={busy} onClick={() => void deviceAction(device, "approve")}>Cấp truy cập</button> : null}{device.status === "approved" ? <><button type="button" disabled={busy} onClick={() => void deviceAction(device, device.editEnabled ? "disable-edit" : "enable-edit")}>{device.editEnabled ? "Thu quyền sửa" : "Cấp quyền sửa"}</button><button type="button" disabled={busy} onClick={() => void deviceAction(device, device.calendarEnabled ? "disable-calendar" : "enable-calendar")}>{device.calendarEnabled ? "Khóa Calendar" : "Cấp Calendar"}</button><button className={styles.danger} type="button" disabled={busy} onClick={() => void deviceAction(device, "block")}>Khóa</button></> : null}{device.status === "blocked" ? <button type="button" disabled={busy} onClick={() => void deviceAction(device, "unblock")}>Mở khóa</button> : null}</> : <small>Chỉ xem</small>}</div>
      </article>)}{visibleDevices.length === 0 ? <div className={styles.empty}>Không có thiết bị phù hợp.</div> : null}</div>
    </section> : null}

    {tab === "sessions" ? <section className={styles.panel}>
      <div className={styles.panelHead}><div><span className={styles.eyebrow}>Phiên thực</span><h2>Phiên truy cập Web App</h2><p>Mỗi lần mở nội dung sau khi xác thực thiết bị tạo một phiên có TTL riêng. Thu hồi phiên sẽ làm Web App đóng nội dung ở heartbeat kế tiếp.</p></div><strong>{counts.activeSessions} active</strong></div>
      <div className={styles.sessionList}>{sessions.map((session) => <article key={session.sessionId} className={styles.session}>
        <div><span className={styles.sessionState} data-state={session.status}>{sessionStatusLabels[session.status]}{session.active ? " · online" : ""}</span><strong>{session.deviceLabel || session.deviceCode}</strong><small>{session.deviceCode} · {deviceTypeLabels[session.deviceType]} · session {shortSession(session.sessionId)}</small></div>
        <div className={styles.sessionTimes}><span>Bắt đầu <strong>{formatDate(session.startedAt)}</strong></span><span>Tín hiệu cuối <strong>{formatDate(session.lastSeenAt)}</strong></span><span>Hết hạn <strong>{formatEpoch(session.expiresAt)}</strong></span></div>
        <div className={styles.rowActions}>{session.status === "active" && canPublish(access.role) ? <><button type="button" className={styles.danger} disabled={busy} onClick={() => void sessionAction("revoke-session", session)}>Thu hồi phiên</button><button type="button" disabled={busy} onClick={() => void sessionAction("revoke-device-sessions", session)}>Thu mọi phiên thiết bị</button></> : session.revokeReason ? <small>{session.revokeReason}</small> : null}</div>
      </article>)}{sessions.length === 0 ? <div className={styles.empty}>Chưa có phiên truy cập.</div> : null}</div>
    </section> : null}

    {tab === "policy" && policyDraft ? <section className={styles.panel}>
      <div className={styles.panelHead}><div><span className={styles.eyebrow}>Policy từ xa</span><h2>Chính sách truy cập Sức khỏe Y tế</h2><p>Chỉ chủ hệ thống được thay đổi. Policy không chứa dữ liệu sức khỏe cá nhân.</p></div><div className={styles.policyState} data-enabled={policyDraft.accessEnabled}>{policyDraft.accessEnabled ? "Cho phép truy cập" : "Đang tạm dừng"}</div></div>
      <div className={styles.policyGrid}>
        <label className={styles.toggleRow}><span><strong>Cho phép mở Web App</strong><small>Tắt sẽ khóa nội dung ở lần xác thực/heartbeat kế tiếp.</small></span><input type="checkbox" checked={policyDraft.accessEnabled} disabled={!canOwn(access.role)} onChange={(event) => setPolicyDraft({ ...policyDraft, accessEnabled: event.target.checked })} /></label>
        <label><span>Kiểm tra thiết bị chờ (giây)</span><input type="number" min={15} max={300} value={policyDraft.pendingPollSeconds} disabled={!canOwn(access.role)} onChange={(event) => setPolicyDraft({ ...policyDraft, pendingPollSeconds: Number(event.target.value) })} /></label>
        <label><span>Heartbeat (giây)</span><input type="number" min={30} max={300} value={policyDraft.heartbeatSeconds} disabled={!canOwn(access.role)} onChange={(event) => setPolicyDraft({ ...policyDraft, heartbeatSeconds: Number(event.target.value) })} /></label>
        <label><span>Ngưỡng offline (giây)</span><input type="number" min={60} max={1800} value={policyDraft.sessionTimeoutSeconds} disabled={!canOwn(access.role)} onChange={(event) => setPolicyDraft({ ...policyDraft, sessionTimeoutSeconds: Number(event.target.value) })} /></label>
        <label><span>TTL phiên (phút)</span><input type="number" min={30} max={10080} value={policyDraft.sessionTtlMinutes} disabled={!canOwn(access.role)} onChange={(event) => setPolicyDraft({ ...policyDraft, sessionTtlMinutes: Number(event.target.value) })} /></label>
        <label className={styles.toggleRow}><span><strong>Phát thông báo hệ thống</strong><small>Chỉ là thông báo vận hành, không phải dữ liệu sức khỏe.</small></span><input type="checkbox" checked={policyDraft.systemNoticeEnabled} disabled={!canOwn(access.role)} onChange={(event) => setPolicyDraft({ ...policyDraft, systemNoticeEnabled: event.target.checked })} /></label>
        <label className={styles.noticeField}><span>Nội dung thông báo</span><textarea maxLength={280} value={policyDraft.systemNotice ?? ""} disabled={!canOwn(access.role)} onChange={(event) => setPolicyDraft({ ...policyDraft, systemNotice: event.target.value })} placeholder="Ví dụ: Hệ thống bảo trì lúc 22:00…" /></label>
      </div>
      <div className={styles.policyFooter}><small>Cập nhật cuối: {formatDate(policy.updatedAt)} · {policy.updatedBy || "system"}</small>{canOwn(access.role) ? <button type="button" className={styles.primary} disabled={busy} onClick={() => void savePolicy()}>Lưu & áp dụng</button> : <span>Chỉ chủ hệ thống được sửa</span>}</div>
    </section> : null}

    {tab === "audit" && canReview(access.role) ? <section className={styles.panel}>
      <div className={styles.panelHead}><div><span className={styles.eyebrow}>Audit ứng dụng</span><h2>Nhật ký điều khiển Sức khỏe Y tế</h2><p>Chỉ ghi hành động vận hành: thiết bị, quyền, policy, phiên và quy trình nội dung.</p></div><strong>{audit.length} sự kiện</strong></div>
      <div className={styles.auditList}>{audit.map((entry) => <article key={entry.id}><div><strong>{auditLabels[entry.action] || entry.action}</strong><small>{entry.actor}</small></div><div><span>{entry.target}</span><small>{formatDate(entry.createdAt)}</small></div></article>)}{audit.length === 0 ? <div className={styles.empty}>Chưa có sự kiện audit.</div> : null}</div>
    </section> : null}

    {tab === "review" && canReview(access.role) ? <section className={styles.panel}>
      <div className={styles.panelHead}><div><span className={styles.eyebrow}>Kiểm duyệt riêng</span><h2>Yêu cầu chỉnh sửa nội dung</h2><p>Không liên quan đến hồ sơ sức khỏe cá nhân của người dùng.</p></div><strong>{reviewVersions.length} việc</strong></div>
      <div className={styles.versionList}>{reviewVersions.map((version) => <button type="button" key={version.id} data-active={selectedId === version.id} onClick={() => void selectVersion(version.id)}><span>{statusLabels[version.status]}</span><span><strong>V{version.version_number} · {version.edit_scope_label ?? version.edit_scope ?? "Nội dung"}</strong><small>{version.created_by} · {formatDate(version.updated_at)}</small></span><span>{version.editor_device_code ?? "—"}</span></button>)}{reviewVersions.length === 0 ? <div className={styles.empty}>Không có yêu cầu chờ xử lý.</div> : null}</div>
      {selected ? <><div className={styles.reviewGrid}><article><h3>Bản đang xuất bản {scopeLabel ? `· ${scopeLabel}` : ""}</h3><pre>{currentSection == null ? "Chưa có dữ liệu đối chiếu." : JSON.stringify(currentSection, null, 2)}</pre></article><article><h3>Bản đề xuất</h3><pre>{proposedSection == null ? "Chưa có nội dung đề xuất." : JSON.stringify(proposedSection, null, 2)}</pre></article></div><textarea className={styles.reviewNote} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Ghi chú kiểm duyệt…" /><div className={styles.quickActions}>{selected.status === "permission_requested" ? <><button className={styles.primary} type="button" disabled={busy} onClick={() => void contentAction("approve-edit", "Đã cho phép chỉnh sửa.")}>Cho phép sửa</button><button className={styles.danger} type="button" disabled={busy} onClick={() => void contentAction("deny-edit", "Đã từ chối yêu cầu.")}>Từ chối</button></> : null}{selected.status === "review" ? <button type="button" className={styles.secondary} disabled={busy} onClick={() => void contentAction("request-changes", "Đã yêu cầu sửa lại.")}>Yêu cầu sửa lại</button> : null}{selected.status === "review" && canPublish(access.role) ? <button type="button" className={styles.primary} disabled={busy || selected.created_by === access.email} onClick={() => void contentAction("approve-publish", "Đã phê duyệt và xuất bản.")}>Phê duyệt & xuất bản</button> : null}{["permission_requested", "draft", "changes_requested", "review"].includes(selected.status) ? <button type="button" className={styles.danger} disabled={busy} onClick={() => void contentAction("cancel", "Đã hủy phiên bản.")}>Hủy</button> : null}</div></> : null}
    </section> : null}

    {tab === "versions" && canReview(access.role) ? <section className={styles.panel}>
      <div className={styles.panelHead}><div><span className={styles.eyebrow}>Lịch sử nội dung</span><h2>Phiên bản đã tạo</h2><p>Rollback chỉ dành cho người có quyền xuất bản.</p></div></div>
      <div className={styles.versionList}>{versions.map((version) => <article className={styles.versionArticle} key={version.id}><span>{statusLabels[version.status]}</span><span><strong>V{version.version_number} · {version.summary || version.edit_scope_label || "Sức khỏe Y tế"}</strong><small>{version.created_by} · {formatDate(version.updated_at)}</small></span><span>{canPublish(access.role) && ["archived", "published"].includes(version.status) ? <button type="button" disabled={busy || version.status === "published"} onClick={() => void contentAction("rollback", `Đã khôi phục từ V${version.version_number}.`, version.id)}>Khôi phục</button> : formatDate(version.published_at)}</span></article>)}</div>
    </section> : null}
  </div></main>;
}
