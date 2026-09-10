import {
  ClientDeviceBrokerError,
  manageClientDevice,
  readClientDeviceSnapshot,
  type ClientDeviceAutomationMode,
  type ClientDeviceOperation,
  type ClientDeviceSnapshot,
} from "../../client-device-broker.server";
import {
  ControlAccessError,
  controlErrorResponse,
  getControlDatabase,
  verifyControlProof,
  type ControlRole,
} from "../../control-device.server";

export const dynamic = "force-dynamic";

type PolicyRow = {
  application_id: string;
  mode: ClientDeviceAutomationMode;
  remove_after_hours: number;
  updated_by: string | null;
  updated_at: string;
};

export type ClientDeviceAutomationPolicy = {
  applicationId: string;
  mode: ClientDeviceAutomationMode;
  removeAfterHours: number;
  updatedBy: string | null;
  updatedAt: string | null;
};

const policyApplications = ["child-health", "bauman-master-ai", "ru-life", "boi-ech"] as const;

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
}

function canManage(role: ControlRole) { return role === "publisher" || role === "owner"; }

async function policies(): Promise<ClientDeviceAutomationPolicy[]> {
  const database = await getControlDatabase();
  const rows = await database.prepare(
    "SELECT application_id, mode, remove_after_hours, updated_by, updated_at FROM client_device_automation",
  ).all<PolicyRow>();
  const byId = new Map(rows.results.map((row) => [row.application_id, row]));
  return policyApplications.map((applicationId) => {
    const row = byId.get(applicationId);
    return {
      applicationId,
      mode: row?.mode ?? "off",
      removeAfterHours: Number(row?.remove_after_hours) || 168,
      updatedBy: row?.updated_by ?? null,
      updatedAt: row?.updated_at ?? null,
    };
  });
}

async function savePolicy(applicationId: string, mode: ClientDeviceAutomationMode, removeAfterHours: number, actor: string) {
  if (!policyApplications.includes(applicationId as (typeof policyApplications)[number])) throw new ControlAccessError("Ứng dụng không hỗ trợ policy thiết bị tại Trung tâm.", 400, "INVALID_CLIENT_APPLICATION");
  if (!["off", "approve", "remove"].includes(mode)) throw new ControlAccessError("Chế độ tự động không hợp lệ.", 400, "INVALID_AUTOMATION_MODE");
  const hours = Math.min(8760, Math.max(1, Math.round(removeAfterHours || 168)));
  const database = await getControlDatabase();
  await database.prepare(
    `INSERT INTO client_device_automation (application_id, mode, remove_after_hours, updated_by, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(application_id) DO UPDATE SET mode=excluded.mode, remove_after_hours=excluded.remove_after_hours,
       updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP`,
  ).bind(applicationId, mode, hours, actor).run();
}

function ageHours(value: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.max(0, (Date.now() - parsed) / 3_600_000) : 0;
}

async function applyAutomation(snapshot: ClientDeviceSnapshot, actor: string, role: ControlRole, controlDeviceId: string) {
  const currentPolicies = await policies();
  const outcomes: Array<{ applicationId: string; deviceId: string; operation: ClientDeviceOperation; ok: boolean; message?: string; adminHref?: string | null }> = [];
  let changed = false;
  for (const policy of currentPolicies) {
    if (policy.mode === "off") continue;
    const operation: ClientDeviceOperation = policy.mode === "approve" ? "approve" : "remove";
    for (const device of snapshot.devices.filter((item) => item.applicationId === policy.applicationId && item.status === "pending")) {
      if (operation === "remove" && ageHours(device.createdAt) < policy.removeAfterHours) continue;
      try {
        await manageClientDevice(actor, role, controlDeviceId, device.applicationId, device.deviceId, operation);
        outcomes.push({ applicationId: device.applicationId, deviceId: device.deviceId, operation, ok: true });
        changed = true;
      } catch (error) {
        outcomes.push({
          applicationId: device.applicationId,
          deviceId: device.deviceId,
          operation,
          ok: false,
          message: error instanceof Error ? error.message : "Không thể tự động xử lý thiết bị.",
          adminHref: error instanceof ClientDeviceBrokerError ? error.adminHref : device.adminHref,
        });
      }
    }
  }
  return { snapshot: changed ? await readClientDeviceSnapshot(actor, role, controlDeviceId) : snapshot, outcomes };
}

async function responseState(actor: string, role: ControlRole, controlDeviceId: string, applyRules = true) {
  const initial = await readClientDeviceSnapshot(actor, role, controlDeviceId);
  const applied = applyRules && canManage(role) ? await applyAutomation(initial, actor, role, controlDeviceId) : { snapshot: initial, outcomes: [] };
  return { ...applied.snapshot, policies: await policies(), automationOutcomes: applied.outcomes };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actor = await verifyControlProof(payload, undefined, previewRequest);
    const action = typeof payload.action === "string" ? payload.action : "sync";

    if (action === "sync") return json(await responseState(actor.email, actor.role, actor.deviceId, true));

    if (!canManage(actor.role)) throw new ControlAccessError("Cần quyền publisher hoặc owner để xử lý thiết bị client.", 403, "PUBLISHER_REQUIRED");

    if (action === "manage") {
      const applicationId = typeof payload.applicationId === "string" ? payload.applicationId : "";
      const deviceId = typeof payload.targetDeviceId === "string" ? payload.targetDeviceId : "";
      const operation = payload.operation === "approve" || payload.operation === "remove" ? payload.operation : null;
      if (!operation || !/^[a-f0-9]{64}$/.test(deviceId)) throw new ControlAccessError("Yêu cầu xử lý thiết bị không hợp lệ.", 400, "INVALID_CLIENT_DEVICE_ACTION");
      try {
        await manageClientDevice(actor.email, actor.role, actor.deviceId, applicationId, deviceId, operation);
      } catch (error) {
        if (error instanceof ClientDeviceBrokerError) {
          return json({ error: error.message, code: "CLIENT_APP_ADMIN_REQUIRED", applicationId, adminHref: error.adminHref, ...(await responseState(actor.email, actor.role, actor.deviceId, false)) }, 409);
        }
        throw error;
      }
      return json({ notice: operation === "approve" ? "Thiết bị đã được duyệt tại registry của app." : "Thiết bị đã bị loại bỏ/khóa tại registry của app.", ...(await responseState(actor.email, actor.role, actor.deviceId, false)) });
    }

    if (action === "bulk") {
      const applicationId = typeof payload.applicationId === "string" ? payload.applicationId : "all";
      const operation = payload.operation === "approve" || payload.operation === "remove" ? payload.operation : null;
      if (!operation) throw new ControlAccessError("Thao tác hàng loạt không hợp lệ.", 400, "INVALID_BULK_ACTION");
      const before = await readClientDeviceSnapshot(actor.email, actor.role, actor.deviceId);
      const targets = before.devices.filter((device) => device.status === "pending" && (applicationId === "all" || device.applicationId === applicationId));
      const outcomes: Array<{ applicationId: string; deviceId: string; deviceCode: string; ok: boolean; message?: string; adminHref?: string | null }> = [];
      for (const device of targets) {
        try {
          await manageClientDevice(actor.email, actor.role, actor.deviceId, device.applicationId, device.deviceId, operation);
          outcomes.push({ applicationId: device.applicationId, deviceId: device.deviceId, deviceCode: device.deviceCode, ok: true });
        } catch (error) {
          outcomes.push({ applicationId: device.applicationId, deviceId: device.deviceId, deviceCode: device.deviceCode, ok: false, message: error instanceof Error ? error.message : "Không thể xử lý.", adminHref: error instanceof ClientDeviceBrokerError ? error.adminHref : device.adminHref });
        }
      }
      const state = await responseState(actor.email, actor.role, actor.deviceId, false);
      return json({
        notice: operation === "approve" ? `Đã duyệt ${outcomes.filter((item) => item.ok).length}/${targets.length} thiết bị.` : `Đã loại bỏ ${outcomes.filter((item) => item.ok).length}/${targets.length} thiết bị.`,
        bulkOutcomes: outcomes,
        ...state,
      });
    }

    if (action === "set-policy") {
      if (actor.role !== "owner") throw new ControlAccessError("Chỉ owner được thay đổi tự động duyệt/loại bỏ.", 403, "OWNER_REQUIRED");
      const applicationId = typeof payload.applicationId === "string" ? payload.applicationId : "";
      const mode = payload.mode === "approve" || payload.mode === "remove" || payload.mode === "off" ? payload.mode : null;
      if (!mode) throw new ControlAccessError("Chế độ tự động không hợp lệ.", 400, "INVALID_AUTOMATION_MODE");
      await savePolicy(applicationId, mode, Number(payload.removeAfterHours) || 168, actor.email);
      return json({ notice: "Đã lưu policy. Policy được áp dụng mỗi lần Trung tâm đồng bộ trạng thái client.", ...(await responseState(actor.email, actor.role, actor.deviceId, true)) });
    }

    throw new ControlAccessError("Thao tác quản trị thiết bị client không hợp lệ.", 400, "INVALID_CLIENT_DEVICE_ROUTE_ACTION");
  } catch (error) {
    return controlErrorResponse(error);
  }
}
