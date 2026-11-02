import { DeviceAccessError, deviceErrorResponse, verifyDeviceRequest } from "../../../device-auth.server";
import { managerReviewBoard, managerReviewCommand } from "../../../manager-device-review.server";

export const dynamic="force-dynamic";

export async function POST(request:Request) {
  try {
    const raw=await request.text();
    if (raw.length>16_384) throw new DeviceAccessError("Yêu cầu quá lớn.",413,"MANAGER_REQUEST_TOO_LARGE");
    const payload=JSON.parse(raw) as Record<string,unknown>;
    if (!payload || Array.isArray(payload) || typeof payload!=="object")
      throw new DeviceAccessError("Dữ liệu không hợp lệ.",400,"MANAGER_REQUEST_INVALID");
    // Real one-use P-256 challenge. No session-header or user-claimed-role bypass.
    const actor=await verifyDeviceRequest(payload,false);
    const board=payload.action==="list"
      ?await managerReviewBoard(actor)
      :await managerReviewCommand(actor,payload);
    return Response.json({ok:true,board},{headers:{"cache-control":"no-store, private"}});
  } catch(error) {
    if (error instanceof SyntaxError) return deviceErrorResponse(
      new DeviceAccessError("Không đọc được yêu cầu.",400,"MANAGER_REQUEST_INVALID"));
    const msg=error instanceof Error?error.message:"";
    if (msg.includes("MANAGER_APPROVAL_QUOTA_REACHED")) return deviceErrorResponse(
      new DeviceAccessError("Đã hết hạn mức xét duyệt. Cần Chủ hệ thống điều chỉnh.",409,"MANAGER_QUOTA_REACHED"));
    if (msg.includes("MANAGER_APPROVAL_FORBIDDEN")) return deviceErrorResponse(
      new DeviceAccessError("Quyền cán bộ quản lý không còn hiệu lực.",403,"MANAGER_PERMISSION_REVOKED"));
    if (msg.includes("MANAGER_TARGET_NOT_ELIGIBLE")||msg.includes("UNIQUE constraint"))
      return deviceErrorResponse(new DeviceAccessError("Hồ sơ đã thay đổi hoặc đã được cán bộ khác nhận. Đồng bộ lại.",409,"MANAGER_REVIEW_CONFLICT"));
    return deviceErrorResponse(error);
  }
}
