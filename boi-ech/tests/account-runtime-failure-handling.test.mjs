import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source=fs.readFileSync(new URL("../app/account-gate.tsx",import.meta.url),"utf8");
const ast=ts.createSourceFile("account-gate.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions=ast.statements.filter(node=>ts.isFunctionDeclaration(node)&&
  ["readAccountPayload","send","accountNetworkError"].includes(node.name?.text));
assert.equal(functions.length,3,"exercise actual production fetch/error helpers");
const compiled=ts.transpileModule(functions.map(node=>node.getText(ast)).join("\n"),{
  compilerOptions:{target:ts.ScriptTarget.ES2022},
}).outputText;
const harness=(fetchMock)=>new Function("fetch",compiled+
  ";return {readAccountPayload,send,accountNetworkError};")(fetchMock);
const html=(status)=>new Response("<html><body>Cloudflare gateway error</body></html>",{
  status,headers:{"content-type":"text/html"},
});

test("existing login session read accepts valid JSON and safely treats an unformatted 401 as logout",async()=>{
  const {readAccountPayload}=harness(async()=>null);
  assert.deepEqual(await readAccountPayload(Response.json({account:{accountId:"acc_fixture"}})),
    {account:{accountId:"acc_fixture"}});
  assert.deepEqual(await readAccountPayload(html(401)),{});
  assert.deepEqual(await readAccountPayload(new Response(null,{status:401})),{});
});

test("failed or empty Cloudflare responses become actionable Vietnamese errors, never raw HTML",async()=>{
  const {readAccountPayload}=harness(async()=>null);
  await assert.rejects(()=>readAccountPayload(html(503)),
    e=>/Máy chủ tài khoản tạm gián đoạn/.test(e.message)&&/tránh tạo yêu cầu trùng/.test(e.message));
  await assert.rejects(()=>readAccountPayload(html(429)),
    e=>/15 phút/.test(e.message));
  await assert.rejects(()=>readAccountPayload(new Response(null,{status:200})),
    e=>/dữ liệu không đúng định dạng/.test(e.message));
  await assert.rejects(()=>readAccountPayload(new Response("[]",{status:200})),
    e=>/dữ liệu không đúng định dạng/.test(e.message));
});

test("failed registration sends exactly one same-origin POST; error handling does not silently resubmit",async()=>{
  let calls=0,details;
  const {send}=harness(async(url,init)=>{
    calls++;details={url,init};return html(502);
  });
  await assert.rejects(()=>send({action:"register",role:"learner"}),
    e=>/Máy chủ tài khoản tạm gián đoạn/.test(e.message));
  assert.equal(calls,1);
  assert.equal(details.url,"/api/accounts");
  assert.equal(details.init.credentials,"same-origin");
  assert.equal(details.init.cache,"no-store");
  assert.equal(details.init.method,"POST");
  assert.equal(JSON.parse(details.init.body).action,"register");
});

test("server-coded authentication errors preserve per-field routing and do not bypass failed login",async()=>{
  let calls=0;
  const {send}=harness(async()=>{calls++;return Response.json({
    code:"AUTH_FAILED",error:"Tên đăng nhập hoặc thông tin xác thực chưa đúng.",
  },{status:401})});
  await assert.rejects(()=>send({action:"login",login:"example",password:"wrong"}),
    e=>e.code==="AUTH_FAILED"&&/chưa đúng/.test(e.message));
  assert.equal(calls,1);
  assert.match(source,/code==="AUTH_FAILED"\?"password"/);
  assert.match(source,/setFieldErrors\(previous=>\(\{\.\.\.previous,\[target\]/);
});

test("account state refresh is event-driven without fixed-interval server polling",()=>{
  assert.doesNotMatch(source,/needsApprovalPolling \? 20000 : 60000/);
  assert.doesNotMatch(source,/window\.setInterval\(\(\) => \{ if\(mounted\.current\)/);
  assert.match(source,/if \(document\.hidden \|\| lock\.current\) return/);
  assert.match(source,/if \(refreshInFlight\.current\) \{ queuedAfterCurrent = true; return; \}/);
  assert.match(source,/if \(typeof BroadcastChannel !== "undefined"\)/);
  assert.match(source,/if \(typeof BroadcastChannel === "undefined"\) return/);
  assert.match(source,/channel\?\.close\(\)/);
  assert.match(source,/window\.addEventListener\("focus", refresh\)/);
  assert.match(source,/window\.addEventListener\("pageshow",refresh\)/);
  assert.match(source,/window\.addEventListener\("online",refresh\)/);
  assert.match(source,/navigator\.serviceWorker\?\.addEventListener\("message",onRemoteNotification\)/);
});
