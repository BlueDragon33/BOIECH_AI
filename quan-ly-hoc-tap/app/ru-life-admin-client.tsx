"use client";

import { useEffect, useMemo, useState } from "react";
import {
  bridgeForApplication,
  connectAdminDevice,
  roleLabels,
  upstreamJson,
  type AdminAccess,
  type AdminBootstrap,
} from "./admin-device-client";
import styles from "./application-admin.module.css";

type RuDevice = {
  deviceId: string;
  deviceCode: string;
  status: "pending" | "approved" | "blocked";
  userName?: string | null;
  userCode?: string | null;
  label?: string | null;
  deviceClass?: "computer" | "phone" | "tablet" | "unknown";
  osName?: string | null;
  browserName?: string | null;
  screen?: string | null;
  createdAt?: string | null;
  lastSeenAt?: string | null;
  active?: boolean;
};

type RuResponse = {
  ok: boolean;
  application: "ru-life";
  devices?: RuDevice[];
  error?: string;
};

type Draft = { userName: string; userCode: string };

function Gate({ access, busy, error, retry }: { access: AdminAccess | null; busy: boolean; error: string; retry: () => void }) {
  return <main className={styles.gateShell}><section className={styles.gateCard}>
    <span className={styles.sectionEyebrow}>HÒA NHẬP NGA · CONTROL</span>
    <h1>{access?.status === "pending" ? "Thiết bị quản trị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Đang xác thực thiết bị quản trị…"}</h1>
    <p>{error || "Thiết bị HN vẫn thuộc registry RU_LIFE. Khu này chỉ gửi lệnh qua Control API."}</p>
    {access?.deviceCode ? <div className={styles.gateCode}><span>Mã thiết bị quản trị</span><strong>{access.deviceCode}</strong></div> : null}
    <button className={styles.primaryButton} onClick={retry} disabled={busy}>{busy ? "Đang kiểm tra…" : "Kiểm tra lại"}</button>
  </section></main>;
}

function deviceType(value: RuDevice["deviceClass"]) {
  return value === "phone" ? "Điện thoại" : value === "tablet" ? "Máy tính bảng" : value === "computer" ? "Máy tính" : "Chưa xác định";
}

export default function RuLifeAdminClient({ user }: { user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [bootstrap, setBootstrap] = useState<AdminBootstrap | null>(null);
  const [devices, setDevices] = useState<RuDevice[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(true);
  const [deviceBusy, setDeviceBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setBusy(true); setError("");
    try {
      const connected = await connectAdminDevice("ru-life");
      setAccess(connected.access); setBootstrap(connected.bootstrap);
      if (!connected.bootstrap) return;
      const bridge = bridgeForApplication(connected.bootstrap);
      const response = await upstreamJson<RuResponse>(bridge, "/api/control/devices");
      const next = response.devices ?? [];
      setDevices(next);
      setDrafts((current) => {
        const updated = { ...current };
        for (const device of next) {
          if (!updated[device.deviceId]) updated[device.deviceId] = { userName: device.userName ?? "", userCode: device.userCode ?? "" };
        }
        return updated;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải quản trị Hòa nhập Nga.");
    } finally { setBusy(false); }
  }

  useEffect(() => { void load(); }, []);

  const pending = useMemo(() => devices.filter((device) => device.status === "pending").length, [devices]);
  const approved = useMemo(() => devices.filter((device) => device.status === "approved").length, [devices]);
  const blocked = useMemo(() => devices.filter((device) => device.status === "blocked").length, [devices]);
  const canManage = access?.role === "publisher" || access?.role === "owner";

  async function manage(device: RuDevice, operation: "approve" | "block") {
    if (!bootstrap || !canManage) return;
    const draft = drafts[device.deviceId] ?? { userName: "", userCode: "" };
    if (operation === "approve" && (!draft.userName.trim() || !draft.userCode.trim())) {
      setNotice("Phải nhập Họ tên và Mã người dùng trước khi duyệt thiết bị Hòa nhập Nga.");
      return;
    }
    if (operation === "block" && !window.confirm(`Loại bỏ/khóa thiết bị ${device.deviceCode}?`)) return;
    setDeviceBusy(device.deviceId); setNotice("");
    try {
      const bridge = bridgeForApplication(bootstrap);
      const response = await upstreamJson<RuResponse>(bridge, "/api/control/devices", {
        method: "POST",
        body: operation === "approve"
          ? { operation: "approve", targetDeviceId: device.deviceId, userName: draft.userName.trim(), userCode: draft.userCode.trim() }
          : { operation: "block", targetDeviceId: device.deviceId },
      });
      setDevices(response.devices ?? devices);
      setNotice(operation === "approve" ? `Đã duyệt ${device.deviceCode}. Trạng thái đã ghi vào RU_LIFE.` : `Đã loại bỏ ${device.deviceCode}. Phiên đang hoạt động (nếu có) đã bị thu hồi.`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị Hòa nhập Nga.");
    } finally { setDeviceBusy(""); }
  }

  if (!access || access.status !== "approved" || !bootstrap) return <Gate access={access} busy={busy} error={error} retry={() => void load()} />;

  return <>
    <section className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span>Thiết bị HN</span><strong>{devices.length}</strong><small>Registry thuộc RU_LIFE</small></article>
      <article className={styles.summaryCard}><span>Chờ duyệt</span><strong>{pending}</strong><small>Cần gắn người dùng trước khi duyệt</small></article>
      <article className={styles.summaryCard}><span>Đã duyệt</span><strong>{approved}</strong><small>Được phép vào workspace</small></article>
      <article className={styles.summaryCard}><span>Đã chặn</span><strong>{blocked}</strong><small>Không được truy cập</small></article>
    </section>

    <div className={styles.tabs}>
      <strong>Vai trò: {roleLabels[access.role]}</strong>
      <button className={styles.secondaryButton} onClick={() => void load()} disabled={busy}>{busy ? "Đang đồng bộ…" : "Đồng bộ lại"}</button>
    </div>
    {error ? <div className={styles.error}>{error}</div> : null}
    {notice ? <div className={styles.notice}>{notice}</div> : null}

    <section className={styles.panel}>
      <div className={styles.panelHeader}><div><span className={styles.sectionEyebrow}>DEVICE REVIEW</span><h2>Thiết bị Hòa nhập Nga</h2></div><strong>Control API RU_LIFE</strong></div>
      <div className={styles.versionList}>{devices.map((device) => {
        const draft = drafts[device.deviceId] ?? { userName: device.userName ?? "", userCode: device.userCode ?? "" };
        return <article className={styles.versionRow} key={device.deviceId}>
          <div className={styles.versionStatus}>{device.status === "pending" ? "Chờ duyệt" : device.status === "approved" ? "Đã duyệt" : "Đã chặn"}</div>
          <div className={styles.versionMeta}><strong>{device.userName || device.label || `${deviceType(device.deviceClass)} · ${device.osName || "Unknown"}`}</strong><small>{device.deviceCode} · {deviceType(device.deviceClass)} · {device.browserName || "Browser"}{device.lastSeenAt ? ` · ${new Date(device.lastSeenAt).toLocaleString("vi-VN")}` : ""}</small>
            {device.status === "pending" ? <div className={styles.actionBar} style={{ marginTop: 10 }}><input value={draft.userName} onChange={(event) => setDrafts((current) => ({ ...current, [device.deviceId]: { ...draft, userName: event.target.value } }))} placeholder="Họ tên người dùng"/><input value={draft.userCode} onChange={(event) => setDrafts((current) => ({ ...current, [device.deviceId]: { ...draft, userCode: event.target.value } }))} placeholder="Mã người dùng"/></div> : null}
          </div>
          <div className={styles.actionBar}>{device.status === "pending" ? <><button className={styles.primaryButton} disabled={!canManage || deviceBusy === device.deviceId} onClick={() => void manage(device, "approve")}>{deviceBusy === device.deviceId ? "Đang xử lý…" : "Duyệt"}</button><button className={styles.dangerButton} disabled={!canManage || deviceBusy === device.deviceId} onClick={() => void manage(device, "block")}>Loại bỏ</button></> : device.status === "approved" ? <><span>{device.active ? "Online · đã duyệt" : "Đã duyệt"}</span><button className={styles.dangerButton} disabled={!canManage || deviceBusy === device.deviceId} onClick={() => void manage(device, "block")}>Khóa</button></> : <span>Đã chặn</span>}</div>
        </article>;
      })}{!devices.length ? <p>Chưa có thiết bị Hòa nhập Nga trong registry.</p> : null}</div>
    </section>
  </>;
}
