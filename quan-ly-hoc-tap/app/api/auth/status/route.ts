import { adminPasswordFormatHint, adminPasswordScheme } from "../../../admin-session.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const [scheme, format] = await Promise.all([adminPasswordScheme(), adminPasswordFormatHint()]);
  return Response.json(
    { configured: scheme === "sha256" || scheme === "pbkdf2-sha256", scheme, format },
    { headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } },
  );
}
