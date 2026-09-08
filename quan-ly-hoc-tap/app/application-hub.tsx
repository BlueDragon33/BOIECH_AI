"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { applicationRegistry } from "./application-registry";
import {
  centerAdminAction,
  connectAdminCenter,
  roleLabels,
  type AdminAccess,
  type ApplicationDescriptor,
  type CenterBootstrap,
  type ControlAdminDevice,
  type ControlRole,
} from "./admin-device-client";
import styles from "./center-admin.module.css";

type CenterView = "overview" | "inbox" | "applications" | "client-devices" | "alerts" | "devices" | "audit" | "settings";
type ConnectionState = "connected" | "warning" | "pending" | "unavailable";

type ClientEntry = {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  href: string | null;
  status: "online" | "warning" | "planned";
  group: string;
  boundary: string;
  scope: string;
};

type ClientRow = {
  client: ClientEntry;
  descriptor?: ApplicationDescriptor;
  state: ConnectionState;
  pending: number | null;
  active: number | null;
};

type WorkItem = {
  id: string;
  client: ClientEntry;
  title: string;
  detail: string;
  state: "high" | "normal" | "info";
  count?: number | null;
};

const controlClient: ClientEntry = {
  id: "control-plane",
  name: "Application Management",
  shortName: "Application Management",
  icon: "QT",
  href: null,
  status: "online",
  group: "Hệ thống",
  boundary: "Thiết bị quản trị Trung tâm",
  scope: "Thiết bị QT mới đang chờ owner xử lý.",
};

const futureClients: readonly ClientEntry[] = [
  {
    id: "ru-life",
    name: "Hòa nhập Nga",
    shortName: "Hòa nhập Nga",
    icon: "HN",
    href: null,
    status: "planned",
    group: "Nga",
    boundary: "Thiết bị HN · OCR thuốc · đối chiếu quy định · audit Nga",
    scope: "Client độc lập; production hiện tại chưa có adapter Hòa nhập Nga nên Trung tâm không dựng thao tác giả.",
  },
  {
    id: "growup-mychildren",
    name: "GrowUP MyChildren",
    shortName: "GrowUP",
    icon: "GU",
    href: null,
    status: "planned",
    group: "Gia đình",
    boundary: "Phát triển 3–18 tuổi · privacy-first · contract GU",
    scope: "Client độc lập; production hiện tại chưa có admin backend GrowUP nên chỉ hiển thị trạng thái contract.",
  },
];

const clients: readonly ClientEntry[] = [
  ...applicationRegistry.map((application) => ({
    id: application.id,
    name: application.name,
    shortName: application.shortName,
    icon: application.icon,
    href: application.href,
    status: application.status,
    group: application.id === "boi-ech" ? "Học tập" : application.id === "child-health" ? "Y tế" : "Học thuật",
    boundary: application.id === "boi-ech"
      ? "Thiết bị học · tiến độ · AI · thanh toán · duyệt sửa"
      : application.id === "child-health"
        ? "Thiết bị SK · policy · session · kiểm duyệt y tế"
        : "Bauman Hub · lộ trình · môn học · contract BM",
    scope: application.scope,
  })),
  ...futureClients,
];

const viewTitles: Record<CenterView, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "CONTROL PLANE · OPERATIONS", title: "Bảng điều phối quản trị ứng dụng", description: "Kiểm soát tập trung các client độc lập, cảnh báo thiết bị mới và điều phối đúng khu kiểm duyệt của từng ứng dụng." },
  inbox: { eyebrow: "PRIORITY INBOX", title: "Hộp việc ưu tiên", description: "Tập trung các việc đang chờ xử lý từ control-plane và những client production hiện có." },
  applications: { eyebrow: "CLIENT REGISTRY", title: "Ứng dụng đang quản lý", description: "Một hàng cho mỗi client để tìm nhanh khi hệ thống tăng số lượng ứng dụng." },
  "client-devices": { eyebrow: "CLIENT DEVICE ALERTS", title: "Thiết bị mới theo ứng dụng", description: "Trung tâm chỉ đọc trạng thái mà client chủ động trả về; registry thiết bị vẫn thuộc từng ứng dụng." },
  alerts: { eyebrow: "OPERATIONS ALERTS", title: "Cảnh báo vận hành", description: "Tập trung client mất kết nối, contract chưa hoàn tất và việc cần can thiệp nhanh." },
  devices: { eyebrow: "CONTROL ACCESS", title: "Thiết bị quản trị Trung tâm", description: "Chỉ chứa thiết bị QT của Application Management; không trộn thiết bị người dùng của client." },
  audit: { eyebrow: "SYSTEM AUDIT", title: "Nhật ký hệ thống", description: "Audit quyền và bảo mật control-plane. Audit nghiệp vụ vẫn thuộc khu quản trị riêng của từng client." },
  settings: { eyebrow: "SYSTEM BOUNDARY", title: "Cấu hình & ranh giới", description: "Server → Client → Sub-client → Endpoint. Mỗi tầng sở hữu dữ liệu và thiết bị của chính mình." },
};

const deviceStatusLabels = { pending: "Chờ duyệt", approved: "Đã cấp quyền", blocked: "Đã khóa" } as const;
const memberStatusLabels = { active: "Tài khoản hoạt động", inactive: "Đã thu hồi tài khoản", unregistered: "Chưa cấp tài khoản" } as const;
const auditLabels: Record<string, string> = {
  control_device_approved: "Cấp quyền thiết bị quản trị",
  control_device_blocked: "Khóa thiết bị quản trị",
  control_member_deactivated: "Thu hồi tài khoản quản trị",
  control_member_deleted: "Xóa tài khoản quản trị",
};

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function descriptorFor(bootstrap: CenterBootstrap, id: string) {
  return bootstrap.applications.find((application) => application.id === id);
}

function connectionState(client: ClientEntry, descriptor?: ApplicationDescriptor): ConnectionState {
  const runtime = descriptor?.runtime;
  if (runtime?.service === "unreachable" || runtime?.connectionState === "unreachable") return "unavailable";
  if (runtime?.service === "paused" || runtime?.connectionState === "paused" || runtime?.connectionState === "legacy") return "warning";
  if (descriptor?.status === "warning") return "warning";
  if (descriptor?.status === "online" || runtime?.service === "online" || runtime?.ready) return "connected";
  if (client.status === "planned" || descriptor?.status === "planned") return "pending";
  return "warning";
}

function stateLabel(state: ConnectionState) {
  return state === "connected" ? "Kết nối tốt" : state === "unavailable" ? "Không đọc được" : state === "pending" ? "Chờ backend" : "Có cảnh báo";
}

function StatusDot({ state }: { state: ConnectionState }) {
  return <span className={styles.connectionState} data-state={state}><i />{stateLabel(state)}</span>;
}

function Gate({ access, busy, error, retry }: { access: AdminAccess | null; busy: boolean; error: string; retry: () => void }) {
  return <main className={styles.gateShell}><section className={styles.gateCard}>
    <div className={styles.gateMark}>QT</div><span className={styles.eyebrow}>SECURE CONTROL PLANE</span>
    <h1>{access?.status === "pending" ? "Thiết bị quản trị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Đang xác thực thiết bị quản trị…"}</h1>
    <p>{error || "Mỗi máy quản trị dùng khóa P-256 riêng. Trung tâm chỉ mở sau khi thiết bị và tài khoản đều được cấp quyền."}</p>
    {access?.deviceCode ? <div className={styles.gateCode}><span>Mã thiết bị</span><strong>{access.deviceCode}</strong></div> : null}
    <button className={styles.primaryButton} onClick={retry} disabled={busy}>{busy ? "Đang xác thực…" : "Kiểm tra lại quyền"}</button>
  </section></main>;
}

function SectionHeader({ title, meta, action }: { title: string; meta?: string; action?: React.ReactNode }) {
  return <header className={styles.sectionHeader}><div><h2>{title}</h2>{meta ? <span>{meta}</span> : null}</div>{action}</header>;
}

function DeviceRow({ device, actor, role, busy, run }: {
  device: ControlAdminDevice;
  actor: AdminAccess;
  role: ControlRole;
  busy: string;
  run: (device: ControlAdminDevice, operation: "approve" | "block" | "deactivate-member" | "delete-member", selectedRole?: "reviewer" | "publisher") => void;
}) {
  const [approvalRole, setApprovalRole] = useState<"reviewer" | "publisher">(device.role === "publisher" ? "publisher" : "reviewer");
  const protectedDevice = device.owner || device.deviceId === actor.deviceId;
  const isBusy = busy === device.deviceId;
  return <article className={styles.adminDeviceRow} data-status={device.status}>
    <span className={styles.presence} data-online={device.active ? "true" : "false"} />
    <div><strong>{device.displayName || device.email}</strong><small>{device.email}</small><code>{device.deviceCode}</code></div>
    <div><span>Trạng thái</span><strong>{deviceStatusLabels[device.status]}</strong><small>{memberStatusLabels[device.memberStatus]}</small></div>
    <div><span>Vai trò</span><strong>{roleLabels[device.role]}</strong><small>{device.active ? "Đang trực tuyến" : formatTime(device.lastSeenAt)}</small></div>
    <div className={styles.adminDeviceActions}>{protectedDevice ? <span className={styles.protected}>Owner · được bảo vệ</span> : device.status === "pending" ? <>
      <select value={approvalRole} onChange={(event) => setApprovalRole(event.target.value as "reviewer" | "publisher")} disabled={isBusy || role !== "owner"}><option value="reviewer">Kiểm duyệt viên</option><option value="publisher">Người xuất bản</option></select>
      <button disabled={isBusy || role !== "owner"} onClick={() => run(device, "approve", approvalRole)}>Cấp quyền</button><button className={styles.dangerButton} disabled={isBusy || role !== "owner"} onClick={() => run(device, "block")}>Từ chối</button>
    </> : device.memberStatus === "inactive" ? <button className={styles.dangerButton} disabled={isBusy || role !== "owner"} onClick={() => run(device, "delete-member")}>Xóa tài khoản</button> : <><button disabled={isBusy || role !== "owner" || device.status === "blocked"} onClick={() => run(device, "block")}>Khóa máy</button><button className={styles.dangerButton} disabled={isBusy || role !== "owner"} onClick={() => run(device, "deactivate-member")}>Thu hồi</button></>}</div>
  </article>;
}

export default function ApplicationHub({ user }: { user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [bootstrap, setBootstrap] = useState<CenterBootstrap | null>(null);
  const [view, setView] = useState<CenterView>("overview");
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [appFilter, setAppFilter] = useState("all");
  const [now, setNow] = useState<Date | null>(null);

  async function initialize() {
    setBusy(true); setError("");
    try {
      const result = await connectAdminCenter();
      setAccess(result.access); setBootstrap(result.bootstrap);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể mở Trung tâm quản trị.");
    } finally { setBusy(false); }
  }

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    const valid: CenterView[] = ["overview", "inbox", "applications", "client-devices", "alerts", "devices", "audit", "settings"];
    if (requested && valid.includes(requested as CenterView)) setView(requested as CenterView);
    if (requested === "topology") setView("settings");
    void initialize();
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function switchView(next: CenterView) {
    setView(next);
    window.history.replaceState(null, "", next === "overview" ? "/" : `/?view=${next}`);
  }

  const centralCounts = useMemo(() => {
    const devices = bootstrap?.controlDevices ?? [];
    return { total: devices.length, pending: devices.filter((item) => item.status === "pending").length, online: devices.filter((item) => item.active).length };
  }, [bootstrap?.controlDevices]);

  const visibleClients = useMemo(() => clients.filter((client) => {
    const normalized = search.trim().toLowerCase();
    return (appFilter === "all" || client.id === appFilter) && (!normalized || `${client.name} ${client.shortName} ${client.group} ${client.boundary} ${client.scope}`.toLowerCase().includes(normalized));
  }), [search, appFilter]);

  const clientRows = useMemo<ClientRow[]>(() => clients.map((client) => {
    const descriptor = bootstrap ? descriptorFor(bootstrap, client.id) : undefined;
    return { client, descriptor, state: connectionState(client, descriptor), pending: descriptor?.runtime?.pendingDevices ?? null, active: descriptor?.runtime?.activeSessions ?? null };
  }), [bootstrap]);

  const pendingClientDevices = clientRows.reduce((total, row) => total + (row.pending ?? 0), 0);
  const connectedClients = clientRows.filter((row) => row.state === "connected").length;
  const alertClients = clientRows.filter((row) => row.state === "warning" || row.state === "unavailable").length;

  const workItems = useMemo<WorkItem[]>(() => {
    const items: WorkItem[] = [];
    if (centralCounts.pending > 0) items.push({ id: "qt-pending", client: controlClient, title: "Thiết bị quản trị mới chờ duyệt", detail: `${centralCounts.pending} thiết bị QT cần quyết định`, state: "high", count: centralCounts.pending });
    for (const row of clientRows) {
      if ((row.pending ?? 0) > 0) items.push({ id: `${row.client.id}-pending`, client: row.client, title: "Thiết bị người dùng mới chờ duyệt", detail: `${row.pending} thiết bị do ${row.client.shortName} sở hữu registry`, state: "normal", count: row.pending });
      if (row.state === "unavailable") items.push({ id: `${row.client.id}-offline`, client: row.client, title: "Không đọc được trạng thái client", detail: row.descriptor?.runtime?.message || "Kiểm tra Control API / origin / secret của client.", state: "high" });
      else if (row.state === "warning") items.push({ id: `${row.client.id}-warning`, client: row.client, title: "Client cần hoàn thiện kết nối", detail: row.descriptor?.runtime?.message || row.client.scope, state: "normal" });
      else if (row.state === "pending") items.push({ id: `${row.client.id}-pending-backend`, client: row.client, title: "Chưa có backend quản trị production", detail: row.client.scope, state: "info" });
    }
    return items;
  }, [centralCounts.pending, clientRows]);

  async function manageDevice(device: ControlAdminDevice, operation: "approve" | "block" | "deactivate-member" | "delete-member", selectedRole?: "reviewer" | "publisher") {
    if (!bootstrap || !access || access.role !== "owner") return;
    if (operation === "deactivate-member" && !window.confirm(`Thu hồi toàn bộ quyền quản trị của ${device.email}?`)) return;
    if (operation === "delete-member") {
      const confirmation = window.prompt(`Nhập chính xác email để xóa tài khoản đã thu hồi:\n${device.email}`);
      if (confirmation?.trim().toLowerCase() !== device.email.toLowerCase()) { setNotice("Đã hủy xóa vì chuỗi xác nhận không khớp."); return; }
    }
    setActionBusy(device.deviceId); setNotice("");
    try {
      const result = await centerAdminAction({ action: "manage-control-device", operation, targetDeviceId: device.deviceId, role: selectedRole, displayName: device.displayName });
      setBootstrap((current) => current ? { ...current, controlDevices: result.controlDevices ?? current.controlDevices, auditLog: result.auditLog ?? current.auditLog } : current);
      setNotice("Đã cập nhật quyền thiết bị quản trị.");
    } catch (caught) { setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị quản trị."); }
    finally { setActionBusy(""); }
  }

  if (!access || access.status !== "approved" || !bootstrap) return <Gate access={access} busy={busy} error={error} retry={() => void initialize()} />;

  const role = access.role;
  const canSeeAdminDevices = role === "owner";
  const canSeeAudit = role === "publisher" || role === "owner";
  const title = viewTitles[view];
  const notificationCount = pendingClientDevices + alertClients + centralCounts.pending;
  const timeText = now ? new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(now) : "Đang đồng bộ thời gian";

  const applicationTable = <div className={styles.applicationTable}>
    <div className={styles.applicationHead}><span>Ứng dụng</span><span>Nhóm nghiệp vụ</span><span>Việc chờ xử lý</span><span>Phiên active</span><span>Trạng thái</span><span>Thao tác</span></div>
    {visibleClients.map((client) => {
      const row = clientRows.find((item) => item.client.id === client.id)!;
      return <article key={client.id} className={styles.applicationRow}>
        <div className={styles.appCell}><b>{client.icon}</b><div><strong>{client.shortName}</strong><small>{client.boundary}</small></div></div>
        <span>{client.group}</span><strong data-count={(row.pending ?? 0) > 0 ? "attention" : "normal"}>{row.pending ?? "—"}</strong><strong>{row.active ?? "—"}</strong>
        <StatusDot state={row.state} />
        {client.href ? <Link href={client.href} className={styles.manageButton}>Vào quản trị →</Link> : <span className={styles.connectionState} data-state="pending"><i />Chưa nối</span>}
      </article>;
    })}
    {!visibleClients.length ? <div className={styles.emptyState}>Không tìm thấy ứng dụng phù hợp.</div> : null}
  </div>;

  const workTable = <div className={styles.workTable}>
    <div className={styles.tableHead}><span>Ứng dụng</span><span>Sự kiện</span><span>Phạm vi</span><span>Số lượng</span><span>Trạng thái</span><span>Thao tác</span></div>
    {workItems.map((item) => <article key={item.id} className={styles.workRow}>
      <div className={styles.appCell}><b>{item.client.icon}</b><strong>{item.client.shortName}</strong></div>
      <div><strong>{item.title}</strong><small>{item.detail}</small></div>
      <span>{item.client.group}</span><span>{item.count ?? "—"}</span><span className={styles.priority} data-priority={item.state === "high" ? "high" : "normal"}>{item.state === "high" ? "Cần kiểm tra" : item.state === "info" ? "Theo kế hoạch" : "Cần xử lý"}</span>
      {item.client.href ? <Link href={item.client.href} className={styles.rowAction}>Xem →</Link> : <span className={styles.connectionState} data-state="pending">Chờ backend</span>}
    </article>)}
    {!workItems.length ? <div className={styles.emptyState}>Không có việc đang chờ xử lý.</div> : null}
  </div>;

  const deviceSummary = <div className={styles.clientDeviceTable}>
    <div className={styles.deviceTableHead}><span>Ứng dụng</span><span>Thiết bị chờ</span><span>Phiên active</span><span>Trạng thái</span><span>Thao tác</span></div>
    {visibleClients.map((client) => {
      const row = clientRows.find((item) => item.client.id === client.id)!;
      return <article key={client.id} className={styles.clientDeviceRow}>
        <div className={styles.appCell}><b>{client.icon}</b><strong>{client.shortName}</strong></div>
        <div><strong>{row.pending ?? "—"}</strong><small>{row.pending === null ? "Client chưa trả số liệu" : "Đang chờ client xử lý"}</small></div>
        <div><strong>{row.active ?? "—"}</strong><small>Phiên do client sở hữu</small></div>
        <StatusDot state={row.state} />
        {client.href ? <Link href={client.href} className={styles.rowAction}>{(row.pending ?? 0) > 0 ? "Duyệt →" : "Mở →"}</Link> : <span className={styles.connectionState} data-state="pending">—</span>}
      </article>;
    })}
  </div>;

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><div className={styles.brandMark}>QT</div><div><span>TRUNG TÂM ĐIỀU PHỐI</span><strong>QUẢN TRỊ ỨNG DỤNG</strong></div></div>
      <nav className={styles.nav} aria-label="Điều hướng quản trị">
        <button data-active={view === "overview"} onClick={() => switchView("overview")}><i>⌂</i><div><strong>Tổng quan</strong><small>Bảng điều phối</small></div></button>
        <button data-active={view === "inbox"} onClick={() => switchView("inbox")}><i>▤</i><div><strong>Hộp việc</strong><small>Ưu tiên xử lý</small></div>{workItems.length ? <b>{workItems.length}</b> : null}</button>
        <button data-active={view === "applications"} onClick={() => switchView("applications")}><i>⊞</i><div><strong>Ứng dụng</strong><small>Tìm & quản trị client</small></div></button>
        <button data-active={view === "client-devices"} onClick={() => switchView("client-devices")}><i>▯</i><div><strong>Thiết bị mới</strong><small>Theo từng ứng dụng</small></div>{pendingClientDevices ? <b>{pendingClientDevices}</b> : null}</button>
        <button data-active={view === "alerts"} onClick={() => switchView("alerts")}><i>△</i><div><strong>Cảnh báo</strong><small>Vận hành client</small></div>{alertClients ? <b>{alertClients}</b> : null}</button>
        <span className={styles.navDivider}>HỆ THỐNG</span>
        {canSeeAdminDevices ? <button data-active={view === "devices"} onClick={() => switchView("devices")}><i>♙</i><div><strong>Thiết bị QT</strong><small>Quyền Trung tâm</small></div>{centralCounts.pending ? <b>{centralCounts.pending}</b> : null}</button> : null}
        {canSeeAudit ? <button data-active={view === "audit"} onClick={() => switchView("audit")}><i>▧</i><div><strong>Nhật ký</strong><small>Bảo mật hệ thống</small></div></button> : null}
        <button data-active={view === "settings"} onClick={() => switchView("settings")}><i>⚙</i><div><strong>Cấu hình</strong><small>Contract & ranh giới</small></div></button>
      </nav>
      <div className={styles.sidebarFooter}><p>Quản trị tập trung<br/>Vận hành an toàn<br/>Client độc lập</p><span><i/> Production hoạt động</span></div>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}>
        <label className={styles.searchBox}><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo ứng dụng, thiết bị, người dùng…" /></label>
        <select className={styles.filterSelect} value={appFilter} onChange={(event) => setAppFilter(event.target.value)}><option value="all">Bộ lọc nhanh · Tất cả</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.shortName}</option>)}</select>
        <button className={styles.bell} onClick={() => switchView("alerts")} aria-label="Mở cảnh báo"><span>♢</span>{notificationCount > 0 ? <b>{notificationCount}</b> : null}</button>
        <div className={styles.topUser}><span>{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabels[role]}</small></div></div>
      </header>

      <div className={styles.pageBody}>
        <header className={styles.pageHeader}>
          <div><span>{title.eyebrow}</span><h1>{title.title}</h1><p>{title.description}</p></div>
          <div className={styles.systemStatusCard}><div className={styles.systemDate}><i>◫</i><span>{timeText}</span></div><div className={styles.systemHealth}><i/><div><small>Hệ thống</small><strong>Hoạt động ổn định</strong></div></div><button onClick={() => void initialize()} disabled={busy} aria-label="Đồng bộ">↻</button></div>
        </header>
        {bootstrap.upstreamError ? <div className={styles.operationsWarning}><strong>Một phần dữ liệu client chưa tải được.</strong><span>{bootstrap.upstreamError}</span></div> : null}
        {notice ? <div className={styles.notice}>{notice}</div> : null}

        {view === "overview" ? <>
          <section className={styles.metricGrid}>
            <button onClick={() => switchView("applications")} data-tone="teal"><i>◇</i><div><span>Tổng ứng dụng</span><strong>{clients.length}</strong><small>{connectedClients} client đang kết nối</small></div><b>→</b></button>
            <button onClick={() => switchView("client-devices")} data-tone="amber"><i>▯</i><div><span>Thiết bị mới chờ duyệt</span><strong>{pendingClientDevices}</strong><small>Đọc từ registry từng client</small></div><b>→</b></button>
            <button onClick={() => switchView("alerts")} data-tone="red"><i>△</i><div><span>Cảnh báo vận hành</span><strong>{alertClients}</strong><small>Client cần kiểm tra</small></div><b>→</b></button>
            <button onClick={() => switchView("inbox")} data-tone="gold"><i>▤</i><div><span>Việc cần xử lý</span><strong>{workItems.length}</strong><small>Không tạo số liệu giả</small></div><b>→</b></button>
          </section>

          <section className={styles.dashboardGrid}>
            <div className={styles.panel}><SectionHeader title="Hộp việc ưu tiên" meta={`${workItems.length} việc`} action={<button onClick={() => switchView("inbox")}>Xem tất cả →</button>} />{workTable}</div>
            <div className={styles.panel}><SectionHeader title="Thiết bị mới theo từng ứng dụng" meta={`${pendingClientDevices} chờ duyệt`} action={<button onClick={() => switchView("client-devices")}>Xem tất cả →</button>} /><div className={styles.panelFilter}><select value={appFilter} onChange={(event) => setAppFilter(event.target.value)}><option value="all">Tất cả ứng dụng</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.shortName}</option>)}</select><span>Registry thuộc từng client</span></div>{deviceSummary}</div>
            <div className={`${styles.panel} ${styles.applicationPanel}`}><SectionHeader title="Ứng dụng đang quản lý" meta="Một hàng / một client" action={<button onClick={() => switchView("applications")}>Quản lý ứng dụng →</button>} />{applicationTable}</div>
            <div className={styles.panel}><SectionHeader title="Cảnh báo nhanh" meta={alertClients ? `${alertClients} client cần kiểm tra` : "Không có cảnh báo nghiêm trọng"} action={<button onClick={() => switchView("alerts")}>Xem tất cả →</button>} /><div className={styles.alertTiles}>
              <button onClick={() => switchView("client-devices")} data-tone="amber"><span>▯</span><div><small>Thiết bị mới</small><strong>{pendingClientDevices}</strong><em>Chờ duyệt theo app</em></div></button>
              <button onClick={() => switchView("alerts")} data-tone="red"><span>⌁</span><div><small>Client cảnh báo</small><strong>{alertClients}</strong><em>Paused / unreachable / warning</em></div></button>
              <button onClick={() => switchView(canSeeAdminDevices ? "devices" : "alerts")} data-tone="gold"><span>♙</span><div><small>Thiết bị QT chờ duyệt</small><strong>{centralCounts.pending}</strong><em>Chỉ registry Trung tâm</em></div></button>
              <button onClick={() => switchView("settings")} data-tone="blue"><span>▤</span><div><small>Client chờ backend</small><strong>{clientRows.filter((row) => row.state === "pending").length}</strong><em>Không bật thao tác giả</em></div></button>
            </div></div>
          </section>
        </> : null}

        {view === "inbox" ? <section className={styles.panel}><SectionHeader title="Tất cả việc cần chú ý" meta={`${workItems.length} việc`} />{workTable}</section> : null}
        {view === "applications" ? <section className={styles.panel}><SectionHeader title="Danh sách client cấp 1" meta={`${clients.length} ứng dụng`} />{applicationTable}</section> : null}
        {view === "client-devices" ? <section className={styles.panel}><SectionHeader title="Thiết bị mới theo ứng dụng" meta="Registry vẫn thuộc client" /><div className={styles.panelFilter}><select value={appFilter} onChange={(event) => setAppFilter(event.target.value)}><option value="all">Tất cả ứng dụng</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.shortName}</option>)}</select><span>Không gom registry về QT</span></div>{deviceSummary}</section> : null}

        {view === "alerts" ? <section className={styles.alertsLayout}>
          <div className={styles.panel}><SectionHeader title="Cảnh báo cần xử lý" meta={`${workItems.filter((item) => item.state === "high" || item.state === "normal").length} cần chú ý`} />{workTable}</div>
          <div className={styles.panel}><SectionHeader title="Tình trạng từng client" /><div className={styles.connectionList}>{clientRows.map((row) => <article key={row.client.id}><b>{row.client.icon}</b><div><strong>{row.client.shortName}</strong><small>{row.descriptor?.runtime?.message || row.client.scope}</small></div><StatusDot state={row.state}/>{row.client.href ? <Link href={row.client.href}>Kiểm tra →</Link> : <span />}</article>)}</div></div>
        </section> : null}

        {view === "devices" && canSeeAdminDevices ? <section className={styles.panel}><SectionHeader title="Thiết bị quản trị Application Management" meta={`${centralCounts.total} thiết bị · ${centralCounts.online} online`} /><div className={styles.centralBoundary}>Đây chỉ là thiết bị quản trị Application Management. Thiết bị người dùng của Bơi ếch, Sức khỏe Y tế, Hòa nhập Nga, Bauman và GrowUP không nằm trong registry này.</div><div className={styles.adminDeviceList}>{bootstrap.controlDevices.map((device) => <DeviceRow key={device.deviceId} device={device} actor={access} role={role} busy={actionBusy} run={manageDevice} />)}</div></section> : null}

        {view === "audit" && canSeeAudit ? <section className={styles.panel}><SectionHeader title="Nhật ký bảo mật control-plane" meta={`${bootstrap.auditLog.length} sự kiện gần nhất`} /><div className={styles.auditList}>{bootstrap.auditLog.map((entry) => <article key={entry.id}><time>{formatTime(entry.createdAt)}</time><div><strong>{auditLabels[entry.action] ?? entry.action}</strong><small>{entry.actor}</small></div><code>{entry.target}</code></article>)}{!bootstrap.auditLog.length ? <div className={styles.emptyState}>Chưa có sự kiện audit Trung tâm.</div> : null}</div></section> : null}

        {view === "settings" ? <section className={styles.settingsGrid}>
          <div className={styles.panel}><SectionHeader title="Topology bắt buộc" /><div className={styles.topologyFlow}><div><span>LEVEL 0</span><strong>Application Management</strong><small>QT · role · central audit</small></div><b>→</b><div><span>LEVEL 1</span><strong>Client độc lập</strong><small>BE · SK · HN · BM · GU</small></div><b>→</b><div><span>ENDPOINT</span><strong>Thiết bị client</strong><small>Registry thuộc client</small></div></div></div>
          <div className={styles.panel}><SectionHeader title="Contract từng ứng dụng" /><div className={styles.contractList}>{clientRows.map((row) => <article key={row.client.id}><b>{row.client.icon}</b><div><strong>{row.client.shortName}</strong><small>{row.client.boundary}</small></div><span data-contract={row.state === "connected" ? "connected" : "pending"}>{stateLabel(row.state)}</span>{row.client.href ? <Link href={row.client.href}>Quản trị →</Link> : <span />}</article>)}</div></div>
          <div className={`${styles.panel} ${styles.boundaryPanel}`}><SectionHeader title="Ranh giới nghiệp vụ" /><div className={styles.boundaryCards}><article data-client="health"><strong>Sức khỏe Y tế</strong><p>Chỉ quản trị Health: thiết bị SK, policy, session, kiểm duyệt nội dung y tế và audit ứng dụng. Không dùng registry Bơi ếch hay Hòa nhập Nga.</p></article><article data-client="ru"><strong>Hòa nhập Nga</strong><p>Là client độc lập: thiết bị HN, OCR thuốc, đối chiếu quy định và audit Nga. Production hiện tại chưa có adapter nên Trung tâm không dựng nút thao tác giả.</p></article></div></div>
        </section> : null}
      </div>
    </section>
  </main>;
}
