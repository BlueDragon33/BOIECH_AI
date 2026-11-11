import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {accountStack} from "./helpers/account-stack.mjs";

test("Owner account read requires the server account channel, while general browser tickets still work on their own channel",async()=>{
 const secret="local-control-audience-fixture-key-only";
 const f=accountStack({v2:true,singleReview:true,controlSecret:secret});
 try {
  function ticket(aud,ttl=30_000){
   const claims={iss:"quan-ly-hoc-tap",aud,actor:"owner@fixture.invalid",role:"owner",exp:Date.now()+ttl};
   const signed="v1."+Buffer.from(JSON.stringify(claims)).toString("base64url");
   return signed+"."+createHmac("sha256",secret).update(signed).digest("base64url");
  }
  const request=(token,origin)=>new Request("https://fixture.invalid/api/control/accounts",{
   method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json",...(origin?{origin}:{})},
   body:JSON.stringify({action:"entitlement-policy"}),
  });
  const route=f.load("api/control/accounts/route.ts"),control=f.load("control-auth.server.ts");
  const browser=ticket("boi-ech-control"),server=ticket("boi-ech-accounts");
  assert.equal((await control.requireControlService(request(browser))).role,"owner");
  assert.equal((await route.POST(request(browser))).status,403);
  assert.equal((await route.POST(request(secret))).status,403);
  assert.equal((await route.POST(request(server,"https://app.fixture.invalid"))).status,403);
  assert.equal((await route.POST(request(ticket("boi-ech-accounts",65_000)))).status,403);
  await assert.rejects(()=>control.requireControlService(request(ticket("boi-ech-control",605_000))),error=>error.status===403);
  const response=await route.POST(request(server));assert.equal(response.status,200);
  assert.equal((await response.json()).policies.find(p=>p.role==="manager").defaultDays,30);
  await assert.rejects(()=>control.requireControlService(request(server)),error=>error.status===403);
 }finally{f.close();}
});
