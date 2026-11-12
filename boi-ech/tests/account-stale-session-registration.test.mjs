import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source=fs.readFileSync(new URL("../app/api/accounts/route.ts",import.meta.url),"utf8");
const ast=ts.createSourceFile("route.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const get=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="GET");
assert.ok(get,"execute the actual GET handler declaration");
const code=ts.transpileModule(get.getText(ast).replace("export async","async"),{
  compilerOptions:{target:ts.ScriptTarget.ES2022},
}).outputText;
class AccountError extends Error {
  constructor(code,status=403){super(code);this.code=code;this.status=status;}
}
function fixture({token="",codeError="",config={v2:true,singleReview:true,uiTrial:false}}={}){
  let reads=0,clears=0,failed=0;
  const service={
    async session(){reads++;if(codeError)throw new AccountError(codeError,codeError.startsWith("SESSION_")?401:503);
      return {accountId:"account-present"};},
  };
  const json=(data,cookie)=>Response.json(data,{headers:cookie?{"set-cookie":cookie}:{}});
  const accountErrorResponse=error=>{failed++;return Response.json({code:error.code??"ACCOUNT_SERVICE_UNAVAILABLE"},{status:error.status??503});};
  const sessionCookie=value=>{assert.equal(value,"");clears++;return "__Host-boiech-session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";};
  const handler=new Function("accountRequest","AccountError","json","accountErrorResponse","sessionCookie",
    code+";return GET;")(
      async()=>({service,token,config}),AccountError,json,accountErrorResponse,sessionCookie);
  return {handler,observed:()=>({reads,clears,failed})};
}
const request=new Request("https://fixture.invalid/api/accounts");

test("anonymous registration still learns the real server V2 configuration",async()=>{
  const fx=fixture();
  const response=await fx.handler(request);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{
    enabled:true,account:null,accountV2:true,accountSingleReview:true,accountUiTrial:false,
  });
  assert.equal(response.headers.has("set-cookie"),false);
  assert.deepEqual(fx.observed(),{reads:0,clears:0,failed:0});
});
test("revoked/expired cookie clears invalid session and keeps registration enabled",async()=>{
  for(const codeError of ["SESSION_INVALID","SESSION_REQUIRED"]){
    const fx=fixture({token:"invalid-cookie",codeError});
    const response=await fx.handler(request);
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.account,null);
    assert.equal(body.accountV2,true);
    assert.equal(body.accountSingleReview,true);
    assert.equal(body.accountUiTrial,false);
    assert.match(response.headers.get("set-cookie"),/Max-Age=0/);
    assert.deepEqual(fx.observed(),{reads:1,clears:1,failed:0});
    assert.doesNotMatch(JSON.stringify(body),/account-present|deviceId|storageDeviceId/);
  }
});
test("wrong server configuration is never guessed to be enabled",async()=>{
  const fx=fixture({token:"old",codeError:"SESSION_INVALID",
    config:{v2:false,singleReview:false,uiTrial:false}});
  const body=await (await fx.handler(request)).json();
  assert.equal(body.accountV2,false);
  assert.equal(body.accountSingleReview,false);
});
test("database/configuration failures never masquerade as a logged-out session",async()=>{
  const fx=fixture({token:"old",codeError:"ACCOUNT_PERMISSION_REQUIRED"});
  const response=await fx.handler(request);
  assert.equal(response.status,503);
  assert.equal((await response.json()).code,"ACCOUNT_PERMISSION_REQUIRED");
  assert.deepEqual(fx.observed(),{reads:1,clears:0,failed:1});
});
test("existing authenticated GET path and all authorization boundaries remain intact",()=>{
  for(const token of [
    "await service.session(token)",
    "new AccountV2Workflow",
    "new AccountEntitlementService",
    "account.deviceApproved",
    "account.status",
    "await service.devices(token)"
  ])assert.ok(source.includes(token),"missing protected read "+token);
  assert.match(source,/return json\(\{ enabled: true, account: null, accountV2: config\.v2/);
});
