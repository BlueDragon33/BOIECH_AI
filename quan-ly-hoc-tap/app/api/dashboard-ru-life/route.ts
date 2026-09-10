import { issueRuLifeBrowserBridge } from "../../ru-life-bridge.server";
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
    if (action !== "bootstrap") return json({ error: "Thao tác quản trị Hòa nhập Nga không hợp lệ.", code: "INVALID_RU_LIFE_DASHBOARD_ACTION" }, 400);

    const bridge = await issueRuLifeBrowserBridge(actorDevice.email, actorDevice.role, actorDevice.deviceId);
    return json({
      actor: actorDevice,
      application: {
        id: "ru-life",
        name: "Hòa nhập Nga",
        shortName: "Hòa nhập Nga",
        status: "online",
      },
      applicationBridge: bridge,
      boiBridge: bridge,
      applications: [],
      upstreamError: null,
    });
  } catch (error) {
    return controlErrorResponse(error);
  }
}
