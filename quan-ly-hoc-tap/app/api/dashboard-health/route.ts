import { issueHealthBrowserBridge } from "../../boi-ech.server";
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
    if (action !== "bootstrap") return json({ error: "Thao tác quản trị Sức khỏe trẻ không hợp lệ.", code: "INVALID_HEALTH_DASHBOARD_ACTION" }, 400);

    return json({
      actor: actorDevice,
      upstreamError: null,
      boiBridge: await issueHealthBrowserBridge(actorDevice.email, actorDevice.role),
      applications: [
        { id: "boi-ech", name: "Bơi ếch AI", status: "online" },
        { id: "child-health", name: "Sức khỏe trẻ 9 tháng–5 tuổi", status: "online" },
        { id: "bauman-master-ai", name: "Bauman Master AI · Frog AI", status: "online" },
      ],
    });
  } catch (error) {
    return controlErrorResponse(error);
  }
}
