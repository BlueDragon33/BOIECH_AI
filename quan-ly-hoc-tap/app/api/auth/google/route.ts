import { cookies } from "next/headers";
import { adminSessionCookie, createAdminSessionForIdentity } from "../../../admin-session.server";
import { verifyGoogleAdminCredential } from "../../../google-auth.server";

export const dynamic = "force-dynamic";

function loginRedirect(request: Request, code: string) {
  return Response.redirect(new URL(`/login?google_error=${encodeURIComponent(code)}`, request.url), 303);
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const credential = typeof form.get("credential") === "string" ? String(form.get("credential")) : "";
    const formCsrf = typeof form.get("g_csrf_token") === "string" ? String(form.get("g_csrf_token")) : "";
    const cookieStore = await cookies();
    const cookieCsrf = cookieStore.get("g_csrf_token")?.value ?? "";

    if (!credential || !formCsrf || !cookieCsrf || formCsrf !== cookieCsrf) {
      return loginRedirect(request, "csrf");
    }

    const identity = await verifyGoogleAdminCredential(credential);
    if (!identity) return loginRedirect(request, "not_allowed");

    const session = await createAdminSessionForIdentity(identity.email, identity.displayName);
    if (!session) return loginRedirect(request, "session");

    const response = Response.redirect(new URL("/", request.url), 303);
    response.headers.append("set-cookie", adminSessionCookie(session));
    response.headers.set("cache-control", "no-store, private");
    return response;
  } catch {
    return loginRedirect(request, "runtime");
  }
}
