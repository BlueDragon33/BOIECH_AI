export const dynamic = "force-dynamic";

export const BOI_CONTROL_RUNTIME_CONTRACT = {
  applicationId: "boi-ech",
  repository: "BlueDragon33/BOIECH_AI",
  runtime: "boi-ech",
  controlContract: "application-management",
  controlGeneration: 2,
  sourceTrack: "main",
} as const;

export async function GET() {
  return Response.json(BOI_CONTROL_RUNTIME_CONTRACT, {
    headers: {
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}
