import { cookies, headers } from "next/headers";
import { AccountError, AccountService, ACCOUNT_COOKIE } from "./account-core.server";
import { AccountEntitlementError } from "./account-entitlement.server";
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
  const v2 = enabled && values.BOI_ECH_ACCOUNT_V2 === "true";
  const singleReview = v2 && values.BOI_ECH_SINGLE_REVIEW === "true";
  const uiTrial = singleReview && values.BOI_ECH_UI_TRIAL === "true";
  const origin = typeof values.BOI_ECH_ACCOUNT_ORIGIN === "string" ? values.BOI_ECH_ACCOUNT_ORIGIN : "";
  if (enabled) {
    let valid = false;
    try { const u = new URL(origin); valid = u.origin === origin && (u.protocol === "https:" ||
      (values.LOCAL_CONTROL_PLANE === "true" && ["localhost", "127.0.0.1"].includes(u.hostname))); } catch { /* fail closed */ }
    if (!valid) throw new AccountError("ACCOUNT_ORIGIN_UNCONFIGURED", 503);
  }
  return { enabled, origin, v2, singleReview, uiTrial };
}
export function sameOrigin(origin: string | null, expected: string, contentType: string | null, requireJson = true) {
  if (!origin || origin !== expected || (requireJson && !contentType?.toLowerCase().startsWith("application/json"))) throw new AccountError("ACCOUNT_CSRF_REJECTED", 403);
}
export async function accountService() {
  const config = await accountConfiguration();
  if (!config.enabled) throw new AccountError("ACCOUNT_FEATURE_DISABLED", 404);
  return new AccountService(await getCourseDatabase(), Date.now, config.v2, config.singleReview);
}
export async function accountCookieToken() { return (await cookies()).get(ACCOUNT_COOKIE)?.value ?? ""; }
export function sessionCookie(token: string) {
  // Host-only cookie: deliberately no Domain attribute. JS never receives a session token.
  return `${ACCOUNT_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${token ? 604800 : 0}`;
}
export async function resolveAccountDevice(claimedDeviceId?: unknown) {
  const config = await accountConfiguration();
  if (!config.enabled) return null;
  const incoming = await headers();
  sameOrigin(incoming.get("origin"), config.origin, incoming.get("content-type"), false);
  const service = await accountService(), token = await accountCookieToken();
  const actor = config.v2 ? await service.authorize(token) : await service.session(token);
  if (claimedDeviceId && claimedDeviceId !== actor.storageDeviceId) throw new AccountError("ACCOUNT_SWITCHED", 409);
  const state = await getPublicDeviceState(actor.storageDeviceId);
  if (!state) throw new AccountError("ACCOUNT_NOT_FOUND", 404);
  // V2 entitlement and trusted-session authorization above replace the retired
  // device_access.access_expires_at lease. Do not send a stale legacy expiry
  // to the learner shell, which would otherwise reopen DeviceGate after GO.
  return { ...state,...(config.v2?{
    accessExpired:false,accessExpiringSoon:false,accessDaysRemaining:null,accessExpiresAt:null,
  }:{}), accountId: actor.accountId };
}
export async function accountRequest(request: Request) {
  const config = await accountConfiguration();
  if (!config.enabled) throw new AccountError("ACCOUNT_FEATURE_DISABLED", 404);
  if (request.method !== "GET") sameOrigin(request.headers.get("origin"), config.origin, request.headers.get("content-type"));
  return { service: await accountService(), token: await accountCookieToken(), config };
}
export function accountErrorResponse(error: unknown) {
  const code = error instanceof AccountError || error instanceof AccountEntitlementError ? error.code : error instanceof DeviceAccessError ? error.code : "ACCOUNT_SERVICE_UNAVAILABLE";
  const status = error instanceof AccountError || error instanceof AccountEntitlementError || error instanceof DeviceAccessError ? error.status : 503;
  const messages: Record<string, string> = {
    AUTH_FAILED: "Tên đăng nhập hoặc thông tin xác thực chưa đúng.",
    RATE_LIMITED: "Đã vượt số lần thử. Hãy thử lại sau 15 phút.",
    ACCOUNT_PENDING: "Tài khoản đang chờ xét duyệt.", ACCOUNT_BLOCKED: "Tài khoản đã bị khóa.",
    MANAGER_OWNER_INTAKE_REQUIRED: "Yêu cầu tài khoản Cán bộ quản lý phải thực hiện qua Application-Management và được Owner xét duyệt.",
    MANAGER_INVITATION_INVALID: "Mã mời Cán bộ quản lý không hợp lệ, hết hạn hoặc đã sử dụng. Hãy xin Owner cấp thư mời mới.",
    MANAGER_INVITATION_CONFLICT: "Chính sách hoặc số lượng thư mời đã thay đổi. Owner cần đồng bộ lại rồi tạo mã mới.",
    ACCOUNT_V2_REQUIRED: "Tính năng tài khoản V2 chưa được xác minh trên hệ thống đang dùng.",
    PASSWORD_POLICY: "Mật khẩu cần ít nhất 15 ký tự và tối đa 1.024 ký tự.",
    SECURITY_ANSWER_INVALID: "Hãy nhập câu trả lời Tên lúc nhỏ của bạn (từ 2 đến 120 ký tự).",
    REGISTRATION_UNAVAILABLE: "Không thể tạo hồ sơ này. Nếu đã đăng ký, hãy đăng nhập hoặc dùng khôi phục.",
    ACCOUNT_CAPACITY_REACHED: "Loại tài khoản này đã đủ số lượng. Đăng ký mới tạm dừng để bảo vệ hệ thống; hãy liên hệ cán bộ phụ trách.",
    ACCOUNT_POLICY_UNAVAILABLE: "Chính sách giới hạn tài khoản chưa sẵn sàng. Chưa tạo hồ sơ nào.",
    DEVICE_LIMIT_REACHED: "Đã đủ 3 thiết bị. Hãy dùng máy đã xác nhận để gỡ máy cũ hoặc mã khôi phục an toàn.",
    LEGACY_CLEANUP_INPUT: "Yêu cầu dọn tài khoản cũ không hợp lệ.",
    LEGACY_CLEANUP_CONFIRMATION_REQUIRED: "Chỉ Quản trị Bơi Ếch có xác thực mới được dọn tài khoản cũ, với ảnh chụp trạng thái và xác nhận đầy đủ.",
    LEGACY_CLEANUP_READ_UNAVAILABLE: "Không đọc được danh sách tài khoản cũ an toàn từ D1.",
    LEGACY_CLEANUP_PAGING_REQUIRED: "Danh sách cũ vượt 500 bản ghi; cần phân trang trước khi cho phép xóa.",
    LEGACY_CLEANUP_STATE_CHANGED: "Danh sách hoặc điều kiện bảo vệ vừa thay đổi. Chưa xóa lô này; tải lại trước khi tiếp tục.",
    LEGACY_CLEANUP_READBACK_FAILED: "Không xác minh được kết quả xóa trên D1. Phải đối chiếu trước khi thực hiện tiếp.",
    CLEANUP_INPUT: "Bộ lọc xóa tài khoản không hợp lệ.",
    CLEANUP_CONFIRMATION_REQUIRED: "Chỉ Owner mới được xóa sau khi xác nhận chính xác và ghi lý do.",
    CLEANUP_NOT_FOUND: "Tài khoản không tồn tại hoặc đã được xóa.",
    CLEANUP_ELIGIBILITY_CHANGED: "Tài khoản vừa thay đổi hoặc có dữ liệu quan trọng. Làm mới danh sách; chưa xóa.",
    CLEANUP_READ_UNAVAILABLE: "Không thể đọc danh sách tài khoản an toàn từ D1.",
    CLEANUP_READBACK_FAILED: "Không xác minh được kết quả xóa; phải đối chiếu D1 trước khi làm tiếp.",
    DEVICE_BINDING_INPUT: "Yêu cầu thiết bị không hợp lệ. Xác nhận đúng mã liên kết, trạng thái, thời điểm và lý do ít nhất 10 ký tự.",
    DEVICE_BINDING_NOT_FOUND: "Liên kết thiết bị không còn tồn tại. Hãy làm mới danh sách.",
    DEVICE_BINDING_CAS_CONFLICT: "Liên kết đã thay đổi trạng thái. Hãy mở lại thẻ và đối chiếu trước khi thao tác.",
    DEVICE_BINDING_REVOKE_FIRST: "Phải thu hồi quyền liên kết thiết bị trước khi xóa vĩnh viễn.",
    DEVICE_BINDING_READ_UNAVAILABLE: "Chưa xác minh được danh sách liên kết thiết bị từ D1.",
    DEVICE_BINDING_READBACK_FAILED: "Lệnh đã chạy nhưng chưa xác minh được kết quả; kiểm tra lại trước khi tiếp tục.",
    DEVICE_APPROVAL_REQUIRED: "Thiết bị mới đang chờ xác nhận từ một thiết bị tin cậy.",
    TRIAL_FEATURE_DISABLED: "Chế độ thử chưa được bật trên môi trường này.",
    TRIAL_NOT_ELIGIBLE: "Tài khoản không còn thuộc trạng thái đủ điều kiện trải nghiệm thử.",
    TRIAL_EXPIRED: "Lượt trải nghiệm 8 giờ đã hết hạn, không thể gia hạn.",
    TRIAL_ROLE_CONFLICT: "Vai trò thử không khớp với hồ sơ đăng ký.",
    TRIAL_CLOCK_UNAVAILABLE: "Không xác nhận được đồng hồ máy chủ; đã khóa chế độ thử.",
    DEVICE_APPROVAL_CONFLICT: "Thiết bị đã thay đổi trạng thái; tải lại trước khi duyệt.",
    ACCOUNT_ONBOARDING_REQUIRED: "Tài khoản chưa được duyệt hoặc chưa hoàn tất hồ sơ bắt buộc.",
    ACCOUNT_ONBOARDING_MISSING: "Trạng thái xét duyệt chưa được xác minh; hãy liên hệ quản trị.",
    ACCOUNT_REVIEW_SUPERSEDED: "Đã sử dụng quy trình duyệt một lần; không tồn tại duyệt vòng hai.",
    PROFILE_INVALID: "Thông tin hồ sơ chưa hợp lệ. Kiểm tra họ tên, đơn vị hoặc lớp và liên hệ bổ sung.",
    ACCOUNT_CONTACT_INVALID: "Chọn Email hoặc SĐT hợp lệ để đăng ký. Không yêu cầu xác minh khi đăng ký.",
    CONTACT_CHECK_NOT_REQUIRED: "Thiết bị hiện tại đã tin cậy, không cần đối chiếu liên hệ.",
    PROFILE_CONFLICT: "Không xác minh được trạng thái lưu hồ sơ. Hãy đồng bộ lại; chưa có căn cứ kết luận thông tin bị trùng.",
    PROFILE_PHONE_IN_USE: "Số điện thoại này đã được lưu trong hồ sơ khác. Kiểm tra số điện thoại hoặc nhờ Quản trị đối chiếu hồ sơ cũ; không cần tạo tài khoản khác.",
    PROFILE_INTERNAL_ID_CONFLICT: "Mã định danh nội bộ bị xung đột, không phải lỗi họ tên. Hãy liên hệ Quản trị Bơi Ếch.",
    PROFILE_STATE_CONFLICT: "Máy chủ từ chối thay đổi trạng thái hồ sơ. Không có bằng chứng số điện thoại bị trùng. Hãy đồng bộ trạng thái rồi kiểm tra lại.",
    ACCOUNT_SCOPE_FORBIDDEN: "Không có quyền xử lý hồ sơ ngoài phạm vi được giao.",
    ACCOUNT_SWITCHED: "Phiên tài khoản đã đổi. Hãy tải lại và kiểm tra dữ liệu trước khi đồng bộ.",
    SYNC_CONSENT_REQUIRED: "Thiết bị chưa được bạn xác nhận quyền đồng bộ cho loại dữ liệu này.",
    SYNC_CONFLICT: "Dữ liệu trên máy chủ đã có phiên bản khác. Bản trên thiết bị vẫn được giữ lại để xử lý.",
    SYNC_EVENT_REUSE: "Mã sự kiện đã được dùng cho nội dung khác. Không ghi đè dữ liệu.",
    SYNC_DATA_INVALID: "Nội dung đồng bộ không thuộc danh mục được phép.",
    SYNC_DATA_TOO_LARGE: "Bản cập nhật quá lớn. Chỉ đồng bộ dữ liệu học tập nhỏ, không gửi video.",
    SYNC_SCOPE_INVALID: "Loại dữ liệu này không hỗ trợ đồng bộ.",
    DEVICE_RECOVERY_CONFLICT: "Thiết bị hoặc mã khôi phục đã thay đổi. Hãy xác minh lại.",

    LEGACY_PROOF_REQUIRED: "Hãy chuyển tài khoản từ trình duyệt đã đăng ký, bằng khóa gốc của bạn.",
    ACCOUNT_PERMISSION_REQUIRED: "Tài khoản chưa được cấp quyền thực hiện thao tác này.",
    ACCOUNT_CAS_CONFLICT: "Thông tin đã thay đổi. Đồng bộ lại trước khi lưu.",
    ACCOUNT_ENTITLEMENT_REQUIRED: "Tài khoản chưa được cấp thời hạn sử dụng hợp lệ.",
    ACCOUNT_SUSPENDED: "Tài khoản đã bị tạm khóa quyền sử dụng.",
    ACCOUNT_EXPIRED: "Tài khoản đã hết thời hạn sử dụng. Hãy yêu cầu gia hạn.",
    ACCOUNT_REASON_REQUIRED: "Nhập lý do thay đổi thời hạn từ 5 đến 300 ký tự.",
    ACCOUNT_ACCESS_POLICY_UNAVAILABLE: "Chính sách thời hạn tài khoản chưa sẵn sàng.",
    ACCOUNT_READBACK_FAILED: "Hệ thống chưa xác minh được thay đổi. Hãy tải lại trước khi thử tiếp.",
  };
  return Response.json({ code, error: messages[code] ?? "Chưa xác minh được thao tác tài khoản. Hãy đồng bộ và thử lại." }, {
    status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff", ...(status === 429 ? { "retry-after": "900" } : {}) },
  });
}
