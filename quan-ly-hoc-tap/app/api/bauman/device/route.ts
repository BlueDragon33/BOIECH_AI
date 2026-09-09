import {
  BaumanDeviceError,
  baumanDeviceErrorResponse,
  createBaumanChallenge,
  registerBaumanDevice,
  verifyBaumanProof,
} from "../../../bauman-device.server";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store, private",
  "x-content-type-options": "nosniff",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: corsHeaders });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "register";

    if (action === "register") {
      const metadata = payload.metadata && typeof payload.metadata === "object"
        ? payload.metadata as Record<string, unknown>
        : {};
      const device = await registerBaumanDevice(payload.publicKey, metadata);
      return json({
        application: "bauman-master-ai",
        contractVersion: 1,
        device,
        accessGranted: device.status === "approved",
        pollAfterSeconds: device.status === "pending" ? 15 : 60,
      });
    }

    if (action === "challenge") {
      const result = await createBaumanChallenge(payload.deviceId);
      return json({ application: "bauman-master-ai", contractVersion: 1, ...result });
    }

    if (action === "verify") {
      const device = await verifyBaumanProof(payload);
      return json({
        application: "bauman-master-ai",
        contractVersion: 1,
        device,
        accessGranted: true,
        heartbeatSeconds: 60,
      });
    }

    throw new BaumanDeviceError("Thao tác thiết bị Bauman không hợp lệ.", 400, "INVALID_BAUMAN_DEVICE_ACTION");
  } catch (error) {
    return baumanDeviceErrorResponse(error, true);
  }
}