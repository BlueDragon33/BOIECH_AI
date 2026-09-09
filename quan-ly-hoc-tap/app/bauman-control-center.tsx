"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  centerAdminAction,
  connectAdminCenter,
  roleLabels,
  type AdminAccess,
  type ControlRole,
} from "./admin-device-client";
import styles from "./bauman-control-center.module.css";

type BaumanDevice = {
  deviceId: string;
  deviceCode: string;
  status: "pending" | "approved" | "blocked";
  label: string | null;
  platform: string | null;
  browser: string | null;
  language: string | null;
  timezone: string | null;
  screen: string | null;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  blockedAt: string | null;
  blockedBy: string | null;
  lastSeenAt: string;
  active: boolean;
};

type BaumanAudit = {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

type BaumanStats = { total: number; pending: number; approved: number; blocked: number; active: number };
type BaumanPayload = {
  baumanDevices?: BaumanDevice[];
  baumanAudit?: BaumanAudit[];
  baumanStats?: BaumanStats;
  error?: string;
};
type Tab = "overview" | "devices" | "audit" | "structure";
type Filter = "all" | "pending" | "approved" | "blocked" | "active";

const statusLabels = { pending: "Chờ duyệt", approved: "Đã cấp quyền", blocked: "Đã khóa / loại bỏ" } as const;
const auditLabels: Record<string, string> = {
  device_registered: "Thiết bị gửi yêu cầu",
  device_approved: "Duyệt thiết bị",
  device_rejected: "Loại bỏ yêu cầu",
  device_blocked: "Khóa thiết bị",
  device_reopened: "Mở lại để duyệt",
  device_label_updated: "Đổi tên gợi nhớ",
};
const subjects = [
  ["MATH", "Toán Bauman", "Site môn học độc lập"],
  ["DEV", "Lập trình", "Module trong Bauman"],
  ["AI", "AI", "Module trong Bauman"],
  ["SIG", "Tín hiệu", "Module trong Bauman"],
  ["SYS", "Hệ thống", "Module trong Bauman"],
  ["FND", "Nền tảng", "Module trong Bauman"],
  ["R&D", "Nghiên cứu", "Module trong Bauman"],
] as const;

function canReview(role: ControlRole) {
  return ["reviewer", "publisher", "owner"].includes(role);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function Gate({ access, busy, error, retry }: { access: AdminAccess | null; busy: boolean; error: string; retry: () => void }) {
  return <main className={styles.gate}><section className={styles.gateCard}>
    <div className={styles.seal}>BM</div>
    <span>BAUMAN CONTROL PLANE</span>
    <h1>{access?.status === "pending" ? "Thiết bị quản trị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Đang xác thực Trung tâm Quản trị…"}</h1>
    <p>{error || "Chỉ thiết bị quản trị đã được xác thực mới có thể duyệt thiết bị Bauman."}</p>
    {access?.deviceCode ? <code>{access.deviceCode}</code> : null}
    <button onClick={retry} disabled={busy}>{busy ? "Đang kiểm tra…" : "Kiểm tra lại"}</button>
  </section></main>;
}

export default function BaumanControlCenter({ user }: { user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [devices, setDevices] = useState<BaumanDevice[]>([]);
  const [audit, setAudit] = useState<BaumanAudit[]>([]);
  const [stats, setStats] = useState<BaumanStats>({ total: 0, pending: 0, approved: 0, blocked: 0, active: 0 });
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function apply(data: BaumanPayload) {
    const nextDevices = data.baumanDevices ?? [];
    setDevices(nextDevices);
    setAudit(data.baumanAudit ?? []);
    setStats(data.baumanStats ?? {
      total: nextDevices.length,
      pending: nextDevices.filter((item) => item.status === "pending").length,
      approved: nextDevices.filter((item) => item.status === "approved").length,
      blocked: nextDevices.filter((item) => item.status === "blocked").length,
      active: nextDevices.filter((item) => item.active).length,
    });
    setLabels(Object.fromEntries(nextDevices.map((item) => [item.deviceId, item.label ?? ""])));
  }

  async function initialize() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await connectAdminCenter();
      setAccess(result.access);
      if (result.access.status !== "approved") return;
      const data = await centerAdminAction({ action: "bauman-bootstrap" }) as unknown as BaumanPayload;
      apply(data);
      if ((data.baumanStats?.pending ?? 0) > 0) { setTab("devices"); setFilter("pending"); }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể mở quản trị Bauman.");
    } finally { setBusy(false); }
  }

  useEffect(() => { void initialize(); }, []);

  async function deviceAction(device: BaumanDevice, operation: "approve" | "block" | "reopen" | "label") {
    if (!access || !canReview(access.role)) return;
    if (operation === "block") {
      const message = device.status === "pending"
        ? `Loại bỏ yêu cầu ${device.deviceCode}? Thiết bị sẽ bị chặn và không tự đăng ký lại.`
        : `Khóa ${device.deviceCode}? Quyền Bauman sẽ dừng ở lần kiểm tra tiếp theo.`;
      if (!window.confirm(message)) return;
    }
    setActionBusy(device.deviceId); setError(""); setNotice("");
    try {
      const data = await centerAdminAction({
        action: "manage-bauman-device",
        operation,
        targetDeviceId: device.deviceId,
        label: labels[device.deviceId] ?? "",
      }) as unknown as BaumanPayload;
      apply(data);
      setNotice(operation === "approve" ? `Đã duyệt ${device.deviceCode}.`
        : operation === "block" && device.status === "pending" ? `Đã loại bỏ ${device.deviceCode}.`
        : operation === "block" ? `Đã khóa ${device.deviceCode}.`
        : operation === "reopen" ? `Đã đưa ${device.deviceCode} về hàng chờ duyệt.`
        : `Đã lưu tên gợi nhớ cho ${device.deviceCode}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị Bauman.");
    } finally { setActionBusy(""); }
  }

  const visibleDevices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return devices.filter((device) => {
      const matchesFilter = filter === "all" ? true : filter === "active" ? device.active : device.status === filter;
      if (!matchesFilter) return false;
      if (!query) return true;
      return [device.deviceCode, device.label, device.platform, device.browser, device.language, device.timezone, device.screen]
        .filter(Boolean).join(" ").toLocaleLowerCase("vi").includes(query);
    });
  }, [devices, filter, search]);

  if (!access || access.status !== "approved") return <Gate access={access} busy={busy} error={error} retry={() => void initialize()} />;

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><div className={styles.seal}>BM</div><div><span>CLIENT CẤP 1</span><strong>Bauman Hub</strong></div></div>
      <div className={styles.connection}><i/><div><strong>Registry thiết bị hoạt động</strong><small>Contract BM device-review-v1</small></div></div>
      <nav>
        <button data-active={tab === "overview"} onClick={() => setTab("overview")}><b>01</b><span>Tổng quan<small>Topology & boundary</small></span></button>
        <button data-active={tab === "devices"} onClick={() => setTab("devices")}><b>02</b><span>Thiết bị & truy cập<small>{stats.pending} chờ duyệt</small></span>{stats.pending ? <em>{stats.pending}</em> : null}</button>
        <button data-active={tab === "structure"} onClick={() => setTab("structure")}><b>03</b><span>Môn học & site con<small>{subjects.length} site/module</small></span></button>
        {canReview(access.role) ? <button data-active={tab === "audit"} onClick={() => setTab("audit")}><b>04</b><span>Nhật ký<small>Quyết định & truy cập</small></span></button> : null}
      </nav>
      <div className={styles.boundary}><span>RANH GIỚI</span><strong>Đây là khu quản trị, không mở runtime học tập thay quản trị.</strong><small>Thiết bị BM tách khỏi QT, SK và Bơi ếch.</small></div>
      <div className={styles.actor}><strong>{user.displayName}</strong><small>{roleLabels[access.role]} · {access.deviceCode}</small></div>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}>
        <Link href="/">← Trung tâm Quản trị</Link>
        <div><button onClick={() => void initialize()} disabled={busy}>{busy ? "Đang cập nhật…" : "Cập nhật"}</button></div>
      </header>
      <div className={styles.body}>
        <header className={styles.pageHead}><div><span>BAUMAN · ADMIN CONTRACT</span><h1>{tab === "devices" ? "Thiết bị & truy cập" : tab === "structure" ? "Môn học & site con" : tab === "audit" ? "Nhật ký Bauman" : "Quản trị Bauman Master AI"}</h1><p>{tab === "devices" ? "Duyệt, loại bỏ và thu hồi thiết bị BM từ registry thực; trạng thái được lưu tại máy chủ." : tab === "structure" ? "Inventory quản trị cấu trúc học tập; không biến môn học thành client cấp 1." : tab === "audit" ? "Mọi quyết định kiểm duyệt được ghi lại theo quản trị viên và thời điểm." : "Client Bauman được quản lý độc lập nhưng nhận quyết định từ Trung tâm Quản trị."}</p></div><div className={styles.health}><i/><span>Hệ thống<strong>Hoạt động</strong></span></div></header>
        {error ? <div className={styles.error}>{error}</div> : null}
        {notice ? <div className={styles.notice}>{notice}</div> : null}

        {tab === "overview" ? <>
          <section className={styles.metrics}>
            <button onClick={() => { setTab("devices"); setFilter("pending"); }}><span>Chờ duyệt</span><strong>{stats.pending}</strong><small>Cần quyết định</small></button>
            <button onClick={() => { setTab("devices"); setFilter("active"); }}><span>Online</span><strong>{stats.active}</strong><small>Tín hiệu trong 3 phút</small></button>
            <button onClick={() => { setTab("devices"); setFilter("approved"); }}><span>Đã cấp quyền</span><strong>{stats.approved}</strong><small>Thiết bị được phép</small></button>
            <button onClick={() => { setTab("devices"); setFilter("blocked"); }}><span>Đã khóa</span><strong>{stats.blocked}</strong><small>Không được truy cập</small></button>
          </section>
          <section className={styles.panel}><div className={styles.panelHead}><div><span>CONTROL FLOW</span><h2>Duyệt thật, không chỉ đổi giao diện</h2></div></div><div className={styles.flow}><article><b>1</b><strong>Bauman runtime</strong><span>Tạo khóa P-256 và gửi yêu cầu BM.</span></article><article><b>2</b><strong>Registry máy chủ</strong><span>Lưu trạng thái pending / approved / blocked.</span></article><article><b>3</b><strong>Quản trị viên</strong><span>Duyệt hoặc loại bỏ tại đây hoặc từ Trung tâm.</span></article><article><b>4</b><strong>Runtime xác minh</strong><span>Challenge + chữ ký mới mở quyền truy cập.</span></article></div></section>
        </> : null}

        {tab === "devices" ? <section className={styles.panel}>
          <div className={styles.deviceToolbar}><div>{(["all", "pending", "approved", "active", "blocked"] as Filter[]).map((item) => <button key={item} data-active={filter === item} onClick={() => setFilter(item)}>{item === "all" ? "Tất cả" : item === "pending" ? `Chờ duyệt (${stats.pending})` : item === "approved" ? "Đã duyệt" : item === "active" ? "Online" : "Đã khóa"}</button>)}</div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã BM, tên, trình duyệt…" /></div>
          <div className={styles.deviceList}>
            {visibleDevices.map((device) => <article key={device.deviceId} data-status={device.status}>
              <div className={styles.deviceIcon} data-online={device.active ? "true" : "false"}>▣</div>
              <div className={styles.deviceMain}><div><span className={styles.status} data-status={device.status}>{statusLabels[device.status]}</span>{device.active ? <em>ONLINE</em> : null}</div><strong>{device.label || device.deviceCode}</strong><code>{device.deviceCode}</code><small>{[device.platform, device.browser, device.screen].filter(Boolean).join(" · ") || "Chưa có metadata thiết bị"}</small><small>Tín hiệu cuối: {formatDate(device.lastSeenAt)} · Tạo: {formatDate(device.createdAt)}</small></div>
              <div className={styles.labelBox}><label>Tên gợi nhớ<input value={labels[device.deviceId] ?? ""} onChange={(event) => setLabels((current) => ({ ...current, [device.deviceId]: event.target.value }))} placeholder="VD: Laptop học Bauman" /></label><button disabled={actionBusy === device.deviceId || !canReview(access.role)} onClick={() => void deviceAction(device, "label")}>Lưu tên</button></div>
              <div className={styles.actions}>{device.status === "pending" ? <><button className={styles.approve} disabled={actionBusy === device.deviceId || !canReview(access.role)} onClick={() => void deviceAction(device, "approve")}>{actionBusy === device.deviceId ? "Đang xử lý…" : "Duyệt"}</button><button className={styles.reject} disabled={actionBusy === device.deviceId || !canReview(access.role)} onClick={() => void deviceAction(device, "block")}>Loại bỏ</button></> : device.status === "approved" ? <button className={styles.reject} disabled={actionBusy === device.deviceId || !canReview(access.role)} onClick={() => void deviceAction(device, "block")}>Khóa quyền</button> : <button disabled={actionBusy === device.deviceId || !canReview(access.role)} onClick={() => void deviceAction(device, "reopen")}>Mở lại chờ duyệt</button>}</div>
            </article>)}
            {!visibleDevices.length ? <div className={styles.empty}><strong>Không có thiết bị phù hợp.</strong><span>Khi Bauman runtime gửi yêu cầu, thiết bị BM sẽ xuất hiện tại đây.</span></div> : null}
          </div>
        </section> : null}

        {tab === "structure" ? <section className={styles.panel}><div className={styles.panelHead}><div><span>SUB-CLIENT INVENTORY</span><h2>Cấu trúc học tập dưới Bauman</h2></div><small>Inventory quản trị; không điều hướng quản trị viên sang runtime học tập.</small></div><div className={styles.subjectList}>{subjects.map(([icon, name, type]) => <article key={name}><b>{icon}</b><div><strong>{name}</strong><small>{type}</small></div><span>Contract BM</span><em>Độc lập trong Bauman</em></article>)}</div></section> : null}

        {tab === "audit" ? <section className={styles.panel}><div className={styles.panelHead}><div><span>AUDIT LOG</span><h2>Nhật ký quyết định thiết bị</h2></div><small>{audit.length} bản ghi gần nhất</small></div><div className={styles.auditList}>{audit.map((entry) => <article key={entry.id}><span>{formatDate(entry.createdAt)}</span><strong>{auditLabels[entry.action] ?? entry.action}</strong><code>{String(entry.detail.deviceCode ?? entry.target).slice(0, 48)}</code><small>{entry.actor}</small></article>)}{!audit.length ? <div className={styles.empty}><strong>Chưa có nhật ký Bauman.</strong></div> : null}</div></section> : null}
      </div>
    </section>
  </main>;
}