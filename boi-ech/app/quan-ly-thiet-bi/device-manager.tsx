"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DeviceType = "desktop" | "phone" | "tablet";
type Device = {
  deviceId: string; deviceCode: string; status: "pending" | "approved" | "blocked";
  deviceType: DeviceType; platform: string | null; browser: string | null; label: string | null;
  learnerName: string | null; className: string | null; phone: string | null; registrationComplete: boolean;
  createdAt: string; lastSeenAt: string; completedLessons: number; completedSteps: number;
};
type DeviceResponse = { devices?: Device[]; error?: string };
type Filter = "all" | DeviceType;

const statusLabels = { pending: "Chờ duyệt", approved: "Đã cấp quyền", blocked: "Đã khóa" } as const;
const typeLabels: Record<DeviceType, string> = { desktop: "Máy tính", phone: "Điện thoại", tablet: "Máy tính bảng / iPad" };
function formatDate(value: string | null) { if (!value) return "—"; return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }

export default function DeviceManager() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>("all");

  function apply(data: DeviceResponse) {
    setDevices(data.devices ?? []);
    setLabels(Object.fromEntries((data.devices ?? []).map((device) => [device.deviceId, device.label ?? ""])));
  }
  async function read(response: Response) {
    const data = await response.json() as DeviceResponse;
    if (!response.ok) throw new Error(data.error ?? "Không thể quản lý thiết bị.");
    apply(data);
  }
  async function refresh() {
    setLoading(true); setNotice("");
    try { await read(await fetch("/api/admin/devices", { credentials: "same-origin", cache: "no-store" })); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Không thể tải danh sách thiết bị."); }
    finally { setLoading(false); }
  }
  async function act(action: "approve" | "block" | "label", deviceId: string) {
    setNotice("");
    try {
      await read(await fetch("/api/admin/devices", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, deviceId, label: labels[deviceId] ?? "" }) }));
      setNotice(action === "approve" ? "Đã cấp quyền cho thiết bị." : action === "block" ? "Đã khóa thiết bị." : "Đã lưu tên gợi nhớ.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể cập nhật thiết bị."); }
  }
  useEffect(() => { void refresh(); }, []);

  const counts = { pending: devices.filter(d => d.status === "pending").length, approved: devices.filter(d => d.status === "approved").length, blocked: devices.filter(d => d.status === "blocked").length };
  const typeCounts = { desktop: devices.filter(d => d.deviceType === "desktop").length, phone: devices.filter(d => d.deviceType === "phone").length, tablet: devices.filter(d => d.deviceType === "tablet").length };
  const visible = useMemo(() => filter === "all" ? devices : devices.filter(d => d.deviceType === filter), [devices, filter]);

  return <main className="device-admin">
    <header className="device-admin-hero"><div><span>Quản trị riêng</span><h1>Thiết bị học Bơi ếch</h1><p>Hệ thống tự nhận diện máy tính, điện thoại hoặc máy tính bảng/iPad. Mã BE, khóa thiết bị, hồ sơ, tiến độ và thanh toán hiện có được giữ nguyên.</p></div><Link href="/">Mở website học <span>→</span></Link></header>
    <section className="device-admin-summary"><article><span>Chờ duyệt</span><strong>{counts.pending}</strong></article><article><span>Đã cấp quyền</span><strong>{counts.approved}</strong></article><article><span>Đã khóa</span><strong>{counts.blocked}</strong></article><button onClick={() => void refresh()} disabled={loading}>{loading ? "Đang tải…" : "Làm mới"}</button></section>
    <section className="device-admin-summary" aria-label="Phân loại thiết bị">
      <button onClick={() => setFilter("all")} aria-pressed={filter === "all"}>Tất cả · {devices.length}</button>
      <button onClick={() => setFilter("desktop")} aria-pressed={filter === "desktop"}>Máy tính · {typeCounts.desktop}</button>
      <button onClick={() => setFilter("phone")} aria-pressed={filter === "phone"}>Điện thoại · {typeCounts.phone}</button>
      <button onClick={() => setFilter("tablet")} aria-pressed={filter === "tablet"}>Tablet/iPad · {typeCounts.tablet}</button>
    </section>
    {notice ? <div className="device-admin-notice" role="status">{notice}</div> : null}
    <section className="device-admin-list">
      {loading && devices.length === 0 ? <div className="device-admin-empty">Đang đọc danh sách thiết bị…</div> : null}
      {!loading && visible.length === 0 ? <div className="device-admin-empty">Không có thiết bị phù hợp bộ lọc.</div> : null}
      {visible.map(device => <article key={device.deviceId} className={`device-admin-card ${device.status}`}>
        <div className="device-admin-code"><span>{typeLabels[device.deviceType]}</span><strong>{device.deviceCode}</strong><small>{statusLabels[device.status]}</small></div>
        <div className="device-admin-details">
          <label>Tên gợi nhớ<input value={labels[device.deviceId] ?? ""} maxLength={80} placeholder="Ví dụ: Máy học viên Nam" onChange={event => setLabels(current => ({ ...current, [device.deviceId]: event.target.value }))} /></label>
          <dl><div><dt>Thiết bị</dt><dd>{typeLabels[device.deviceType]} · {device.platform || "Nền tảng chưa rõ"} · {device.browser || "Trình duyệt chưa rõ"}</dd></div><div><dt>Người học</dt><dd>{device.learnerName || "Chưa gửi"}</dd></div><div><dt>Lớp / SĐT</dt><dd>{device.className || "—"} · {device.phone || "—"}</dd></div><div><dt>Yêu cầu lúc</dt><dd>{formatDate(device.createdAt)}</dd></div><div><dt>Hoạt động gần nhất</dt><dd>{formatDate(device.lastSeenAt)}</dd></div><div><dt>Tiến độ</dt><dd>{device.completedLessons}/8 bài · {device.completedSteps} mốc</dd></div></dl>
        </div>
        <div className="device-admin-actions"><button onClick={() => void act("label", device.deviceId)}>Lưu tên</button>{device.status !== "approved" ? <button className="approve" disabled={!device.registrationComplete} onClick={() => void act("approve", device.deviceId)}>Cấp quyền miễn phí</button> : null}{device.status !== "blocked" ? <button className="block" onClick={() => void act("block", device.deviceId)}>Khóa thiết bị</button> : null}</div>
      </article>)}
    </section>
  </main>;
}
