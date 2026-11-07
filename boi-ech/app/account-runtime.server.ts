import { cookies, headers } from "next/headers";
import { AccountError, AccountService, ACCOUNT_COOKIE } from "./account-core.server";
import { DeviceAccessError, getCourseDatabase, getPublicDeviceState } from "./device-auth.server";

export async function accountConfiguration() {
  let values: Record<string, unknown>;
  try { values = (await import("cloudflare:workers")).env as unknown as Record<string, unknown>; }
  catch (error) {
    // The Node artifact-render test has no Workers binding. Missing configuration stays OFF.
    const code = error && typeof error === "object" && "code" in error ? error.code : "";
    if (code !== "ERR_UNSUPPORTED_ESM_URL_SCHEME" && code !== "ERR_MODULE_NOT_FOUND") throw error;
    values = process.env;
  }
  const enabled = values.BOI_ECH_ACCOUNT_FIRST === "true";
  const origin = typeof values.BOI_ECH_ACCOUNT_ORIGIN === "string" ? values.BOI_ECH_ACCOUNT_ORIGIN : "";
  if (enabled) {
    let valid = false;
    try { const u = new URL(origin); valid = u.origin === origin && (u.protocol === "https:" ||
      (values.LOCAL_CONTROL_PLANE === "true" && ["localhost", "127.0.0.1"].includes(u.hostname))); } catch { /* fail closed */ }
    if (!valid) throw new AccountError("ACCOUNT_ORIGIN_UNCONFIGURED", 503);
  }
  return { enabled, origin };
}
export function sameOrigin(origin: string | null, expected: string, contentType: string | null, requireJson = true) {
  if (!origin || origin !== expected || (requireJson && !contentType?.toLowerCase().startsWith("application/json"))) throw new AccountError("ACCOUNT_CSRF_REJECTED", 403);
}
export async function accountService() {
  const config = await accountConfiguration();
  if (!config.enabled) throw new AccountError("ACCOUNT_FEATURE_DISABLED", 404);
  return new AccountService(await getCourseDatabase());
}
export async function accountCookieToken() { return (await cookies()).get(ACCOUNT_COOKIE)?.value ?? ""; }
export function sessionCookie(token: string) {
  // Host-only cookie: deliberately no Domain attribute. JS never receives a session token.
  return `${ACCOUNT_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${token ? 28800 : 0}`;
}
export async function resolveAccountDevice(claimedDeviceId?: unknown) {
  const config = await accountConfiguration();
  if (!config.enabled) return null;
  const incoming = await headers();
  sameOrigin(incoming.get("origin"), config.origin, incoming.get("content-type"), false);
  const service = await accountService(), token = await accountCookieToken();
  const actor = await service.session(token);
  if (claimedDeviceId && claimedDeviceId !== actor.storageDeviceId) throw new AccountError("ACCOUNT_SWITCHED", 409);
  const state = await getPublicDeviceState(actor.storageDeviceId);
  if (!state) throw new AccountError("ACCOUNT_NOT_FOUND", 404);
  return { ...state, accountId: actor.accountId };
}
export async function accountRequest(request: Request) {
  const config = await accountConfiguration();
  if (!config.enabled) throw new AccountError("ACCOUNT_FEATURE_DISABLED", 404);
  if (request.method !== "GET") sameOrigin(request.headers.get("origin"), config.origin, request.headers.get("content-type"));
  return { service: await accountService(), token: await accountCookieToken(), config };
}
export function accountErrorResponse(error: unknown) {
  const code = error instanceof AccountError ? error.code : error instanceof DeviceAccessError ? error.code : "ACCOUNT_SERVICE_UNAVAILABLE";
  const status = error instanceof AccountError || error instanceof DeviceAccessError ? error.status : 503;
  const messages: Record<string, string> = {
    AUTH_FAILED: "Tên đăng nhập hoặc thông tin xác thực chưa đúng.",
    RATE_LIMITED: "Đã vượt số lần thử. Hãy thử lại sau 15 phút.",
    ACCOUNT_PENDING: "Tài khoản đang chờ xét duyệt.", ACCOUNT_BLOCKED: "Tài khoản đã bị khóa.",
    PASSWORD_POLICY: "Mật khẩu cần ít nhất 15 ký tự và tối đa 1.024 ký tự.",
    REGISTRATION_UNAVAILABLE: "Không thể tạo hồ sơ này. Nếu đã đăng ký, hãy đăng nhập hoặc dùng khôi phục.",
    ACCOUNT_CAPACITY_REACHED: "Loại tài khoản này đã đủ số lượng. Đăng ký mới tạm dừng để bảo vệ hệ thống; hãy liên hệ cán bộ phụ trách.",
    ACCOUNT_POLICY_UNAVAILABLE: "Chính sách giới hạn tài khoản chưa sẵn sàng. Chưa tạo hồ sơ nào.",
    DEVICE_LIMIT_REACHED: "Tài khoản đã liên kết đủ 3 thiết bị. Hãy đăng nhập trên một thiết bị đã liên kết để gỡ thiết bị không còn dùng, sau đó thử lại.",
    LEGACY_PROOF_REQUIRED: "Hãy chuyển tài khoản từ trình duyệt đã đăng ký, bằng khóa gốc của bạn.",
    ACCOUNT_PERMISSION_REQUIRED: "Tài khoản chưa được cấp quyền thực hiện thao tác này.",
    ACCOUNT_CAS_CONFLICT: "Thông tin đã thay đổi. Đồng bộ lại trước khi lưu.",
  };
  return Response.json({ code, error: messages[code] ?? "Chưa xác minh được thao tác tài khoản. Hãy đồng bộ và thử lại." }, {
    status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff", ...(status === 429 ? { "retry-after": "900" } : {}) },
  });
}
