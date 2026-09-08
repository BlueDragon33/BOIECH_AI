from pathlib import Path

p = Path("quan-ly-hoc-tap/app/health-control-center-v2.tsx")
text = p.read_text()

old_type = '''type HealthControlStatus = {
  application: "child-health";
  contractVersion: number;
  service: "online" | "paused";
  serverTime: string;
  devices: { total: number; pending: number; approved: number; blocked: number };
  sessions: { total: number; active: number; revoked: number; expired: number };
  policy: HealthPolicy;
};'''
new_type = '''type HealthControlStatus = {
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
};'''
if old_type not in text:
    raise SystemExit("HealthControlStatus block not found")
text = text.replace(old_type, new_type, 1)

old_action = '''  async function deviceAction(device: HealthDevice, action: string, extra: Record<string, unknown> = {}) {
    if (["set-device-type", "clear-device-type", "ack-environment"].includes(action) && (controlStatus?.contractVersion ?? 0) < 3) {
      setError("Health_Care production chưa chạy Device Contract v3. Chức năng này sẽ tự mở sau khi backend Health được deploy.");
      return;
    }
'''
new_action = '''  async function deviceAction(device: HealthDevice, action: string, extra: Record<string, unknown> = {}) {
    const capabilities = controlStatus?.capabilities ?? [];
    const supportsDeviceReview = capabilities.includes("device-review-v1") || (capabilities.length === 0 && (controlStatus?.contractVersion ?? 0) >= 3);
    if (["set-device-type", "clear-device-type", "ack-environment"].includes(action) && !supportsDeviceReview) {
      setError("Health_Care production chưa công bố capability device-review-v1. Chức năng này sẽ tự mở khi backend Health tương thích được deploy.");
      return;
    }
'''
if old_action not in text:
    raise SystemExit("deviceAction gate not found")
text = text.replace(old_action, new_action, 1)

old_support = '''  const appBridge = bridgeForApplication(bootstrap);
  const deviceReviewSupported = (controlStatus?.contractVersion ?? 0) >= 3;
'''
new_support = '''  const appBridge = bridgeForApplication(bootstrap);
  const healthCapabilities = controlStatus?.capabilities ?? [];
  const deviceReviewSupported = healthCapabilities.includes("device-review-v1") || (healthCapabilities.length === 0 && (controlStatus?.contractVersion ?? 0) >= 3);
  const canonicalHealthId = controlStatus?.canonicalApplication ?? "suc-khoe-y-te";
'''
if old_support not in text:
    raise SystemExit("device review support block not found")
text = text.replace(old_support, new_support, 1)

old_summary = '''      <article><span>Dịch vụ</span><strong className={controlStatus?.service === "paused" ? styles.paused : styles.online}>{controlStatus?.service === "paused" ? "Tạm dừng" : "Online"}</strong><small>Contract v{controlStatus?.contractVersion ?? "—"}</small></article>'''
new_summary = '''      <article><span>Dịch vụ</span><strong className={controlStatus?.service === "paused" ? styles.paused : styles.online}>{controlStatus?.service === "paused" ? "Tạm dừng" : "Online"}</strong><small>{canonicalHealthId} · Contract v{controlStatus?.contractVersion ?? "—"}</small></article>'''
if old_summary not in text:
    raise SystemExit("service summary not found")
text = text.replace(old_summary, new_summary, 1)

old_panel = '''      <div className={styles.panelHead}><div><span className={styles.eyebrow}>Kết nối hai hệ thống</span><h2>Trạng thái Control Plane</h2><p>Đây là lớp kết nối, không phải dashboard sức khỏe của trẻ.</p></div><div className={styles.actor}><strong>{user.displayName}</strong><small>{roleLabels[access.role]} · {access.deviceCode}</small></div></div>'''
new_panel = '''      <div className={styles.panelHead}><div><span className={styles.eyebrow}>Kết nối hai hệ thống</span><h2>Trạng thái Control Plane</h2><p>Đây là lớp kết nối, không phải dashboard sức khỏe của trẻ. Danh tính chuẩn: {canonicalHealthId}; alias kỹ thuật cũ vẫn được giữ để tương thích.</p></div><div className={styles.actor}><strong>{user.displayName}</strong><small>{roleLabels[access.role]} · {access.deviceCode}</small></div></div>'''
if old_panel not in text:
    raise SystemExit("overview panel head not found")
text = text.replace(old_panel, new_panel, 1)

old_wait = '''Device Contract v${controlStatus?.contractVersion ?? "—"} · chờ Health v3'''
new_wait = '''Contract v${controlStatus?.contractVersion ?? "—"} · chờ capability device-review-v1'''
if old_wait not in text:
    raise SystemExit("wait label not found")
text = text.replace(old_wait, new_wait, 1)

old_note = '''Phân loại thủ công và xác nhận cảnh báo sẽ mở khi Health_Care production nâng lên Device Contract v3.'''
new_note = '''Phân loại thủ công và xác nhận cảnh báo sẽ mở khi Health_Care production công bố capability device-review-v1.'''
if old_note not in text:
    raise SystemExit("compatibility note not found")
text = text.replace(old_note, new_note, 1)

p.write_text(text)
