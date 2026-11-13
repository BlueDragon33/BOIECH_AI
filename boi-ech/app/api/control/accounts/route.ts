import { AccountError } from "../../../account-core.server";
import { cancelLocalPendingManager } from "../../../manager-local-reset.server";
import { AccountEntitlementService } from "../../../account-entitlement.server";
import { readAccountCapacity, changeAccountCapacity } from "../../../account-capacity.server";
import { AccountV2Workflow } from "../../../account-v2-workflow.server";
import { getCourseDatabase } from "../../../device-auth.server";
import { accountErrorResponse, accountService, accountConfiguration } from "../../../account-runtime.server";
import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";
export const dynamic = "force-dynamic";
export function OPTIONS(request: Request) { return controlPreflight(request); }
export async function POST(request: Request) {
  try {
    const owner = await requireControlService(request, "account-owner");
    if (owner.role !== "owner") throw new AccountError("OWNER_REQUIRED");
    const raw = await request.text();
    if (raw.length > 4096) throw new AccountError("ACCOUNT_INPUT", 413);
    const input = JSON.parse(raw) as Record<string, unknown>;
    const service = await accountService();
    const config = await accountConfiguration();
    const v2 = config.v2;
    const entitlement = v2 ? new AccountEntitlementService(await getCourseDatabase()) : null;
    if (entitlement) {
      if (input.action === "list-entitlements") return controlResponse({accounts:await entitlement.list(owner)},200,request);
      if (input.action === "entitlement-policy") return controlResponse({policies:await entitlement.policy()},200,request);
      if (input.action === "set-entitlement-policy") return controlResponse({policy:await entitlement.setPolicy(owner,input)},200,request);
      if (input.action === "read-entitlement") return controlResponse({entitlement:await entitlement.read(input.accountId)},200,request);
      if (input.action === "set-entitlement") return controlResponse({entitlement:await entitlement.change(owner,input)},200,request);
    }
    if (input.action === "cancel-pending-manager-local") {
      const runtime=(await import("cloudflare:workers")).env as unknown as Record<string,unknown>;
      const url=new URL(request.url);
      if(runtime.LOCAL_CONTROL_PLANE!=="true" || !["localhost","127.0.0.1"].includes(url.hostname)
        ||config.origin!==url.origin||!v2||!config.singleReview)
        throw new AccountError("ACCOUNT_RESET_LOCAL_ONLY",403);
      return controlResponse(await cancelLocalPendingManager(
        await getCourseDatabase(),owner,input.accountId,input.expectedRevision,input.confirmation),200,request);
    }
    if (v2) {
      const workflow = new AccountV2Workflow(await getCourseDatabase(),service,config.singleReview);
      if (input.action === "review-first") return controlResponse({ onboarding: await workflow.firstReview(
        {kind:"owner",actor:owner.actor},String(input.accountId),input.expectedRevision) },200,request);
      if (input.action === "review-changes") return controlResponse({ onboarding: await workflow.requestChanges(
        {kind:"owner",actor:owner.actor},String(input.accountId),input.expectedRevision,input.reason) },200,request);
    }
    if (input.action === "capacity") return controlResponse(await readAccountCapacity(await getCourseDatabase(), owner), 200, request);
    if (input.action === "set-capacity") return controlResponse(await changeAccountCapacity(await getCourseDatabase(), owner, input), 200, request);
    // Owner-only canonical Account-first V2 intake; this contract must not report
    // an empty verified inbox while the V2 backend is not actually enabled.
    if (input.action === "manager-inbox-v2") return controlResponse(
      await service.ownerManagerPage(input.after ?? "",input.limit ?? 40),200,request);
    if (input.action === "archive-manager") {
      if (!v2) throw new AccountError("ACCOUNT_V2_REQUIRED",409);
      return controlResponse(await service.archiveManager(owner,input),200,request);
    }
    if (input.action === "create-manager-invite") return controlResponse(
      await service.issueManagerInvite(owner,input.expectedRevision),200,request);
    if (input.action === "list-all") return controlResponse(
      await service.ownerAllAccounts(input.after ?? "",input.limit ?? 40),200,request);
    if (input.action === "list") return controlResponse({ accounts: await service.ownerList() }, 200, request);
    if (input.action === "read") return controlResponse(await service.ownerRead(String(input.accountId)), 200, request);
    if (input.action !== "command") throw new AccountError("ACCOUNT_INPUT", 400);
    return controlResponse(await service.ownerCommand(owner, input), 200, request);
  } catch (error) { return withControlCors(request, accountErrorResponse(error)); }
}
