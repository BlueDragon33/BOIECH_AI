"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getApplicationConfig } from "./application-registry";
import {
  centerAdminAction,
  connectAdminCenter,
  roleLabels,
  type AdminAccess,
  type CenterBootstrap,
  type ControlAdminDevice,
  type ControlRole,
} from "./admin-device-client";
import styles from "./center-admin.module.css";

type CenterView = "overview" | "applications" | "devices" | "audit";

const deviceStatusLabels = {
  pending: "Chờ duyệt",
  approved: "Đã cấp quyền",
  blocked: "Đã khóa",
} as const;

const memberStatusLabels = {
  active: "Tài khoản hoạt động",
  inactive: "Đã thu hồi tài khoản",
  unregistered: "Chưa cấp tài khoản",
} as const;

const auditLabels: Record<string, string> = {
  control_device_approved: "Cấp quyền thiết bị quản trị",
  control_device_blocked: "Khóa thiết bị quản trị",
  control_member_deactivated: "Thu hồi tài khoản quản trị",
  control_member_deleted: "Xóa tài khoản quản trị",
};

function Gate({
  access,
  busy,
  error,
  retry,
}: {
  access: AdminAccess | null;
  busy: boolean;
  error: string;
  retry: () => void;
}) {
  return <main className={styles.gateShell}>
    <section className={styles.gateCard}>
      <span className={styles.sectionEyebrow}>Trung tâm quản trị</span>
      <h1>
        {access?.status === "pending"
          ? "Thiết bị đang chờ cấp quyền."
          : access?.status === "blocked"
            ? "Thiết bị quản trị đã bị khóa."
            : "Đang xác thực thiết bị quản trị…"}
      </h1>
      <p>
        {error || "Mỗi máy quản trị dùng khóa riêng. Chỉ thiết bị được chủ hệ thống phê duyệt mới được vào Trung tâm."}
      </p>
      {access?.deviceCode
        ? <div className={styles.gateCode}>
          <span>Mã thiết bị quản trị</span>
          <strong>{access.deviceCode}</strong>
        </div>
        : null}
      <button className={styles.primaryButton} onClick={retry} disabled={busy}>
        {busy ? "Đang kiểm tra…" : "Kiểm tra lại quyền"}
      </button>
    </section>
  </main>;
}

function statusText(status: "online" | "warning" | "planned") {
  if (status === "online") return "Đã kết nối quản trị";
  if (status === "warning") return "Cần kiểm tra";
  return "Chưa nối backend quản trị";
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function DeviceRow({
  device,
  actor,
  role,
  busy,
  run,
}: {
  device: ControlAdminDevice;
  actor: AdminAccess;
  role: ControlRole;
  busy: string;
  run: (
    device: ControlAdminDevice,
    operation: "approve" | "block" | "deactivate-member" | "delete-member",
    selectedRole?: "reviewer" | "publisher",
  ) => void;
}) {
  const [approvalRole, setApprovalRole] = useState<"reviewer" | "publisher">(
    device.role === "publisher" ? "publisher" : "reviewer",
  );
  const protectedDevice = device.owner || device.deviceId === actor.deviceId;
  const isBusy = busy === device.deviceId;

  return <article className={`${styles.deviceRow} ${device.status === "pending" ? styles.devicePending : ""}`}>
    <div className={styles.deviceIdentity}>
      <div className={`${styles.presenceDot} ${device.active ? styles.presenceOnline : ""}`} />
      <div>
        <strong>{device.displayName || device.email}</strong>
        <span>{device.email}</span>
        <small>{device.deviceCode} · {device.label || "Chưa đặt nhãn"}</small>
      </div>
    </div>

    <div className={styles.deviceFacts}>
      <span className={styles.factLabel}>Trạng thái</span>
      <strong>{deviceStatusLabels[device.status]}</strong>
      <small>{memberStatusLabels[device.memberStatus]}</small>
    </div>

    <div className={styles.deviceFacts}>
      <span className={styles.factLabel}>Vai trò</span>
      <strong>{roleLabels[device.role]}</strong>
      <small>{device.active ? "Đang trực tuyến" : `Tín hiệu cuối ${formatTime(device.lastSeenAt)}`}</small>
    </div>

    <div className={styles.deviceActions}>
      {protectedDevice
        ? <span className={styles.protectedLabel}>Thiết bị chủ hệ thống · được bảo vệ</span>
        : device.status === "pending"
          ? <>
            <select
              value={approvalRole}
              onChange={(event) => setApprovalRole(event.target.value as "reviewer" | "publisher")}
              disabled={isBusy || role !== "owner"}
              aria-label={`Vai trò cấp cho ${device.email}`}
            >
              <option value="reviewer">Kiểm duyệt viên</option>
              <option value="publisher">Người xuất bản</option>
            </select>
            <button
              className={styles.primaryButton}
              disabled={isBusy || role !== "owner"}
              onClick={() => run(device, "approve", approvalRole)}
            >
              Cấp quyền
            </button>
            <button
              className={styles.secondaryButton}
              disabled={isBusy || role !== "owner"}
              onClick={() => run(device, "block")}
            >
              Từ chối / khóa
            </button>
          </>
          : device.memberStatus === "inactive"
            ? <button
              className={styles.dangerButton}
              disabled={isBusy || role !== "owner"}
              onClick={() => run(device, "delete-member")}
            >
              Xóa tài khoản
            </button>
            : <>
              {device.status !== "blocked"
                ? <button
                  className={styles.secondaryButton}
                  disabled={isBusy || role !== "owner"}
                  onClick={() => run(device, "block")}
                >
                  Khóa thiết bị
                </button>
                : null}
              <button
                className={styles.dangerButton}
                disabled={isBusy || role !== "owner"}
                onClick={() => run(device, "deactivate-member")}
              >
                Thu hồi tài khoản
              </button>
            </>}
    </div>
  </article>;
}

export default function ApplicationHub({
  user,
}: {
  user: { displayName: string; email: string };
}) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [bootstrap, setBootstrap] = useState<CenterBootstrap | null>(null);
  const [view, setView] = useState<CenterView>("overview");
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function initialize() {
    setBusy(true);
    setError("");
    try {
      const result = await connectAdminCenter();
      setAccess(result.access);
      setBootstrap(result.bootstrap);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể mở Trung tâm quản trị.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    if (requested && ["overview", "applications", "devices", "audit"].includes(requested)) {
      setView(requested as CenterView);
    }
    void initialize();
  }, []);

  function switchView(next: CenterView) {
    setView(next);
    const url = next === "overview" ? "/" : `/?view=${next}`;
    window.history.replaceState(null, "", url);
  }

  const applications = useMemo(() => {
    if (!bootstrap) return [];
    return bootstrap.applications.map((application) => ({
      ...application,
      config: getApplicationConfig(application.id),
    })).filter((application) => application.config);
  }, [bootstrap]);

  const deviceCounts = useMemo(() => {
    const devices = bootstrap?.controlDevices ?? [];
    return {
      total: devices.length,
      pending: devices.filter((item) => item.status === "pending").length,
      approved: devices.filter((item) => item.status === "approved").length,
      blocked: devices.filter((item) => item.status === "blocked").length,
      online: devices.filter((item) => item.active).length,
    };
  }, [bootstrap?.controlDevices]);

  async function manageDevice(
    device: ControlAdminDevice,
    operation: "approve" | "block" | "deactivate-member" | "delete-member",
    selectedRole?: "reviewer" | "publisher",
  ) {
    if (!bootstrap || !access || access.role !== "owner") return;

    if (operation === "deactivate-member") {
      const accepted = window.confirm(
        `Thu hồi toàn bộ quyền quản trị của ${device.email}? Tất cả thiết bị của tài khoản này sẽ bị khóa.`,
      );
      if (!accepted) return;
    }

    if (operation === "delete-member") {
      const confirmation = window.prompt(
        `Xóa vĩnh viễn tài khoản đã thu hồi. Nhập chính xác email để xác nhận:\n${device.email}`,
      );
      if (confirmation?.trim().toLowerCase() !== device.email.toLowerCase()) {
        setNotice("Đã hủy xóa vì chuỗi xác nhận không khớp.");
        return;
      }
    }

    setActionBusy(device.deviceId);
    setNotice("");
    try {
      const result = await centerAdminAction({
        action: "manage-control-device",
        operation,
        targetDeviceId: device.deviceId,
        role: selectedRole,
        displayName: device.displayName,
      });
      setBootstrap((current) => current
        ? {
          ...current,
          controlDevices: result.controlDevices ?? current.controlDevices,
          auditLog: result.auditLog ?? current.auditLog,
        }
        : current);
      setNotice(
        operation === "approve"
          ? "Đã cấp quyền thiết bị quản trị."
          : operation === "block"
            ? "Đã khóa thiết bị quản trị."
            : operation === "deactivate-member"
              ? "Đã thu hồi tài khoản và khóa các thiết bị liên quan."
              : "Đã xóa tài khoản quản trị.",
      );
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật quyền thiết bị.");
    } finally {
      setActionBusy("");
    }
  }

  if (!access || access.status !== "approved" || !bootstrap) {
    return <Gate
      access={access}
      busy={busy}
      error={error}
      retry={() => void initialize()}
    />;
  }

  const attentionApps = applications.filter((application) => application.status !== "online");
  const role = access.role;
  const canSeeDevices = role === "owner";
  const canSeeAudit = ["publisher", "owner"].includes(role);

  return <main className={styles.centerShell}>
    <aside className={styles.centerSidebar}>
      <div className={styles.centerBrand}>
        <div>QT</div>
        <span>
          <small>Hệ thống trung tâm</small>
          <strong>Quản trị ứng dụng</strong>
        </span>
      </div>

      <nav className={styles.centerNav} aria-label="Điều hướng Trung tâm quản trị">
        <button className={view === "overview" ? styles.centerNavActive : ""} onClick={() => switchView("overview")}>
          <b>01</b><span><strong>Tổng quan</strong><small>Việc cần xử lý</small></span>
        </button>
        <button className={view === "applications" ? styles.centerNavActive : ""} onClick={() => switchView("applications")}>
          <b>02</b><span><strong>Ứng dụng</strong><small>Chọn khu quản trị riêng</small></span>
        </button>
        {canSeeDevices
          ? <button className={view === "devices" ? styles.centerNavActive : ""} onClick={() => switchView("devices")}>
            <b>03</b><span><strong>Thiết bị & quyền</strong><small>Quản trị viên trung tâm</small></span>
          </button>
          : null}
        {canSeeAudit
          ? <button className={view === "audit" ? styles.centerNavActive : ""} onClick={() => switchView("audit")}>
            <b>04</b><span><strong>Nhật ký & bảo mật</strong><small>Truy vết thay đổi</small></span>
          </button>
          : null}
      </nav>

      <div className={styles.centerBoundary}>
        <strong>Ranh giới quản trị</strong>
        <p>Trung tâm cấp quyền và điều phối. Nội dung, học tập, AI, thanh toán và dữ liệu chuyên môn phải xử lý trong đúng ứng dụng.</p>
      </div>

      <div className={styles.centerUser}>
        <strong>{user.displayName}</strong>
        <span>{roleLabels[role]}</span>
        <small>{access.deviceCode}</small>
        <a href="/signout-with-chatgpt?return_to=/">Đăng xuất</a>
      </div>
    </aside>

    <section className={styles.centerMain}>
      <header className={styles.centerTopbar}>
        <div>
          <span>Trung tâm quản trị</span>
          <h1>
            {view === "overview"
              ? "Tổng quan điều hành"
              : view === "applications"
                ? "Ứng dụng được quản lý"
                : view === "devices"
                  ? "Thiết bị & quyền quản trị"
                  : "Nhật ký & bảo mật"}
          </h1>
        </div>
        <button className={styles.secondaryButton} onClick={() => void initialize()} disabled={busy}>
          {busy ? "Đang đồng bộ…" : "Cập nhật"}
        </button>
      </header>

      {error || bootstrap.upstreamError
        ? <div className={styles.error}>{error || bootstrap.upstreamError}</div>
        : null}
      {notice ? <div className={styles.notice} role="status">{notice}</div> : null}

      {view === "overview"
        ? <>
          <section className={styles.centerSummaryGrid}>
            <article><span>Ứng dụng quản lý</span><strong>{applications.length}</strong><small>Mỗi ứng dụng một khu quản trị riêng</small></article>
            <article><span>Cần chú ý</span><strong>{attentionApps.length}</strong><small>Cảnh báo hoặc backend chưa sẵn sàng</small></article>
            <article><span>Thiết bị quản trị</span><strong>{canSeeDevices ? deviceCounts.total : "—"}</strong><small>{canSeeDevices ? `${deviceCounts.online} đang trực tuyến` : "Chỉ chủ hệ thống được xem"}</small></article>
            <article><span>Chờ cấp quyền</span><strong>{canSeeDevices ? deviceCounts.pending : "—"}</strong><small>Không tự động duyệt thiết bị quản trị</small></article>
          </section>

          <section className={styles.centerPanel}>
            <div className={styles.centerPanelHeader}>
              <div><span className={styles.sectionEyebrow}>Hộp việc</span><h2>Chỉ hiển thị việc cần quyết định ở cấp Trung tâm</h2></div>
            </div>
            <div className={styles.inboxGrid}>
              {canSeeDevices
                ? <button onClick={() => switchView("devices")}>
                  <span>Thiết bị quản trị chờ duyệt</span><strong>{deviceCounts.pending}</strong><small>Cấp reviewer/publisher hoặc từ chối</small>
                </button>
                : null}
              <button onClick={() => switchView("applications")}>
                <span>Ứng dụng cần kiểm tra</span><strong>{attentionApps.length}</strong><small>Không trộn việc chuyên môn vào Trung tâm</small>
              </button>
              {canSeeAudit
                ? <button onClick={() => switchView("audit")}>
                  <span>Nhật ký gần nhất</span><strong>{bootstrap.auditLog.length}</strong><small>Theo dõi thay đổi quyền truy cập</small>
                </button>
                : null}
            </div>
          </section>

          <section className={styles.centerPanel}>
            <span className={styles.sectionEyebrow}>Nguyên tắc vận hành</span>
            <div className={styles.ruleGrid}>
              <article><b>1</b><div><strong>Một cửa xác thực</strong><p>Thiết bị quản trị phải được phê duyệt tại Trung tâm trước khi vào các khu quản trị ứng dụng.</p></div></article>
              <article><b>2</b><div><strong>Đúng ứng dụng, đúng dữ liệu</strong><p>Thiết bị học, tiến độ, AI, thanh toán và nội dung không được kéo sang ứng dụng khác.</p></div></article>
              <article><b>3</b><div><strong>Mọi thay đổi quyền đều truy vết</strong><p>Cấp quyền, khóa, thu hồi và xóa tài khoản đều ghi nhật ký trung tâm.</p></div></article>
            </div>
          </section>
        </>
        : null}

      {view === "applications"
        ? <section className={styles.appGrid}>
          {applications.map((application) => {
            const config = application.config!;
            return <Link key={application.id} href={config.href} className={styles.appCard}>
              <div className={styles.appCardTop}>
                <div className={styles.appIcon}>{config.icon}</div>
                <span className={`${styles.status} ${application.status === "warning" ? styles.warning : application.status === "planned" ? styles.planned : ""}`}>
                  {statusText(application.status)}
                </span>
              </div>
              <h2>{application.name}</h2>
              <p>{config.scope}</p>
              {application.runtime?.message
                ? <div className={styles.runtimeStatus} data-state={application.runtime.connectionState}>
                  <strong>Kết nối Health_Care</strong>
                  <small>{application.runtime.message}</small>
                  {application.runtime.contractVersion
                    ? <small>Contract v{application.runtime.contractVersion} · {application.runtime.canonicalApplication || "alias legacy"}</small>
                    : null}
                </div>
                : null}
              <div className={styles.appScope}>
                <strong>Quản lý tại đây</strong>
                <ul>{config.capabilities.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div className={styles.guardrail}>
                <strong>Không thuộc phạm vi</strong>
                <ul>{config.guardrails.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <span className={styles.openLabel}>Mở khu quản trị riêng →</span>
            </Link>;
          })}
        </section>
        : null}

      {view === "devices"
        ? canSeeDevices
          ? <section className={styles.centerPanel}>
            <div className={styles.centerPanelHeader}>
              <div>
                <span className={styles.sectionEyebrow}>Thiết bị quản trị trung tâm</span>
                <h2>{deviceCounts.total} thiết bị · {deviceCounts.pending} chờ duyệt · {deviceCounts.blocked} đã khóa</h2>
                <p>Đây chỉ là thiết bị của người quản trị. Thiết bị học của từng ứng dụng phải quản lý bên trong ứng dụng đó.</p>
              </div>
            </div>
            <div className={styles.deviceList}>
              {bootstrap.controlDevices.map((device) => <DeviceRow
                key={device.deviceId}
                device={device}
                actor={access}
                role={role}
                busy={actionBusy}
                run={(target, operation, selectedRole) => void manageDevice(target, operation, selectedRole)}
              />)}
              {bootstrap.controlDevices.length === 0
                ? <div className={styles.emptyState}>Chưa có thiết bị quản trị nào trong danh sách.</div>
                : null}
            </div>
          </section>
          : <div className={styles.error}>Chỉ chủ hệ thống được quản lý thiết bị và quyền quản trị.</div>
        : null}

      {view === "audit"
        ? canSeeAudit
          ? <section className={styles.centerPanel}>
            <div className={styles.centerPanelHeader}>
              <div>
                <span className={styles.sectionEyebrow}>Nhật ký trung tâm</span>
                <h2>Thay đổi quyền truy cập gần nhất</h2>
                <p>Nhật ký cấp Trung tâm không trộn với lịch sử học tập hay lịch sử nội dung của ứng dụng con.</p>
              </div>
            </div>
            <div className={styles.auditList}>
              {bootstrap.auditLog.map((entry) => <article key={entry.id}>
                <div><strong>{auditLabels[entry.action] ?? entry.action}</strong><span>{formatTime(entry.createdAt)}</span></div>
                <p><b>{entry.actor}</b> → {entry.target}</p>
                {Object.keys(entry.detail).length
                  ? <small>{JSON.stringify(entry.detail)}</small>
                  : null}
              </article>)}
              {bootstrap.auditLog.length === 0
                ? <div className={styles.emptyState}>Chưa có sự kiện quản trị nào để hiển thị.</div>
                : null}
            </div>
          </section>
          : <div className={styles.error}>Vai trò hiện tại không có quyền xem nhật ký bảo mật.</div>
        : null}
    </section>
  </main>;
}
