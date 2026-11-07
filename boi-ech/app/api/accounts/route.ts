import { AccountError } from "../../account-core.server";
import { accountRequest, accountErrorResponse, sessionCookie } from "../../account-runtime.server";
import { createDeviceChallenge, verifyDeviceIdentityRequest, getCourseDatabase } from "../../device-auth.server";
import { AccountV2Workflow } from "../../account-v2-workflow.server";
export const dynamic = "force-dynamic";
const json = (data: unknown, cookie?: string) => Response.json(data, { headers: { "cache-control": "no-store, private",
  "x-content-type-options": "nosniff", ...(cookie ? { "set-cookie": cookie } : {}) } });
export async function GET(request: Request) {
  try { const { service, token, config } = await accountRequest(request);
    if (!token) return json({ enabled: true, account: null, accountV2: config.v2 });
    const account = await service.session(token);
    const onboarding = config.v2 ? await new AccountV2Workflow(await getCourseDatabase(),service).ownStatus(token) : null;
    let canReadRegistrants=false;
    if(account.role==="manager"&&account.status==="approved"&&(!config.v2||(onboarding?.stage==="active"&&account.deviceApproved))) {
      try { await service.capability(account,"registrants.read.all"); canReadRegistrants=true; }
      catch(error) { if(!(error instanceof AccountError)||error.code!=="ACCOUNT_PERMISSION_REQUIRED") throw error; }
    }
    // Only public account fields leave the server, never the principal/session hash.
    return json({ enabled: true, accountV2: config.v2, account: { accountId: account.accountId, status: account.status, role: account.role,
      name: account.name, storageDeviceId: account.storageDeviceId, expiresAt: account.expiresAt,
      deviceId: account.deviceId, deviceApproved: account.deviceApproved,
      onboardingStage: onboarding?.stage ?? null, onboardingRevision: onboarding?.revision ?? null,
      canReadRegistrants }, devices: await service.devices(token) });
  } catch (error) { return accountErrorResponse(error); }
}
export async function POST(request: Request) {
  try {
    const { service, token, config } = await accountRequest(request);
    const raw = await request.text();
    if (raw.length > 16384) throw new AccountError("ACCOUNT_INPUT", 413);
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (!p || Array.isArray(p) || typeof p !== "object") throw new AccountError("ACCOUNT_INPUT", 400);
    // Peer identity is supplied by the trusted edge; never accept an arbitrary payload identity.
    const peer = request.headers.get("cf-connecting-ip") ?? "unavailable-edge-peer";
    if (p.action === "legacy-challenge") return json(await createDeviceChallenge(p.deviceId, true));
    if (config.v2 && p.action === "recovery-devices") return json(await service.recoveryDeviceList(p,peer));
    if (config.v2 && p.action === "recover-lost-device") return json(await service.recoverLostDevice(p,peer));
    if (config.v2 && p.action === "approve-recovered-device") return json(await service.approveRecoveredDevice(p,peer));
    if (p.action === "register" || p.action === "login" || p.action === "claim") {
      let legacyId: string | null = null;
      if (p.action === "claim") {
        // This dedicated proof path MUST retain original P-256 verification even in account mode.
        const device = await verifyDeviceIdentityRequest(p, false, true);
        legacyId = device.deviceId;
      }
      const result = p.action === "register" ? await service.register(p, peer) : p.action === "login" ? await service.login(p, peer) : await service.claim(p, legacyId, peer);
      const { token: session, ...safe } = result;
      return json({ ok: true, ...safe }, sessionCookie(session));
    }
    if (config.v2) {
      const workflow = new AccountV2Workflow(await getCourseDatabase(),service);
      if (p.action === "account-state") return json(await workflow.ownStatus(token));
      if (p.action === "submit-profile") return json({ onboarding: await workflow.submitProfile(token,p) });
      if (p.action === "review-first") return json({ onboarding: await workflow.firstReview({kind:"manager",token},String(p.accountId),p.expectedRevision) });
      if (p.action === "review-changes") return json({ onboarding: await workflow.requestChanges(
        {kind:"manager",token},String(p.accountId),p.expectedRevision,p.reason) });
      if (p.action === "approve-device") return json(await service.approveDevice(token,p.deviceId,p.password,peer));
    }
    if (p.action === "rotate") { const result = await service.rotate(token); return json({ ok: true }, sessionCookie(result.token)); }
    if (p.action === "recover") return json({ ok: true, ...await service.recover(p, peer) }, sessionCookie(""));
    if (p.action === "logout") { if (token) await service.logout(token); return json({ ok: true }, sessionCookie("")); }
    if (p.action === "revoke-device") { await service.revokeDevice(token, p.deviceId); return json({ ok: true }); }
    if (p.action === "review-list") return json({ board: await service.reviewBoard(token) });
    if (p.action === "review") return json({ account: await service.review(token, String(p.accountId), String(p.operation)) });
    if (p.action === "read-registrants") return json(await service.readRegistrants(token, p.purpose, Number(p.offset ?? 0), Number(p.limit ?? 50)));
    throw new AccountError("ACCOUNT_INPUT", 400);
  } catch (error) { return accountErrorResponse(error); }
}
