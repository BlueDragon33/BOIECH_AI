import { createEditorSessionFromControlTicket, editorSessionCookie } from "../../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ticket = url.searchParams.get("ticket") ?? "";
  const session = await createEditorSessionFromControlTicket(ticket);
  if (!session) return Response.redirect(new URL("/editor-login-required", request.url), 303);
  const response = Response.redirect(new URL("/bien-tap-suc-khoe-tre", request.url), 303);
  response.headers.append("set-cookie", editorSessionCookie(session.token));
  response.headers.set("cache-control", "no-store, private");
  return response;
}
