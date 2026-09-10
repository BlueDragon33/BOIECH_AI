import { getControlDatabase, type ControlRole } from "./control-device.server";
import { manageClientDevice, readClientDeviceSnapshot, type ClientDeviceOperation } from "./client-device-broker.server";

const AUTOMATION_ACTOR = "client-device-automation";
const AUTOMATION_ROLE: ControlRole = "owner";

type PolicyRow = {
  application_id: string;
  mode: "off" | "approve" | "remove";
  remove_after_hours: number;
};

function ageHours(value: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.max(0, (Date.now() - parsed) / 3_600_000) : 0;
}

async function audit(action: string, target: string, detail: Record<string, unknown>) {
  const database = await getControlDatabase();
  await database.prepare(
    "INSERT INTO control_audit_log (actor, action, target, detail_json) VALUES (?, ?, ?, ?)",
  ).bind(AUTOMATION_ACTOR, action, target, JSON.stringify(detail)).run();
}

export async function runClientDeviceAutomation() {
  const database = await getControlDatabase();
  const policies = await database.prepare(
    "SELECT application_id, mode, remove_after_hours FROM client_device_automation WHERE mode <> 'off'",
  ).all<PolicyRow>();

  if (!policies.results.length) {
    return { checked: 0, applied: 0, failed: 0, skipped: 0 };
  }

  const snapshot = await readClientDeviceSnapshot(AUTOMATION_ACTOR, AUTOMATION_ROLE, "");
  const outcomes: Array<{
    applicationId: string;
    deviceId: string;
    deviceCode: string;
    operation: ClientDeviceOperation;
    ok: boolean;
    skipped?: boolean;
    message?: string;
  }> = [];

  for (const policy of policies.results) {
    const operation: ClientDeviceOperation = policy.mode === "approve" ? "approve" : "remove";
    const targets = snapshot.devices.filter((device) => device.applicationId === policy.application_id && device.status === "pending");
    for (const device of targets) {
      if (operation === "remove" && ageHours(device.createdAt) < Math.max(1, policy.remove_after_hours || 168)) {
        outcomes.push({ applicationId: device.applicationId, deviceId: device.deviceId, deviceCode: device.deviceCode, operation, ok: false, skipped: true, message: "Chưa đủ thời gian chờ tự động loại bỏ." });
        continue;
      }
      try {
        await manageClientDevice(AUTOMATION_ACTOR, AUTOMATION_ROLE, "", device.applicationId, device.deviceId, operation);
        outcomes.push({ applicationId: device.applicationId, deviceId: device.deviceId, deviceCode: device.deviceCode, operation, ok: true });
        await audit(operation === "approve" ? "client_device_auto_approved" : "client_device_auto_removed", device.deviceId, {
          applicationId: device.applicationId,
          deviceCode: device.deviceCode,
          operation,
          policy: policy.mode,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Không thể xử lý tự động.";
        outcomes.push({ applicationId: device.applicationId, deviceId: device.deviceId, deviceCode: device.deviceCode, operation, ok: false, message });
        await audit("client_device_automation_failed", device.deviceId, {
          applicationId: device.applicationId,
          deviceCode: device.deviceCode,
          operation,
          message,
        });
      }
    }
  }

  return {
    checked: outcomes.length,
    applied: outcomes.filter((item) => item.ok).length,
    failed: outcomes.filter((item) => !item.ok && !item.skipped).length,
    skipped: outcomes.filter((item) => item.skipped).length,
    outcomes,
  };
}
