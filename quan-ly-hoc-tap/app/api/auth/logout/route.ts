import { clearAdminSessionCookie } from "../../../admin-session.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const response = Response.redirect(new URL("/login", request.url), 303);
  response.headers.append("set-cookie", clearAdminSessionCookie());
  response.headers.set("cache-control", "no-store, private");
  return response;
}
