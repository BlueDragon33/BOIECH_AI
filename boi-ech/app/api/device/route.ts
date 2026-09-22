import {
  createDeviceChallenge,
  deviceErrorResponse,
  getCourseDatabase,
  getPublicDeviceState,
  registerDevice,
  saveDeviceRegistration,
  verifyDeviceIdentityRequest,
} from "../../device-auth.server";
import { captureDeviceMetadata } from "../../device-metadata.server";

export const dynamic = "force-dynamic";

export const ADDITIONAL_ACCOUNT_REVIEW_TOKEN = "boi-ech-additional-account-manual-review-v1";
export const ADDITIONAL_ACCOUNT_REVIEW_LABEL = "Tài khoản bổ sung · chờ quản trị duyệt";

function pendingReviewDevice<T extends {
  status: string;
  accessGroup: string;
  paymentStatus: string;
  accessExpiresAt: string | null;
  accessExpired: boolean;
  accessExpiringSoon: boolean;
  accessDaysRemaining: number | null;
  personalEditEnabled: boolean;
  autoConfirmedAt: string | null;
}>(device: T) {
  return {
    ...device,
    status: "pending" as const,
    accessGroup: "unassigned" as const,
    paymentStatus: "unassigned" as const,
    accessExpiresAt: null,
    accessExpired: false,
    accessExpiringSoon: false,
    accessDaysRemaining: null,
    personalEditEnabled: false,
    autoConfirmedAt: null,
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";
    if (action === "register") {
      const hostname = new URL(request.url).hostname;
      const previewRequest = hostname === "terminal.local" || hostname === "localhost";
      const autoApprove = previewRequest;
      let device = await registerDevice(payload.publicKey, payload.legacyToken, autoApprove);
      const additionalAccount = payload.legacyToken === ADDITIONAL_ACCOUNT_REVIEW_TOKEN;
      if (additionalAccount && !previewRequest) {
        const database = await getCourseDatabase();
        await database.prepare(
          `UPDATE device_access
              SET label = ?, status = 'pending', access_group = 'unassigned', payment_status = 'unassigned',
                  approved_at = NULL, blocked_at = NULL, personal_edit_enabled = 0,
                  auto_confirmed_at = NULL, access_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE device_id = ?`,
        ).bind(ADDITIONAL_ACCOUNT_REVIEW_LABEL, device.deviceId).run();
        device = { ...pendingReviewDevice(device), label: ADDITIONAL_ACCOUNT_REVIEW_LABEL };
      }
      await captureDeviceMetadata(request, device.deviceId).catch(() => undefined);
      device = (await getPublicDeviceState(device.deviceId).catch(() => null)) ?? device;
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
      let device = await saveDeviceRegistration(payload, previewRequest);
      if (!previewRequest && device.label === ADDITIONAL_ACCOUNT_REVIEW_LABEL) {
        const database = await getCourseDatabase();
        await database.prepare(
          `UPDATE device_access
              SET status = 'pending', access_group = 'unassigned', payment_status = 'unassigned',
                  approved_at = NULL, blocked_at = NULL, personal_edit_enabled = 0,
                  auto_confirmed_at = NULL, access_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE device_id = ?`,
        ).bind(device.deviceId).run();
        device = pendingReviewDevice(device);
      }
      return Response.json({ device }, { headers: { "cache-control": "no-store, private" } });
    }
    if (action === "presence") {
      const hostname = new URL(request.url).hostname;
      const previewRequest = hostname === "terminal.local" || hostname === "localhost";
      let device = await verifyDeviceIdentityRequest(payload, previewRequest);
      await captureDeviceMetadata(request, device.deviceId).catch(() => undefined);
      device = (await getPublicDeviceState(device.deviceId).catch(() => null)) ?? device;
      return Response.json({ device }, { headers: { "cache-control": "no-store, private" } });
    }
    return Response.json({ error: "Thao tác không được hỗ trợ." }, { status: 400 });
  } catch (error) {
    return deviceErrorResponse(error);
  }
}
