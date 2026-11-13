import { AccountError } from "../../account-core.server";
import { normalizeRegistrationContact } from "../../account-contact.server";
import { accountRequest, accountErrorResponse, sessionCookie } from "../../account-runtime.server";
import { createDeviceChallenge, verifyDeviceIdentityRequest, getCourseDatabase } from "../../device-auth.server";
import { AccountV2Workflow } from "../../account-v2-workflow.server";
import { AccountEntitlementService } from "../../account-entitlement.server";
import { AccountTrialService } from "../../account-trial.server";
import { AccountSecurityQuestionService } from "../../account-security-question.server";
export const dynamic = "force-dynamic";
const json = (data: unknown, cookie?: string) => Response.json(data, { headers: { "cache-control": "no-store, private",
  "x-content-type-options": "nosniff", ...(cookie ? { "set-cookie": cookie } : {}) } });
export async function GET(request: Request) {
  try { const { service, token, config } = await accountRequest(request);
    if (!token) return json({ enabled: true, account: null, accountV2: config.v2, accountSingleReview: config.singleReview, accountUiTrial:config.uiTrial });
    // Expired/revoked browser cookies are not a reason to hide public V2
    // registration. Keep server feature flags, clear the invalid session,
    // and return anonymous state; every protected action remains fail-closed.
    let account: Awaited<ReturnType<typeof service.session>>;
    try { account = await service.session(token); }
    catch (error) {
      if (error instanceof AccountError && (error.code === "SESSION_INVALID" || error.code === "SESSION_REQUIRED"))
        return json({ enabled: true, account: null, accountV2: config.v2,
          accountSingleReview: config.singleReview, accountUiTrial:config.uiTrial }, sessionCookie(""));
      throw error;
    }
    const workflow=config.v2?new AccountV2Workflow(await getCourseDatabase(),service,config.singleReview):null;
    const onboarding = workflow ? await workflow.ownStatus(token) : null;
    const profileDraft=workflow && account.deviceApproved ? await workflow.ownProfileDraft(token) : null;
    const entitlement = config.v2 ? await new AccountEntitlementService(await getCourseDatabase()).read(account.accountId) : null;
    const question=config.v2 && account.deviceApproved
      ? await new AccountSecurityQuestionService(await getCourseDatabase(),service).status(token) : null;
    let canReadRegistrants=false;
    if(account.role==="manager"&&account.status==="approved"&&(!config.v2||(onboarding?.stage==="active"&&account.deviceApproved&&entitlement?.active===true))) {
      try { await service.capability(account,"registrants.read.all"); canReadRegistrants=true; }
      catch(error) { if(!(error instanceof AccountError)||error.code!=="ACCOUNT_PERMISSION_REQUIRED") throw error; }
    }
    // Only reveal the registration CONTACT KIND (not its value), and only to the
    // owning authenticated, trusted device. This selects the opposite UI field.
    const primaryContact=config.v2 && account.deviceApproved
      ? await (await getCourseDatabase()).prepare("SELECT kind FROM account_contacts WHERE account_id=?")
        .bind(account.accountId).first<{kind:"email"|"phone"}>() : null;
    // Only public account fields leave the server, never the principal/session hash.
    return json({ enabled: true, accountV2: config.v2, accountSingleReview: config.singleReview, accountUiTrial:config.uiTrial, account: { accountId: account.accountId, status: account.status, role: account.role,
      primaryContactKind:primaryContact?.kind??null,
      name: config.v2 && !account.deviceApproved ? null : account.name,
      storageDeviceId: config.v2 && !account.deviceApproved ? null : account.storageDeviceId,
      // Account-first V2 duration is independent from retired device access expiry.
      expiresAt: config.v2 ? (account.deviceApproved ? entitlement?.expiresAt ?? null : null) : account.expiresAt,
      entitlementActive: config.v2 ? entitlement?.active === true : undefined,
      deviceId: account.deviceId, deviceApproved: account.deviceApproved,
      onboardingStage: onboarding?.stage ?? null, onboardingRevision: onboarding?.revision ?? null,
      onboardingNote: onboarding?.reviewNote ?? null,
      profileDraftReady:profileDraft?.ready===true,
      profileDraftFields:profileDraft?.fields??null,
      securityQuestionConfigured:question?.configured===true,
      canReadRegistrants,
      // A session lease is not the 30-day account entitlement. Only the
      // server determines renewal eligibility; never expose the bearer token.
      sessionExpiresAt: account.absoluteExpiry,
      sessionIdleExpiresAt: account.idleExpiry }, devices: await service.devices(token) });
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
    if(config.v2 && p.action==="security-recovery-challenge")
      return json(await new AccountSecurityQuestionService(await getCourseDatabase(),service).challenge(p.login,peer));
    if(config.v2 && p.action==="security-recover")
      return json({ok:true,...await new AccountSecurityQuestionService(await getCourseDatabase(),service).recover(p,peer)},sessionCookie(""));
    if(config.v2 && p.action==="security-question-set")
      return json({securityQuestion:await new AccountSecurityQuestionService(await getCourseDatabase(),service).change(token,p.password,p.securityAnswer)});
    if (config.v2 && p.action === "recovery-devices") return json(await service.recoveryDeviceList(p,peer));
    if (config.v2 && p.action === "contact-check") {
      const c=normalizeRegistrationContact(p.contactType,p.contactValue);
      return json(await service.compareRegisteredContact(token,c.kind,c.value,peer));
    }
    if (config.v2 && p.action === "recover-lost-device") return json(await service.recoverLostDevice(p,peer));
    if (config.v2 && p.action === "approve-recovered-device") return json(await service.approveRecoveredDevice(p,peer));
    // Public Bơi Ếch intake is only for learners/teachers. Manager requests must
    // enter the existing App-Management Owner-controlled workflow, never via this API.
    if (p.action === "register" && p.role === "manager") throw new AccountError("MANAGER_OWNER_INTAKE_REQUIRED", 403);
    // Only public account intake is required to supply one self-declared contact.
    // Do NOT send OTP, or treat matching this string as proof of a trusted device.
    if (config.v2 && (p.action === "register" || p.action === "manager-register")) {
      if(typeof p.securityAnswer!=="string"||p.securityAnswer.trim().length<2)
        throw new AccountError("SECURITY_ANSWER_INVALID",400);
      const contact=normalizeRegistrationContact(p.contactType,p.contactValue);
      p.contactType=contact.kind;
      p.contactValue=contact.value;
    }
    if (p.action === "manager-register") {
      const result=await service.registerManagerWithInvite(p,peer);
      const {token:session,...safe}=result;
      return json({ok:true,...safe},sessionCookie(session));
    }
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
      const workflow = new AccountV2Workflow(await getCourseDatabase(),service,config.singleReview);
      if ((p.action === "trial-status" || p.action === "trial-start") && !config.uiTrial)
        throw new AccountError("TRIAL_FEATURE_DISABLED",404);
      if (p.action === "trial-status" || p.action === "trial-start") {
        const trial=new AccountTrialService(await getCourseDatabase(),service);
        return json({trial:p.action === "trial-start" ? await trial.start(token) : await trial.status(token)});
      }
      if (p.action === "account-state") return json(await workflow.ownStatus(token));
      if (p.action === "profile-draft-save") return json({ profileDraft: await workflow.saveProfileDraft(token,p) });
      if (p.action === "profile-draft-activate") return json({ onboarding: await workflow.activateProfileDraft(token) });
      if (p.action === "submit-profile") return json({ onboarding: config.singleReview
        ? await workflow.completeProfileWithoutReview(token,p) : await workflow.submitProfile(token,p) });
      if (p.action === "review-first") return json({ onboarding: await workflow.firstReview({kind:"manager",token},String(p.accountId),p.expectedRevision) });
      if (p.action === "review-changes") return json({ onboarding: await workflow.requestChanges(
        {kind:"manager",token},String(p.accountId),p.expectedRevision,p.reason) });
      if (p.action === "approve-device") return json(await service.approveDevice(token,p.deviceId,p.password,peer));
    }
    if (p.action === "keepalive") return json(await service.keepAlive(token));
    if (p.action === "rotate") { const result = await service.rotate(token); return json({ ok: true }, sessionCookie(result.token)); }
    if (p.action === "recover") return json({ ok: true, ...await service.recover(p, peer) }, sessionCookie(""));
    if (p.action === "logout") { if (token) await service.logout(token); return json({ ok: true }, sessionCookie("")); }
    if (p.action === "revoke-device") { await service.revokeDevice(token, p.deviceId); return json({ ok: true }); }
    if (p.action === "review-list") return json({ board: await service.reviewBoard(token,p.after ?? "",p.limit ?? 50) });
    if (p.action === "review") return json({ account: await service.review(token, String(p.accountId), String(p.operation)) });
    if (p.action === "read-registrants") return json(await service.readRegistrants(token, p.purpose, Number(p.offset ?? 0), Number(p.limit ?? 50)));
    throw new AccountError("ACCOUNT_INPUT", 400);
  } catch (error) { return accountErrorResponse(error); }
}
