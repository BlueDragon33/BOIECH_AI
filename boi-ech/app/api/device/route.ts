import {
  createDeviceChallenge,
  deviceErrorResponse,
  registerDevice,
  saveDeviceRegistration,
  verifyDeviceIdentityRequest,
} from "../../device-auth.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";
    if (action === "register") {
      const hostname = new URL(request.url).hostname;
      const autoApprove = hostname === "terminal.local" || hostname === "localhost";
      const device = await registerDevice(payload.publicKey, payload.legacyToken, autoApprove);
      return Response.json({ device }, { headers: { "cache-control": "no-store, private" } });
    }
    if (action === "challenge") {
      return Response.json(
        await createDeviceChallenge(payload.deviceId),
        { headers: { "cache-control": "no-store, private" } },
      );
    }
    if (action === "save-registration") {
      const hostname = new URL(request.url).hostname;
      const previewRequest = hostname === "terminal.local" || hostname === "localhost";
      const device = await saveDeviceRegistration(payload, previewRequest);
      return Response.json({ device }, { headers: { "cache-control": "no-store, private" } });
    }
    if (action === "presence") {
      const hostname = new URL(request.url).hostname;
      const previewRequest = hostname === "terminal.local" || hostname === "localhost";
      const device = await verifyDeviceIdentityRequest(payload, previewRequest);
      return Response.json({ device }, { headers: { "cache-control": "no-store, private" } });
    }
    return Response.json({ error: "Thao tác không được hỗ trợ." }, { status: 400 });
  } catch (error) {
    return deviceErrorResponse(error);
  }
}
