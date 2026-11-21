/**
 * Read-only public Production smoke: verifies the editor route renders without
 * the global Next.js error boundary, and that the new session endpoint never
 * grants anonymous editorial access. Does not claim signed teacher E2E PASS.
 */
const origin="https://boi-ech.boiech-ai.workers.dev";
async function request(path){
  const response=await fetch(origin+path,{
    method:"GET",
    headers:{"accept":path.startsWith("/api/")?"application/json":"text/html",
      "cache-control":"no-cache"},
    redirect:"manual",
    signal:AbortSignal.timeout(20000),
  });
  return response;
}

const page=await request("/bien-tap-noi-dung?lesson=01&return=teacher&tab=class&class=QK19-QL15");
if(page.status!==200 || !page.headers.get("content-type")?.includes("text/html")){
  throw new Error(`Editor page is not serving HTML: HTTP ${page.status}`);
}
const html=await page.text();
if(html.includes("Không thể hiển thị màn hình này") ||
   html.includes("Ứng dụng có phiên bản mới") ||
   !html.includes("Đang xác minh phiên biên tập")){
  throw new Error("Editor page did not render the expected safe session bootstrap.");
}
const session=await request("/api/editor/session");
if(session.status!==401 || !session.headers.get("content-type")?.includes("application/json")){
  throw new Error(`Anonymous editor session boundary is not fail-closed: HTTP ${session.status}`);
}
const payload=await session.json();
if(payload?.code!=="EDITOR_SESSION_REQUIRED" || payload.user){
  throw new Error("Anonymous editor session returned an unexpected identity/authorization payload.");
}
if(!session.headers.get("cache-control")?.includes("no-store")){
  throw new Error("Editor session boundary must not be cached.");
}
console.log("Editor public page and anonymous session boundary PASS (no signed E2E claimed).");
