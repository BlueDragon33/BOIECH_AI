import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";
import {
  DeviceAccessError,
  auditHealthControlEvent,
  deviceErrorResponse,
  getCourseDatabase,
  getSiteAccessPolicy,
  revokeSiteSessionsForDevice,
  type SiteAccessPolicy,
} from "../../../device-auth.server";

export const dynamic = "force-dynamic";
export function OPTIONS(request: Request) { return controlPreflight(request); }

type Row = {
  device_id: string;
  display_code: string;
  status: "pending" | "approved" | "blocked";
  device_type: "desktop" | "phone" | "tablet";
  platform: string | null;
  browser: string | null;
  screen_width: number | null;
  screen_height: number | null;
  label: string | null;
  edit_enabled: number;
  calendar_enabled: number;
  created_at: string;
  approved_at: string | null;
  blocked_at: string | null;
  last_seen_at: string;
  last_activity_at: string;
};

function canView(role: string) { return ["viewer", "reviewer", "publisher", "owner"].includes(role); }
function canManage(role: string) { return ["publisher", "owner"].includes(role); }

function view(row: Row, policy: SiteAccessPolicy) {
  const lastSeen = Date.parse(row.last_seen_at);
  const active = row.status === "approved"
    && policy.accessEnabled
    && Number.isFinite(lastSeen)
    && Date.now() - lastSeen <= policy.sessionTimeoutSeconds * 1000;
  return {
    deviceId: row.device_id,
    deviceCode: row.display_code,
    status: row.status,
    deviceType: row.device_type,
    platform: row.platform,
    browser: row.browser,
    screenWidth: row.screen_width,
    screenHeight: row.screen_height,
    label: row.label,
    editEnabled: row.edit_enabled === 1,
    calendarEnabled: row.calendar_enabled === 1,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    blockedAt: row.blocked_at,
    lastSeenAt: row.last_seen_at,
    lastActivityAt: row.last_activity_at,
    offlineSinceAt: active || !Number.isFinite(lastSeen) ? null : new Date(lastSeen + policy.sessionTimeoutSeconds * 1000).toISOString(),
    active,
  };
}

async function listDevices() {
  const [database, policy] = await Promise.all([getCourseDatabase(), getSiteAccessPolicy()]);
  const rows = await database.prepare(
    `SELECT device_id, display_code, status, device_type, platform, browser, screen_width,
            screen_height, label, edit_enabled, calendar_enabled, created_at, approved_at, blocked_at,
            last_seen_at, last_activity_at
       FROM site_access_devices
      ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
               last_seen_at DESC LIMIT 300`,
  ).all<Row>();
  return rows.results.map((row) => view(row, policy));
}

export async function GET(request: Request) {
  try {
    const identity = await requireControlService(request);
    if (!canView(identity.role)) throw new DeviceAccessError("Không có quyền xem thiết bị Sức khỏe Y tế.", 403, "VIEWER_REQUIRED");
    return controlResponse({ application: "child-health", devices: await listDevices() }, 200, request);
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requireControlService(request);
    if (!canManage(identity.role)) throw new DeviceAccessError("Không có quyền thay đổi thiết bị Sức khỏe Y tế.", 403, "PUBLISHER_REQUIRED");
    const payload = (await request.json()) as Record<string, unknown>;
    const deviceId = typeof payload.deviceId === "string" ? payload.deviceId : "";
    const action = typeof payload.action === "string" ? payload.action : "";
    if (!/^[a-f0-9]{64}$/.test(deviceId)) throw new DeviceAccessError("Mã thiết bị không hợp lệ.", 400, "INVALID_DEVICE");
    const database = await getCourseDatabase();
    const exists = await database.prepare("SELECT device_id, display_code, status FROM site_access_devices WHERE device_id = ?")
      .bind(deviceId).first<{ device_id: string; display_code: string; status: string }>();
    if (!exists) throw new DeviceAccessError("Không tìm thấy thiết bị.", 404, "DEVICE_NOT_FOUND");
    const trace = { deviceCode: exists.display_code, controlDeviceId: identity.controlDeviceId, ticketId: identity.ticketId };

    if (action === "approve") {
      await database.prepare("UPDATE site_access_devices SET status = 'approved', approved_at = CURRENT_TIMESTAMP, blocked_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?")
        .bind(deviceId).run();
      await auditHealthControlEvent(identity.actor, "site_device_approved", deviceId, trace);
    } else if (action === "block") {
      await database.prepare("UPDATE site_access_devices SET status = 'blocked', blocked_at = CURRENT_TIMESTAMP, edit_enabled = 0, calendar_enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?")
        .bind(deviceId).run();
      await revokeSiteSessionsForDevice(deviceId, identity.actor, "Thiết bị bị khóa từ Trung tâm Quản trị");
      await auditHealthControlEvent(identity.actor, "site_device_blocked", deviceId, trace);
    } else if (action === "unblock") {
      await database.prepare("UPDATE site_access_devices SET status = 'approved', approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP), blocked_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?")
        .bind(deviceId).run();
      await auditHealthControlEvent(identity.actor, "site_device_unblocked", deviceId, trace);
    } else if (action === "enable-edit" || action === "disable-edit") {
      if (exists.status !== "approved") throw new DeviceAccessError("Chỉ thiết bị đang được phép truy cập mới có thể cấp quyền sửa.", 409, "DEVICE_ACCESS_REQUIRED");
      const enabled = action === "enable-edit";
      await database.prepare("UPDATE site_access_devices SET edit_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?")
        .bind(enabled ? 1 : 0, deviceId).run();
      await auditHealthControlEvent(identity.actor, enabled ? "site_device_edit_enabled" : "site_device_edit_disabled", deviceId, trace);
    } else if (action === "enable-calendar" || action === "disable-calendar") {
      if (exists.status !== "approved") throw new DeviceAccessError("Chỉ thiết bị đang được phép truy cập mới có thể cấp quyền Google Calendar.", 409, "DEVICE_ACCESS_REQUIRED");
      const enabled = action === "enable-calendar";
      await database.prepare("UPDATE site_access_devices SET calendar_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?")
        .bind(enabled ? 1 : 0, deviceId).run();
      await auditHealthControlEvent(identity.actor, enabled ? "site_device_calendar_enabled" : "site_device_calendar_disabled", deviceId, trace);
    } else if (action === "label") {
      const label = typeof payload.label === "string" ? payload.label.trim().slice(0, 80) : "";
      await database.prepare("UPDATE site_access_devices SET label = ?, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?")
        .bind(label || null, deviceId).run();
      await auditHealthControlEvent(identity.actor, "site_device_label_updated", deviceId, { ...trace, label });
    } else {
      throw new DeviceAccessError("Thao tác quản lý thiết bị không hợp lệ.", 400, "INVALID_DEVICE_ACTION");
    }
    return controlResponse({ application: "child-health", devices: await listDevices() }, 200, request);
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}
