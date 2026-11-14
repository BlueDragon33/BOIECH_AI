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
    const ownerView = new URL(request.url).searchParams.get("view") === "owner";
    // The existing v2 contract remains minimal for generic consumers. The
    // explicit Owner-only view joins an account identity + browser-session
    // class. A P-256 browser key must NEVER be advertised as a physical phone.
    const result = await db.prepare(ownerView
      ? `SELECT b.account_id,b.device_id,b.approved,b.revoked,b.device_label,b.client_class,
           d.learner_name,d.person_role
         FROM account_devices b JOIN accounts a ON a.account_id=b.account_id
         JOIN device_access d ON d.device_id=a.storage_device_id
         ORDER BY b.account_id,b.device_id`
      : "SELECT account_id, device_id, approved, revoked FROM account_devices ORDER BY account_id, device_id",
    ).all<{ account_id: string; device_id: string; approved: number; revoked: number;
      device_label?: string | null; client_class?: string | null;
      learner_name?: string | null; person_role?: string | null }>();
    if (!result.success || !Array.isArray(result.results)) {
      throw new DeviceAccessError("Chưa xác minh được danh sách thiết bị.", 503, "BOI_DEVICE_REGISTRY_UNAVAILABLE");
    }
    const devices = result.results.map(row => {
      // A browser key may be linked to several accounts with independent trust states.
      // Expose only a stable identifier for the binding, without its account or key ID.
      const deviceId = createHash("sha256").update(JSON.stringify([row.account_id, row.device_id])).digest("hex");
      const status = row.revoked === 1 ? "blocked" : row.approved === 1 ? "approved" : "pending";
      if (!ownerView) return { deviceId, status };
      const role = row.person_role === "manager" || row.person_role === "teacher" || row.person_role === "learner"
        ? row.person_role : null;
      const clientClass = row.client_class === "phone" || row.client_class === "tablet" ? row.client_class : "desktop";
      return { deviceId, status, account: {
          accountId: row.account_id, name: row.learner_name?.trim() || null, role,
        },
        browserLabel: row.device_label?.trim() || null, clientClass,
      };
    });
    return controlResponse({
      ok: true,
      application: "boi-ech",
      contract: ownerView ? "boi-device-registry-owner.v1" : "boi-device-registry.v2",
      readOnly: true,
      devices,
      counts: { total: devices.length },
    }, 200, request);
  } catch (error) {
    return withControlCors(request, accountErrorResponse(error));
  }
}
