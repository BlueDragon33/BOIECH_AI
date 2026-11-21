import { getEditorUser } from "../../../editor-device-auth.server";

export const dynamic = "force-dynamic";

// The initial editor navigation must not depend on a server-rendered D1 read.
// This endpoint answers signed session/role readiness without changing data.
const privateHeaders = {
  "cache-control": "no-store, private",
  "x-content-type-options": "nosniff",
  vary: "Cookie",
};

export async function GET() {
  try {
    // Always enforce the existing Account-first authorization and editor role
    // boundary. No account IDs, secret tokens or device key material in output.
    const user = await getEditorUser();
    if (!user) {
      return Response.json(
        { code: "EDITOR_SESSION_REQUIRED", error: "Phiên Giảng viên chưa được xác nhận hoặc không có quyền biên tập." },
        { status: 401, headers: privateHeaders },
      );
    }
    return Response.json({
      user: { displayName: user.displayName, email: user.email },
    }, { status: 200, headers: privateHeaders });
  } catch {
    // Unexpected D1/service failures are distinguishable from invalid login,
    // but never expose backend errors or make the editor available.
    return Response.json({
      code: "EDITOR_SESSION_UNAVAILABLE",
      error: "Chưa kiểm tra được phiên Giảng viên. Dữ liệu và khóa thiết bị không bị thay đổi.",
    }, { status: 503, headers: privateHeaders });
  }
}
