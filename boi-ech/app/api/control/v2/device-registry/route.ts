import { createHash } from "node:crypto";
import { accountConfiguration, accountErrorResponse } from "../../../../account-runtime.server";
import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../../control-auth.server";
import { DeviceAccessError, getCourseDatabase } from "../../../../device-auth.server";

export const dynamic = "force-dynamic";
export function OPTIONS(request: Request) { return controlPreflight(request); }

export async function GET(request: Request) {
  try {
    if (!/^Bearer v1\.\S+$/.test(request.headers.get("authorization") ?? "")) {
      throw new DeviceAccessError("Cần vé Owner hợp lệ.", 401, "CONTROL_AUTH_REQUIRED");
    }
    const caller = await requireControlService(request);
    if (caller.role !== "owner") {
      throw new DeviceAccessError("Chỉ Owner được xem liên kết thiết bị.", 403, "OWNER_REQUIRED");
    }
    if (!(await accountConfiguration()).v2) {
      throw new DeviceAccessError("Account-first V2 chưa sẵn sàng.", 409, "ACCOUNT_V2_REQUIRED");
    }

    const db = await getCourseDatabase();
    const result = await db.prepare(
      "SELECT account_id, device_id, approved, revoked FROM account_devices ORDER BY account_id, device_id",
    ).all<{ account_id: string; device_id: string; approved: number; revoked: number }>();
    if (!result.success || !Array.isArray(result.results)) {
      throw new DeviceAccessError("Chưa xác minh được danh sách thiết bị.", 503, "BOI_DEVICE_REGISTRY_UNAVAILABLE");
    }
    const devices = result.results.map(row => {
      // A browser key may be linked to several accounts with independent trust states.
      // Expose only a stable identifier for the binding, without its account or key ID.
      const deviceId = createHash("sha256").update(JSON.stringify([row.account_id, row.device_id])).digest("hex");
      const status = row.revoked === 1 ? "blocked" : row.approved === 1 ? "approved" : "pending";
      return { deviceId, status };
    });
    return controlResponse({
      ok: true,
      application: "boi-ech",
      contract: "boi-device-registry.v2",
      readOnly: true,
      devices,
      counts: { total: devices.length },
    }, 200, request);
  } catch (error) {
    return withControlCors(request, accountErrorResponse(error));
  }
}
