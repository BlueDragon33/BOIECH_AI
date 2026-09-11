import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";
import { deviceErrorResponse, getCourseDatabase } from "../../../device-auth.server";

export const dynamic = "force-dynamic";

async function runtimeMetadata() {
  const workers = await import("cloudflare:workers");
  const values = workers.env as unknown as Record<string, unknown>;
  return {
    channel: typeof values.BOI_ECH_DEPLOYMENT_CHANNEL === "string" ? values.BOI_ECH_DEPLOYMENT_CHANNEL : "unknown",
    revision: typeof values.BOI_ECH_BUILD_REVISION === "string" ? values.BOI_ECH_BUILD_REVISION : "unknown",
    source: typeof values.BOI_ECH_BUILD_SOURCE === "string" ? values.BOI_ECH_BUILD_SOURCE : "BlueDragon33/BOIECH_AI/boi-ech",
    paymentStorageReady: Boolean(values.BUCKET),
  };
}

export function OPTIONS(request: Request) {
  return controlPreflight(request);
}

export async function GET(request: Request) {
  try {
    await requireControlService(request);
    const database = await getCourseDatabase();
    await database.prepare("SELECT 1 AS ok").first();
    return controlResponse({
      ok: true,
      application: "boi-ech",
      protocol: "boi-ech-control-v1",
      deployment: await runtimeMetadata(),
      ownership: {
        runtime: "BOIECH_AI/boi-ech",
        database: "BOIECH_AI/boi-ech",
        deviceRegistry: "BOIECH_AI/boi-ech",
        centralRole: "policy-and-remote-admin-only",
      },
      endpoints: {
        status: "/api/control/status",
        overview: "/api/control/overview",
        content: "/api/control/content",
        paymentProof: "/api/control/payment-proof",
      },
      capabilities: {
        deviceAccess: true,
        deviceAutoApproval: true,
        destructiveDeviceDelete: true,
        personalEditPermission: true,
        paymentReview: true,
        contentReview: true,
        audit: true,
      },
      checkedAt: Date.now(),
    }, 200, request);
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}
