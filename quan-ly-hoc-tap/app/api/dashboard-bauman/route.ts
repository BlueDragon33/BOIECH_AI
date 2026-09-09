import { applicationRegistry, getApplicationConfig } from "../../application-registry";
import {
  BaumanDeviceError,
  baumanDeviceCounts,
  listBaumanAudit,
  listBaumanDevices,
  manageBaumanDevice,
} from "../../bauman-device.server";
import { controlErrorResponse, verifyControlProof } from "../../control-device.server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" },
  });
}

function canReview(role: string) {
  return ["reviewer", "publisher", "owner"].includes(role);
}

async function snapshot(actorDevice: Awaited<ReturnType<typeof verifyControlProof>>) {
  return {
    actor: actorDevice,
    application: getApplicationConfig("bauman-master-ai"),
    applications: applicationRegistry.map(({ id, name, status }) => ({ id, name, status })),
    baumanDevices: await listBaumanDevices(),
    baumanAudit: canReview(actorDevice.role) ? await listBaumanAudit() : [],
    baumanStats: await baumanDeviceCounts(),
    upstreamError: null,
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actorDevice = await verifyControlProof(payload, undefined, previewRequest);
    const action = typeof payload.action === "string" ? payload.action : "bootstrap";

    if (action === "bootstrap") return json(await snapshot(actorDevice));

    if (action === "manage-device") {
      if (!canReview(actorDevice.role)) {
        throw new BaumanDeviceError("Vai trò hiện tại không được kiểm duyệt thiết bị Bauman.", 403, "BAUMAN_REVIEWER_REQUIRED");
      }
      const operation = typeof payload.operation === "string" ? payload.operation : "";
      if (!["approve", "block", "reopen", "label"].includes(operation)) {
        throw new BaumanDeviceError("Thao tác kiểm duyệt thiết bị Bauman không hợp lệ.", 400, "INVALID_BAUMAN_ADMIN_OPERATION");
      }
      const deviceId = typeof payload.targetDeviceId === "string" ? payload.targetDeviceId : "";
      const label = typeof payload.label === "string" ? payload.label : null;
      await manageBaumanDevice(
        actorDevice.email,
        operation as "approve" | "block" | "reopen" | "label",
        deviceId,
        label,
      );
      return json(await snapshot(actorDevice));
    }

    throw new BaumanDeviceError("Thao tác quản trị Bauman không hợp lệ.", 400, "INVALID_BAUMAN_DASHBOARD_ACTION");
  } catch (error) {
    if (error instanceof BaumanDeviceError) {
      return json({ error: error.message, code: error.code, device: error.device }, error.status);
    }
    return controlErrorResponse(error);
  }
}