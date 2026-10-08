import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";
import { deviceErrorResponse, getAccessAutomationSettings } from "../../../device-auth.server";

export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return controlPreflight(request);
}

/** Narrow, read-only policy query. Do not load device inventory or audit history. */
export async function GET(request: Request) {
  try {
    await requireControlService(request);
    return controlResponse({ automation: await getAccessAutomationSettings() }, 200, request);
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}
