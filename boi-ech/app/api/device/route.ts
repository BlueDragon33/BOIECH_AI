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

function standaloneDevelopmentMode(request: Request) {
  const hostname = new URL(request.url).hostname;
  const local = ["terminal.local", "localhost", "127.0.0.1", "[::1]"].includes(hostname);
  // An omitted or stale build variable must never grant production authority.
  return local && String(process.env.BOI_ECH_ACCESS_MODE || "standalone").trim().toLowerCase() === "standalone";
}

async function ensureStandaloneDevice(deviceId: string) {
  const database = await getCourseDatabase();
  const now = new Date().toISOString();
  await database.prepare(
    `UPDATE device_access
        SET status = 'approved',
            access_group = 'free',
            payment_status = 'free_approved',
            learner_family_name = COALESCE(NULLIF(learner_family_name, ''), 'Local'),
            learner_given_name = COALESCE(NULLIF(learner_given_name, ''), 'Người học'),
            person_role = COALESCE(NULLIF(person_role, ''), 'learner'),
            person_code = COALESCE(NULLIF(person_code, ''), ?),
            class_name = COALESCE(NULLIF(class_name, ''), 'Standalone'),
            phone = COALESCE(NULLIF(phone, ''), ?),
            registration_submitted_at = COALESCE(registration_submitted_at, ?),
            approved_at = COALESCE(approved_at, ?),
            blocked_at = NULL,
            access_expires_at = NULL,
            auto_confirmed_at = COALESCE(auto_confirmed_at, ?),
            updated_at = CURRENT_TIMESTAMP
      WHERE device_id = ?`,
  ).bind(`DEV-LOCAL-${deviceId}`, `local:${deviceId}`, now, now, now, deviceId).run();
  return (await getPublicDeviceState(deviceId))!;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";
    if (action === "register") {
      const standalone = standaloneDevelopmentMode(request);
      const autoApprove = standalone;
      const additionalAccount = payload.legacyToken === ADDITIONAL_ACCOUNT_REVIEW_TOKEN;
      // The review marker initializes new identities only. Public registration
      // must never reset an existing owner's approval, block, payment, or expiry.
      let device = await registerDevice(
        payload.publicKey,
        additionalAccount ? undefined : payload.legacyToken,
        autoApprove,
        additionalAccount && !standalone ? ADDITIONAL_ACCOUNT_REVIEW_LABEL : null,
      );
      if (standalone) device = await ensureStandaloneDevice(device.deviceId);
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
      const standalone = standaloneDevelopmentMode(request);
      let device = await saveDeviceRegistration(payload, standalone, ADDITIONAL_ACCOUNT_REVIEW_LABEL);
      if (standalone) device = await ensureStandaloneDevice(device.deviceId);
      return Response.json({ device }, { headers: { "cache-control": "no-store, private" } });
    }
    if (action === "presence") {
      const standalone = standaloneDevelopmentMode(request);
      let device = await verifyDeviceIdentityRequest(payload, standalone);
      if (standalone) device = await ensureStandaloneDevice(device.deviceId);
      await captureDeviceMetadata(request, device.deviceId).catch(() => undefined);
      device = (await getPublicDeviceState(device.deviceId).catch(() => null)) ?? device;
      return Response.json({ device }, { headers: { "cache-control": "no-store, private" } });
    }
    return Response.json({ error: "Thao tác không được hỗ trợ." }, { status: 400 });
  } catch (error) {
    return deviceErrorResponse(error);
  }
}
