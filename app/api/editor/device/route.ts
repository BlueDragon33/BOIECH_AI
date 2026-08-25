import { getChatGPTUser } from "../../../chatgpt-auth";
import {
  createEditorChallenge,
  EditorAccessError,
  editorErrorResponse,
  registerEditorDevice,
} from "../../../editor-device-auth.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) throw new EditorAccessError("Cần đăng nhập ChatGPT để tiếp tục.", 401, "EDITOR_SIGN_IN_REQUIRED");
    const payload = (await request.json()) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";
    if (action === "register") return Response.json({ device: await registerEditorDevice(payload.publicKey, user) }, { headers: { "cache-control": "no-store, private" } });
    if (action === "challenge") return Response.json(await createEditorChallenge(payload.deviceId, user), { headers: { "cache-control": "no-store, private" } });
    throw new EditorAccessError("Thao tác laptop biên tập không hợp lệ.", 400, "INVALID_EDITOR_DEVICE_ACTION");
  } catch (error) {
    return editorErrorResponse(error);
  }
}
