import {
  adminPasswordFormatHint,
  adminPasswordScheme,
  createAdminSession,
} from "../../../admin-session.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const [scheme, format] = await Promise.all([adminPasswordScheme(), adminPasswordFormatHint()]);
  let sessionReady = false;
  try {
    sessionReady = Boolean(await createAdminSession());
  } catch (error) {
    console.error("ADMIN_SESSION_DIAGNOSTIC_FAILED", error instanceof Error ? error.message : "unknown");
  }

  return Response.json(
    {
      configured: scheme === "sha256" || scheme === "pbkdf2-sha256",
      scheme,
      format,
      sessionReady,
      chatgptHeaderAuth: true,
    },
    { headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } },
  );
}
