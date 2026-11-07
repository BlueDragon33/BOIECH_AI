import { AccountError } from "../../../account-core.server";
import { readAccountCapacity, changeAccountCapacity } from "../../../account-capacity.server";
import { getCourseDatabase } from "../../../device-auth.server";
import { accountErrorResponse, accountService } from "../../../account-runtime.server";
import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";
export const dynamic = "force-dynamic";
export function OPTIONS(request: Request) { return controlPreflight(request); }
export async function POST(request: Request) {
  try {
    const owner = await requireControlService(request);
    if (owner.role !== "owner") throw new AccountError("OWNER_REQUIRED");
    const raw = await request.text();
    if (raw.length > 4096) throw new AccountError("ACCOUNT_INPUT", 413);
    const input = JSON.parse(raw) as Record<string, unknown>;
    const service = await accountService();
    if (input.action === "capacity") return controlResponse(await readAccountCapacity(await getCourseDatabase(), owner), 200, request);
    if (input.action === "set-capacity") return controlResponse(await changeAccountCapacity(await getCourseDatabase(), owner, input), 200, request);
    if (input.action === "list") return controlResponse({ accounts: await service.ownerList() }, 200, request);
    if (input.action === "read") return controlResponse(await service.ownerRead(String(input.accountId)), 200, request);
    if (input.action !== "command") throw new AccountError("ACCOUNT_INPUT", 400);
    return controlResponse(await service.ownerCommand(owner, input), 200, request);
  } catch (error) { return withControlCors(request, accountErrorResponse(error)); }
}
