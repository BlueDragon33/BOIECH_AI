export const dynamic = "force-dynamic";

const BOI_UNIVERSAL_MANAGEMENT_CONTRACT = {
  schema: "application-management.contract/v1",
  protocol: "application-management.contract/v1",
  application: {
    id: "boi-ech",
    name: "Bơi ếch AI",
    shortName: "Bơi ếch",
    category: "Học tập",
    version: "1",
    repository: "BlueDragon33/BOIECH_AI",
  },
  capabilities: {
    deviceRegistry: false,
    deviceApproval: false,
    deviceBlock: false,
    deviceUnblock: false,
    deviceEditPermission: false,
    deviceIdempotentCommands: false,
    optimisticConcurrency: false,
    sessions: false,
    audit: true,
    contentReview: true,
    payments: true,
    reports: false,
    webLaunch: true,
  },
  endpoints: {
    status: "/api/control/status",
  },
  policy: {
    remoteAdminReady: false,
    specialAccessFlow: "free-or-paid-access-must-be-explicit",
    genericDeviceMutationAllowed: false,
    paymentBackedApprovalMustUseBoiAccessFlow: true,
  },
} as const;

export async function GET() {
  return Response.json(BOI_UNIVERSAL_MANAGEMENT_CONTRACT, {
    headers: {
      "cache-control": "public, max-age=300, must-revalidate",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
    },
  });
}
