from pathlib import Path

p = Path("quan-ly-hoc-tap/app/health-control-center-v2.tsx")
text = p.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f"pattern not found: {old[:140]!r}")
    text = text.replace(old, new, 1)

replace_once(
    '''  status: "pending" | "approved" | "blocked";\n  deviceType: "desktop" | "phone" | "tablet";\n  platform: string | null;''',
    '''  status: "pending" | "approved" | "blocked";\n  deviceType: "desktop" | "phone" | "tablet";\n  detectedDeviceType: "desktop" | "phone" | "tablet";\n  deviceTypeOverride: "desktop" | "phone" | "tablet" | null;\n  deviceTypeOverrideBy: string | null;\n  deviceTypeOverrideAt: string | null;\n  environmentChanged: boolean;\n  environmentChangeReason: string | null;\n  autoLabel: string | null;\n  platform: string | null;''',
)

replace_once(
    'type DeviceFilter = "all" | "pending" | "approved" | "blocked" | "desktop" | "phone" | "tablet" | "unnamed";',
    'type DeviceFilter = "all" | "pending" | "approved" | "blocked" | "desktop" | "phone" | "tablet" | "unnamed" | "attention";',
)

replace_once(
    '''  site_device_label_updated: "Đổi tên gợi nhớ",\n  site_session_started: "Tạo phiên truy cập",''',
    '''  site_device_label_updated: "Đổi tên gợi nhớ",\n  site_device_type_overridden: "Điều chỉnh loại thiết bị",\n  site_device_type_override_cleared: "Trả phân loại về tự động",\n  site_device_environment_changed: "Môi trường thiết bị thay đổi",\n  site_device_environment_acknowledged: "Đã kiểm tra thay đổi thiết bị",\n  site_session_started: "Tạo phiên truy cập",''',
)

replace_once(
    '''    lowConfidence: devices.filter((item) => item.classificationConfidence === "low").length,\n    calendar: devices.filter((item) => item.calendarEnabled).length,''',
    '''    lowConfidence: devices.filter((item) => item.classificationConfidence === "low").length,\n    attention: devices.filter((item) => item.environmentChanged || item.classificationConfidence === "low").length,\n    overridden: devices.filter((item) => item.deviceTypeOverride != null).length,\n    calendar: devices.filter((item) => item.calendarEnabled).length,''',
)

replace_once(
    '''    const matchesFilter = deviceFilter === "all" ? true\n      : deviceFilter === "unnamed" ? !device.label?.trim()\n      : deviceFilter === "desktop" || deviceFilter === "phone" || deviceFilter === "tablet" ? device.deviceType === deviceFilter\n      : device.status === deviceFilter;''',
    '''    const matchesFilter = deviceFilter === "all" ? true\n      : deviceFilter === "unnamed" ? !device.label?.trim()\n      : deviceFilter === "attention" ? device.environmentChanged || device.classificationConfidence === "low"\n      : deviceFilter === "desktop" || deviceFilter === "phone" || deviceFilter === "tablet" ? device.deviceType === deviceFilter\n      : device.status === deviceFilter;''',
)

replace_once(
    '''      device.label,\n      device.deviceCode,''',
    '''      device.label,\n      device.autoLabel,\n      device.deviceCode,''',
)

replace_once(
    '''      device.installationId,\n      device.timezone,''',
    '''      device.installationId,\n      device.deviceTypeOverrideBy,\n      device.environmentChangeReason,\n      device.timezone,''',
)

replace_once(
    '  async function deviceAction(device: HealthDevice, action: string) {',
    '  async function deviceAction(device: HealthDevice, action: string, extra: Record<string, unknown> = {}) {',
)

replace_once(
    '''      const body: Record<string, unknown> = { action, deviceId: device.deviceId };''',
    '''      const body: Record<string, unknown> = { action, deviceId: device.deviceId, ...extra };''',
)

replace_once(
    '''        : action === "disable-calendar" ? "Đã thu Google Calendar."\n        : "Đã lưu tên gợi nhớ.");''',
    '''        : action === "disable-calendar" ? "Đã thu Google Calendar."\n        : action === "set-device-type" ? "Đã lưu phân loại thủ công. Hệ thống vẫn giữ kết quả tự nhận diện để đối chiếu."\n        : action === "clear-device-type" ? "Đã trả loại thiết bị về kết quả tự động."\n        : action === "ack-environment" ? "Đã xác nhận kiểm tra thay đổi môi trường thiết bị."\n        : "Đã lưu tên gợi nhớ.");''',
)

replace_once(
    '''      <article><span>Thiết bị tự phân loại</span><strong>{devices.length}</strong><small>Máy tính {counts.desktop} · Điện thoại {counts.phone} · Tablet {counts.tablet}</small></article>''',
    '''      <article><span>Phân loại thiết bị</span><strong>{devices.length}</strong><small>PC {counts.desktop} · Phone {counts.phone} · Tablet {counts.tablet} · Cần xem {counts.attention}</small></article>''',
)

replace_once(
    '''<strong>{counts.lowConfidence ? `${counts.lowConfidence} thiết bị cần kiểm tra` : "Phân loại ổn định"}</strong>''',
    '''<strong>{counts.attention ? `${counts.attention} thiết bị cần kiểm tra` : `Ổn định · ${counts.overridden} chỉnh thủ công`}</strong>''',
)

replace_once(
    '''['unnamed','Chưa đặt tên'],['desktop','Máy tính'],['phone','Điện thoại'],['tablet','Tablet/iPad']''',
    '''['unnamed','Chưa đặt tên'],['attention','Cần kiểm tra'],['desktop','Máy tính'],['phone','Điện thoại'],['tablet','Tablet/iPad']''',
)

replace_once(
    '''<div className={styles.deviceIdentity}><div><strong>{device.label || device.deviceCode}</strong><span>{deviceTypeLabels[device.deviceType]} · Tự động · {deviceConfidenceLabels[device.classificationConfidence]}</span></div>''',
    '''<div className={styles.deviceIdentity}><div><strong>{device.label || device.autoLabel || device.deviceCode}</strong><span>{deviceTypeLabels[device.deviceType]} · {device.deviceTypeOverride ? "Đã chỉnh thủ công" : "Tự động"} · {deviceConfidenceLabels[device.classificationConfidence]}</span></div>''',
)

replace_once(
    '''<small>Cơ sở phân loại: {deviceReasonLabels[device.classificationReason || ""] || device.classificationReason || "Chưa có"}{device.metadataUpdatedAt ? ` · cập nhật ${formatDate(device.metadataUpdatedAt)}` : ""}</small><div className={styles.labelRow}>''',
    '''<small>Cơ sở phân loại: {deviceReasonLabels[device.classificationReason || ""] || device.classificationReason || "Chưa có"}{device.metadataUpdatedAt ? ` · cập nhật ${formatDate(device.metadataUpdatedAt)}` : ""}</small>{device.deviceTypeOverride ? <small>Đối chiếu tự động: {deviceTypeLabels[device.detectedDeviceType]} · chỉnh bởi {device.deviceTypeOverrideBy || "quản trị"} {device.deviceTypeOverrideAt ? `· ${formatDate(device.deviceTypeOverrideAt)}` : ""}</small> : null}{device.environmentChanged ? <small>⚠ Cần kiểm tra: {device.environmentChangeReason || "Môi trường thiết bị đã thay đổi đáng kể."}</small> : null}<div className={styles.labelRow}>''',
)

replace_once(
    '''</div></div>\n        <div className={styles.deviceFacts}><span>Truy cập</span>''',
    '''</div><div className={styles.labelRow}><select value={device.deviceTypeOverride ?? ""} disabled={busy || !canPublish(access.role)} onChange={(event) => { const next = event.target.value; void deviceAction(device, next ? "set-device-type" : "clear-device-type", next ? { deviceType: next } : {}); }}><option value="">Theo tự động ({deviceTypeLabels[device.detectedDeviceType]})</option><option value="desktop">Máy tính</option><option value="phone">Điện thoại</option><option value="tablet">Máy tính bảng / iPad</option></select>{device.environmentChanged ? <button type="button" disabled={busy || !canPublish(access.role)} onClick={() => void deviceAction(device, "ack-environment")}>Đã kiểm tra</button> : <span />}</div></div>\n        <div className={styles.deviceFacts}><span>Truy cập</span>''',
)

p.write_text(text)
print("Health device review UI patch applied")
