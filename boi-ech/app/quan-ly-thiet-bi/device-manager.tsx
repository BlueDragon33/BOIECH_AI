"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Device = {
  deviceId: string;
  deviceCode: string;
  status: "pending" | "approved" | "blocked";
  label: string | null;
  learnerName: string | null;
  className: string | null;
  phone: string | null;
  registrationComplete: boolean;
  createdAt: string;
  approvedAt: string | null;
  blockedAt: string | null;
  lastSeenAt: string;
  completedLessons: number;
  completedSteps: number;
};

type DeviceResponse = { devices?: Device[]; error?: string };

const statusLabels = {
  pending: "Chờ duyệt",
  approved: "Đã cấp quyền",
  blocked: "Đã khóa",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function DeviceManager() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});

  async function readResponse(response: Response) {
    const data = (await response.json()) as DeviceResponse;
    if (!response.ok) throw new Error(data.error ?? "Không thể quản lý thiết bị.");
    setDevices(data.devices ?? []);
    setLabels(Object.fromEntries((data.devices ?? []).map((device) => [device.deviceId, device.label ?? ""])));
  }

  async function refresh() {
    setLoading(true);
    try {
      await readResponse(await fetch("/api/admin/devices", { credentials: "same-origin", cache: "no-store" }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể tải danh sách thiết bị.");
    } finally {
      setLoading(false);
    }
  }

  async function act(action: "approve" | "block" | "label", deviceId: string) {
    setNotice("");
    try {
      await readResponse(await fetch("/api/admin/devices", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, deviceId, label: labels[deviceId] ?? "" }),
      }));
      setNotice(action === "approve" ? "Đã cấp quyền cho thiết bị." : action === "block" ? "Đã khóa thiết bị." : "Đã lưu tên gợi nhớ.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể cập nhật thiết bị.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/devices", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as DeviceResponse;
        if (!response.ok) throw new Error(data.error ?? "Không thể quản lý thiết bị.");
        if (cancelled) return;
        setDevices(data.devices ?? []);
        setLabels(Object.fromEntries((data.devices ?? []).map((device) => [device.deviceId, device.label ?? ""])));
      })
      .catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : "Không thể tải danh sách thiết bị."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const counts = {
    pending: devices.filter((device) => device.status === "pending").length,
    approved: devices.filter((device) => device.status === "approved").length,
    blocked: devices.filter((device) => device.status === "blocked").length,
  };

  return (
    <main className="device-admin">
      <header className="device-admin-hero">
        <div><span>Quản trị riêng</span><h1>Thiết bị học Bơi ếch</h1><p>Duyệt đúng mã người học gửi. Người học không cần tài khoản và trang học chỉ mở khi thiết bị ký đúng thử thách của máy chủ.</p></div>
        <Link href="/">Mở website học <span>→</span></Link>
      </header>

      <section className="device-admin-summary" aria-label="Tổng hợp thiết bị">
        <article><span>Chờ duyệt</span><strong>{counts.pending}</strong></article>
        <article><span>Đã cấp quyền</span><strong>{counts.approved}</strong></article>
        <article><span>Đã khóa</span><strong>{counts.blocked}</strong></article>
        <button onClick={() => void refresh()} disabled={loading}>{loading ? "Đang tải…" : "Làm mới"}</button>
      </section>

      {notice && <div className="device-admin-notice" role="status">{notice}</div>}

      <section className="device-admin-list">
        {loading && devices.length === 0 ? <div className="device-admin-empty">Đang đọc danh sách thiết bị…</div> : null}
        {!loading && devices.length === 0 ? <div className="device-admin-empty">Chưa có thiết bị nào gửi yêu cầu.</div> : null}
        {devices.map((device) => (
          <article key={device.deviceId} className={`device-admin-card ${device.status}`}>
            <div className="device-admin-code"><span>Mã thiết bị</span><strong>{device.deviceCode}</strong><small>{statusLabels[device.status]}</small></div>
            <div className="device-admin-details">
              <label>Tên gợi nhớ<input value={labels[device.deviceId] ?? ""} maxLength={80} placeholder="Ví dụ: Máy học viên Nam" onChange={(event) => setLabels((current) => ({ ...current, [device.deviceId]: event.target.value }))} /></label>
              <dl><div><dt>Người học</dt><dd>{device.learnerName || "Chưa gửi"}</dd></div><div><dt>Lớp / SĐT</dt><dd>{device.className || "—"} · {device.phone || "—"}</dd></div><div><dt>Yêu cầu lúc</dt><dd>{formatDate(device.createdAt)}</dd></div><div><dt>Hoạt động gần nhất</dt><dd>{formatDate(device.lastSeenAt)}</dd></div><div><dt>Tiến độ</dt><dd>{device.completedLessons}/8 bài · {device.completedSteps} mốc</dd></div></dl>
            </div>
            <div className="device-admin-actions">
              <button onClick={() => void act("label", device.deviceId)}>Lưu tên</button>
              {device.status !== "approved" ? <button className="approve" disabled={!device.registrationComplete} title={device.registrationComplete ? "Duyệt miễn phí" : "Chờ thiết bị gửi đủ hồ sơ"} onClick={() => void act("approve", device.deviceId)}>Cấp quyền miễn phí</button> : null}
              {device.status !== "blocked" ? <button className="block" onClick={() => void act("block", device.deviceId)}>Khóa thiết bị</button> : null}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
