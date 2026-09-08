import {
  createSiteDeviceChallenge,
  deviceErrorResponse,
  getSiteAccessPolicy,
  registerSiteDevice,
  touchSiteAccessSession,
  verifySiteDeviceProof,
} from "../../device-auth.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";
    const hostname = new URL(request.url).hostname;
    const previewRequest = hostname === "terminal.local" || hostname === "localhost";
    if (action === "register") {
      const [device, policy] = await Promise.all([
        registerSiteDevice(payload.publicKey, payload.metadata, previewRequest),
        getSiteAccessPolicy(),
      ]);
      return Response.json({ device, policy }, { headers: { "cache-control": "no-store, private" } });
    }
    if (action === "challenge") {
      return Response.json(await createSiteDeviceChallenge(payload.deviceId), { headers: { "cache-control": "no-store, private" } });
    }
    if (action === "presence") {
      const device = await verifySiteDeviceProof(payload, previewRequest);
      const [session, policy] = await Promise.all([
        touchSiteAccessSession(device.deviceId, payload.sessionId),
        getSiteAccessPolicy(),
      ]);
      return Response.json({ device, session, policy }, { headers: { "cache-control": "no-store, private" } });
    }
    return Response.json({ error: "Thao tác thiết bị không được hỗ trợ." }, { status: 400 });
  } catch (error) {
    return deviceErrorResponse(error);
  }
}
