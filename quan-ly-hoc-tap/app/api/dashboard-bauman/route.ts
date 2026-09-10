import { applicationRegistry, getApplicationConfig } from "../../application-registry";
import { issueBaumanBrowserBridge } from "../../bauman-bridge.server";
import { controlErrorResponse, verifyControlProof } from "../../control-device.server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const actorDevice = await verifyControlProof(payload, undefined, previewRequest);
    const action = typeof payload.action === "string" ? payload.action : "bootstrap";
    if (action !== "bootstrap") return json({ error: "Thao tác quản trị Bauman Master AI không hợp lệ.", code: "INVALID_BAUMAN_DASHBOARD_ACTION" }, 400);

    const application = getApplicationConfig("bauman-master-ai");
    const bridge = await issueBaumanBrowserBridge(actorDevice.email, actorDevice.role, actorDevice.deviceId);
    return json({
      actor: actorDevice,
      application,
      upstreamError: null,
      applicationBridge: bridge,
      boiBridge: bridge,
      applications: applicationRegistry.map(({ id, name, status }) => ({ id, name, status })),
    });
  } catch (error) {
    return controlErrorResponse(error);
  }
}
