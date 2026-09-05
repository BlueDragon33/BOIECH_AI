import {
  adminSessionCookie,
  createAdminSession,
  verifyAdminPassword,
} from "../../../admin-session.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = typeof form.get("password") === "string" ? String(form.get("password")) : "";
  const valid = await verifyAdminPassword(password);
  if (!valid) return Response.redirect(new URL("/login?error=1", request.url), 303);

  const session = await createAdminSession();
  if (!session) return Response.redirect(new URL("/login?error=1", request.url), 303);
  const response = Response.redirect(new URL("/", request.url), 303);
  response.headers.append("set-cookie", adminSessionCookie(session));
  response.headers.set("cache-control", "no-store, private");
  return response;
}
