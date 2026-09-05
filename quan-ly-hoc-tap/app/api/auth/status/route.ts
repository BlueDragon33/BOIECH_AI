import { adminPasswordScheme } from "../../../admin-session.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const scheme = await adminPasswordScheme();
  return Response.json(
    { configured: scheme === "sha256" || scheme === "pbkdf2-sha256", scheme },
    { headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } },
  );
}
