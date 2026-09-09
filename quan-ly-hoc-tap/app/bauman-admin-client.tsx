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

type BaumanStatus = {
  ok: boolean;
  application: "bauman-master-ai";
  protocol: "bauman-control-v1";
  readiness?: Record<string, string>;
  capabilities?: readonly string[];
  counts?: {
    subclients?: number;
    independentSites?: number;
    modules?: number;
    devices?: number;
    pendingDevices?: number;
    approvedDevices?: number;
    blockedDevices?: number;
    activeSessions?: number;
  };
};

type BaumanSubclient = {
  id: string;
  name: string;
  kind: string;
  repository?: string;
  sourcePath?: string;
  state: string;
  controlState: string;
};

type BaumanDevice = {
  deviceId: string;
  deviceCode: string;
  displayName?: string | null;
  email?: string | null;
  status: "pending" | "approved" | "blocked";
  createdAt?: string | null;
  lastSeenAt?: string | null;
};

type DeviceResponse = {
  ok: boolean;
  devices?: BaumanDevice[];
  error?: string;
};

type Tab = "devices" | "subclients" | "contract";

function Gate({ access, busy, error, retry }: { access: AdminAccess | null; busy: boolean; error: string; retry: () => void }) {
  return <main className={styles.gateShell}><section className={styles.gateCard}>
    <span className={styles.sectionEyebrow}>BAUMAN CONTROL</span>
    <h1>{access?.status === "pending" ? "Thiết bị quản trị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Đang xác thực thiết bị quản trị…"}</h1>
    <p>{error || "Bauman chỉ nhận lệnh từ thiết bị quản trị đã được Trung tâm cấp quyền."}</p>
    {access?.deviceCode ? <div className={styles.gateCode}><span>Mã thiết bị</span><strong>{access.deviceCode}</strong></div> : null}
    <button className={styles.primaryButton} onClick={retry} disabled={busy}>{busy ? "Đang kiểm tra…" : "Kiểm tra lại"}</button>
  </section></main>;
}

export default function BaumanAdminClient({ user }: { user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [bootstrap, setBootstrap] = useState<AdminBootstrap | null>(null);
  const [status, setStatus] = useState<BaumanStatus | null>(null);
  const [subclients, setSubclients] = useState<BaumanSubclient[]>([]);
  const [devices, setDevices] = useState<BaumanDevice[]>([]);
  const [tab, setTab] = useState<Tab>("devices");
  const [busy, setBusy] = useState(true);
  const [deviceBusy, setDeviceBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    try {
      const connected = await connectAdminDevice("bauman-master-ai");
      setAccess(connected.access);
      setBootstrap(connected.bootstrap);
      if (!connected.bootstrap) return;
      const bridge = bridgeForApplication(connected.bootstrap);
      const [nextStatus, nextSubclients] = await Promise.all([
        upstreamJson<BaumanStatus>(bridge, "/api/control/status"),
        upstreamJson<{ ok: boolean; subclients: BaumanSubclient[] }>(bridge, "/api/control/subclients"),
      ]);
      setStatus(nextStatus);
      setSubclients(nextSubclients.subclients ?? []);
      if (nextStatus.readiness?.deviceRegistry === "available") {
        const response = await upstreamJson<DeviceResponse>(bridge, "/api/control/devices");
        setDevices(response.devices ?? []);
      } else {
        setDevices([]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải quản trị Bauman.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const deviceReviewReady = status?.readiness?.deviceRegistry === "available"
    && status?.readiness?.deviceGateway === "available";
  const pending = useMemo(() => devices.filter((device) => device.status === "pending").length, [devices]);
  const approved = useMemo(() => devices.filter((device) => device.status === "approved").length, [devices]);
  const blocked = useMemo(() => devices.filter((device) => device.status === "blocked").length, [devices]);

  async function manageDevice(device: BaumanDevice, operation: "approve" | "reject") {
    if (!bootstrap || !deviceReviewReady || access?.role !== "owner") return;
    if (operation === "reject" && !window.confirm(`Loại bỏ yêu cầu thiết bị ${device.deviceCode}?`)) return;
    setDeviceBusy(device.deviceId);
    setNotice("");
    try {
      const bridge = bridgeForApplication(bootstrap);
      const response = await upstreamJson<DeviceResponse>(bridge, "/api/control/devices", {
        method: "POST",
        body: { action: operation, deviceId: device.deviceId },
      });
      setDevices(response.devices ?? devices);
      setNotice(operation === "approve" ? `Đã duyệt ${device.deviceCode}.` : `Đã loại bỏ yêu cầu ${device.deviceCode}.`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Không thể cập nhật thiết bị Bauman.");
    } finally {
      setDeviceBusy("");
    }
  }

  if (!access || access.status !== "approved" || !bootstrap) {
    return <Gate access={access} busy={busy} error={error} retry={() => void load()} />;
  }

  return <>
    <section className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span>Thiết bị Bauman</span><strong>{deviceReviewReady ? devices.length : "—"}</strong><small>{deviceReviewReady ? "Registry production" : "Registry chưa nối"}</small></article>
      <article className={styles.summaryCard}><span>Chờ duyệt</span><strong>{deviceReviewReady ? pending : "—"}</strong><small>Yêu cầu cần quyết định</small></article>
      <article className={styles.summaryCard}><span>Đã duyệt</span><strong>{deviceReviewReady ? approved : "—"}</strong><small>Được phép truy cập</small></article>
      <article className={styles.summaryCard}><span>Đã chặn</span><strong>{deviceReviewReady ? blocked : "—"}</strong><small>Không được truy cập</small></article>
    </section>

    <div className={styles.tabs}>
      <button className={`${styles.tabButton} ${tab === "devices" ? styles.tabActive : ""}`} onClick={() => setTab("devices")}>Thiết bị & truy cập</button>
      <button className={`${styles.tabButton} ${tab === "subclients" ? styles.tabActive : ""}`} onClick={() => setTab("subclients")}>Môn học & site con</button>
      <button className={`${styles.tabButton} ${tab === "contract" ? styles.tabActive : ""}`} onClick={() => setTab("contract")}>Contract</button>
      <button className={styles.secondaryButton} onClick={() => void load()} disabled={busy}>{busy ? "Đang cập nhật…" : "Cập nhật"}</button>
    </div>

    {error ? <div className={styles.error}>{error}</div> : null}
    {notice ? <div className={styles.notice}>{notice}</div> : null}

    {tab === "devices" ? <section className={styles.panel}>
      <div className={styles.panelHeader}><div><span className={styles.sectionEyebrow}>DEVICE REVIEW</span><h2>Duyệt thiết bị Bauman</h2></div><strong>{deviceReviewReady ? "Control API sẵn sàng" : "Chưa có registry production"}</strong></div>
      {!deviceReviewReady ? <div className={styles.error}><strong>Không dựng nút Duyệt/Loại bỏ giả.</strong><br/>Control service Bauman hiện chưa công bố deviceRegistry + deviceGateway ở trạng thái available. Khi backend bật hai capability này, danh sách thiết bị và thao tác duyệt sẽ tự mở tại đây.</div> : null}
      {deviceReviewReady ? <div className={styles.versionList}>{devices.map((device) => <article className={styles.versionRow} key={device.deviceId}>
        <div className={styles.versionStatus}>{device.status === "pending" ? "Chờ duyệt" : device.status === "approved" ? "Đã duyệt" : "Đã chặn"}</div>
        <div className={styles.versionMeta}><strong>{device.displayName || device.email || device.deviceCode}</strong><small>{device.deviceCode}{device.lastSeenAt ? ` · tín hiệu ${new Date(device.lastSeenAt).toLocaleString("vi-VN")}` : ""}</small></div>
        <div className={styles.actionBar}>{device.status === "pending" ? <><button className={styles.primaryButton} disabled={deviceBusy === device.deviceId || access.role !== "owner"} onClick={() => void manageDevice(device, "approve")}>Duyệt</button><button className={styles.dangerButton} disabled={deviceBusy === device.deviceId || access.role !== "owner"} onClick={() => void manageDevice(device, "reject")}>Loại bỏ</button></> : <span>{device.status}</span>}</div>
      </article>)}{devices.length === 0 ? <p>Chưa có thiết bị Bauman nào trong registry.</p> : null}</div> : null}
    </section> : null}

    {tab === "subclients" ? <section className={styles.panel}><div className={styles.panelHeader}><div><span className={styles.sectionEyebrow}>SUB-CLIENT INVENTORY</span><h2>Cấu trúc học tập dưới Bauman</h2></div><strong>{subclients.length} site/module</strong></div><div className={styles.versionList}>{subclients.map((item) => <article className={styles.versionRow} key={item.id}><div className={styles.versionStatus}>{item.kind}</div><div className={styles.versionMeta}><strong>{item.name}</strong><small>{item.repository || item.sourcePath || item.id}</small></div><span>{item.controlState}</span></article>)}</div></section> : null}

    {tab === "contract" ? <section className={styles.panel}><span className={styles.sectionEyebrow}>BOUNDARY</span><h2>Trạng thái contract Bauman</h2><p>Vai trò quản trị hiện tại: <strong>{roleLabels[access.role]}</strong>. Trung tâm chỉ điều khiển thông qua Control API của Bauman; không mở runtime học tập thay cho khu quản trị.</p><div className={styles.reviewBox}><pre>{JSON.stringify({ protocol: status?.protocol, readiness: status?.readiness, capabilities: status?.capabilities, counts: status?.counts }, null, 2)}</pre></div></section> : null}
  </>;
}
