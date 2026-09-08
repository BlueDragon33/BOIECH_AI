import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";
import { deviceErrorResponse, getHealthControlStatus } from "../../../device-auth.server";

export const dynamic = "force-dynamic";
export function OPTIONS(request: Request) { return controlPreflight(request); }

export async function GET(request: Request) {
  try {
    await requireControlService(request);
    return controlResponse(await getHealthControlStatus(), 200, request);
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}
