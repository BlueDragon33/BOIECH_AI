import { getChatGPTUser } from "../../chatgpt-auth";
import {
  ControlAccessError,
  controlErrorResponse,
  createControlChallenge,
  registerControlDevice,
} from "../../control-device.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) throw new ControlAccessError("Cần đăng nhập để đăng ký thiết bị.", 401, "SIGN_IN_REQUIRED");
    const payload = (await request.json()) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";
    if (action === "register") return Response.json({ device: await registerControlDevice(payload.publicKey, user) }, { headers: { "cache-control": "no-store, private" } });
    if (action === "challenge") return Response.json(await createControlChallenge(payload.deviceId, user), { headers: { "cache-control": "no-store, private" } });
    throw new ControlAccessError("Thao tác thiết bị không hợp lệ.", 400, "INVALID_DEVICE_ACTION");
  } catch (error) {
    return controlErrorResponse(error);
  }
}

