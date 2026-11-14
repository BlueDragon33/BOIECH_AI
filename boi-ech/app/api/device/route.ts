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

/** A fresh device_access read intentionally lacks account_id, but the
 * authorized session lookup above already proved ownership and V2 lease.
 * Keep that server-only identity when refreshing D1 metadata after a
 * successful authenticated register/presence call. Never trust request fields. */
function preserveAccountDeviceReadback(
  verified: Awaited<ReturnType<typeof registerDevice>>,
  fresh: Awaited<ReturnType<typeof getPublicDeviceState>>,
) {
  if (!fresh) return verified;
  if (fresh.deviceId !== verified.deviceId) throw new Error("DEVICE_READBACK_IDENTITY_MISMATCH");
  if (!verified.accountId) return fresh; // unchanged anonymous/legacy contract
  // Fresh D1 status, role and registration details are authoritative, including
  // BLOCKED/INCOMPLETE; only the account ID and previously verified V2 lease
  // are preserved from the cookie-authorized Account-first session.
  return {
    ...fresh,
    accountId: verified.accountId,
    accessExpiresAt: verified.accessExpiresAt,
    accessExpired: verified.accessExpired,
    accessExpiringSoon: verified.accessExpiringSoon,
    accessDaysRemaining: verified.accessDaysRemaining,
  };
}

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
      device = preserveAccountDeviceReadback(device, await getPublicDeviceState(device.deviceId).catch(() => null));
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
      device = preserveAccountDeviceReadback(device, await getPublicDeviceState(device.deviceId).catch(() => null));
      return Response.json({ device }, { headers: { "cache-control": "no-store, private" } });
    }
    return Response.json({ error: "Thao tác không được hỗ trợ." }, { status: 400 });
  } catch (error) {
    return deviceErrorResponse(error);
  }
}
