from pathlib import Path

p = Path("quan-ly-hoc-tap/app/health-control-center-v2.tsx")
text = p.read_text()

def replace_once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f"pattern not found: {old[:140]!r}")
    text = text.replace(old, new, 1)

replace_once(
'''  platform: string | null;
  browser: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  label: string | null;''',
'''  platform: string | null;
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
  label: string | null;''')

replace_once(
'''const deviceTypeLabels = { desktop: "Máy tính", phone: "Điện thoại", tablet: "Máy tính bảng / iPad" } as const;
const deviceStatusLabels = { pending: "Chờ duyệt", approved: "Được truy cập", blocked: "Đã khóa" } as const;''',
'''const deviceTypeLabels = { desktop: "Máy tính", phone: "Điện thoại", tablet: "Máy tính bảng / iPad" } as const;
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
const deviceStatusLabels = { pending: "Chờ duyệt", approved: "Được truy cập", blocked: "Đã khóa" } as const;''')

replace_once(
'''function shortSession(value: string) { return value.length > 18 ? `${value.slice(0, 9)}…${value.slice(-6)}` : value; }''',
'''function shortSession(value: string) { return value.length > 18 ? `${value.slice(0, 9)}…${value.slice(-6)}` : value; }
function shortInstallation(value?: string | null) {
  if (!value) return "—";
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}
function screenLabel(device: HealthDevice) {
  if (!device.screenWidth || !device.screenHeight) return "Màn hình chưa rõ";
  return `${device.screenWidth}×${device.screenHeight}`;
}''')

replace_once(
'''    unnamed: devices.filter((item) => !item.label?.trim()).length,
    calendar: devices.filter((item) => item.calendarEnabled).length,''',
'''    unnamed: devices.filter((item) => !item.label?.trim()).length,
    desktop: devices.filter((item) => item.deviceType === "desktop").length,
    phone: devices.filter((item) => item.deviceType === "phone").length,
    tablet: devices.filter((item) => item.deviceType === "tablet").length,
    lowConfidence: devices.filter((item) => item.classificationConfidence === "low").length,
    calendar: devices.filter((item) => item.calendarEnabled).length,''')

replace_once(
'''    return [device.label, device.deviceCode, device.platform, device.browser, deviceTypeLabels[device.deviceType]]
      .filter(Boolean).join(" ").toLocaleLowerCase("vi").includes(query);''',
'''    return [
      device.label,
      device.deviceCode,
      device.platform,
      device.osName,
      device.browser,
      device.browserVersion,
      device.installationId,
      device.timezone,
      deviceTypeLabels[device.deviceType],
      deviceConfidenceLabels[device.classificationConfidence],
    ].filter(Boolean).join(" ").toLocaleLowerCase("vi").includes(query);''')

replace_once(
'''      <article><span>Chưa đặt tên</span><strong>{counts.unnamed}</strong><small>Cần phân loại</small></article>''',
'''      <article><span>Thiết bị tự phân loại</span><strong>{devices.length}</strong><small>Máy tính {counts.desktop} · Điện thoại {counts.phone} · Tablet {counts.tablet}</small></article>''')

replace_once(
'''      <div className={styles.panelHead}><div><span className={styles.eyebrow}>Thiết bị đầu vào</span><h2>Nhận diện, phân loại và cấp quyền</h2><p>Quyền truy cập, quyền sửa và Google Calendar là ba lớp riêng.</p></div></div>
      <div className={styles.searchRow}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, mã SK, nền tảng hoặc trình duyệt…" /><span>{visibleDevices.length}/{devices.length}</span></div>''',
'''      <div className={styles.panelHead}><div><span className={styles.eyebrow}>Thiết bị đầu vào · tự động</span><h2>Nhận diện, phân loại và cấp quyền</h2><p>Health_Care tự nhận diện Máy tính / Điện thoại / Máy tính bảng trước khi thiết bị xuất hiện tại đây. Phân loại chỉ hỗ trợ quản trị; quyền truy cập vẫn phải được cấp riêng.</p></div><strong>{counts.lowConfidence ? `${counts.lowConfidence} thiết bị cần kiểm tra` : "Phân loại ổn định"}</strong></div>
      <div className={styles.searchRow}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, mã SK, OS, trình duyệt hoặc Installation ID…" /><span>{visibleDevices.length}/{devices.length}</span></div>''')

replace_once(
'''        <div className={styles.deviceIdentity}><div><strong>{device.label || device.deviceCode}</strong><span>{deviceTypeLabels[device.deviceType]}</span></div><small>{device.deviceCode} · {device.platform || "Nền tảng chưa rõ"} · {device.browser || "Trình duyệt chưa rõ"}</small><div className={styles.labelRow}><input value={labels[device.deviceId] ?? ""} maxLength={80} disabled={!canPublish(access.role)} onChange={(event) => setLabels((current) => ({ ...current, [device.deviceId]: event.target.value }))} placeholder="Tên gợi nhớ" /><button type="button" disabled={busy || !canPublish(access.role)} onClick={() => void deviceAction(device, "label")}>Lưu tên</button></div></div>''',
'''        <div className={styles.deviceIdentity}><div><strong>{device.label || device.deviceCode}</strong><span>{deviceTypeLabels[device.deviceType]} · Tự động · {deviceConfidenceLabels[device.classificationConfidence]}</span></div><small>{device.deviceCode} · {device.osName || device.platform || "Hệ điều hành chưa rõ"} · {device.browser || "Trình duyệt chưa rõ"}{device.browserVersion ? ` ${device.browserVersion}` : ""}</small><small>{screenLabel(device)} · Cảm ứng {device.touchPoints ?? 0} điểm · PWA {device.pwaMode ? "Có" : "Không"} · Installation {shortInstallation(device.installationId)}</small><small>Cơ sở phân loại: {deviceReasonLabels[device.classificationReason || ""] || device.classificationReason || "Chưa có"}{device.metadataUpdatedAt ? ` · cập nhật ${formatDate(device.metadataUpdatedAt)}` : ""}</small><div className={styles.labelRow}><input value={labels[device.deviceId] ?? ""} maxLength={80} disabled={!canPublish(access.role)} onChange={(event) => setLabels((current) => ({ ...current, [device.deviceId]: event.target.value }))} placeholder="Tên gợi nhớ, ví dụ: Laptop của Nam" /><button type="button" disabled={busy || !canPublish(access.role)} onClick={() => void deviceAction(device, "label")}>Lưu tên</button></div></div>''')

p.write_text(text)
print("Health device classification UI patch applied")
