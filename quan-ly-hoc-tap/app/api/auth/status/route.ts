import {
  adminPasswordFormatHint,
  adminPasswordScheme,
  adminSessionReady,
} from "../../../admin-session.server";
import { googleAuthReady } from "../../../google-auth.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const [scheme, format, sessionReady, googleConfigured] = await Promise.all([
    adminPasswordScheme(),
    adminPasswordFormatHint(),
    adminSessionReady(),
    googleAuthReady(),
  ]);

  return Response.json(
    {
      configured: scheme === "sha256" || scheme === "pbkdf2-sha256",
      scheme,
      format,
      sessionReady,
      chatgptHeaderAuth: true,
      googleConfigured,
    },
    { headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } },
  );
}
