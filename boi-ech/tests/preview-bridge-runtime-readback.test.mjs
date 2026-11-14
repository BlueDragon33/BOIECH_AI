import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {fileURLToPath} from "node:url";
import {readBoiPreviewRuntime} from "../scripts/preview-stack-remote.mjs";

const origin = "https://application-management-preview.boiech-ai.workers.dev";
const target = "https://boi-ech-preview.boiech-ai.workers.dev/api/control/status";
const secret = "test-only-bridge-not-real-credential";

function response(status, code, extras = {}) {
  return Response.json({...extras, ...(code ? {code} : {})},{status});
}

test("live bridge rechecks exact origin, viewer role and no-store; bounded stale credential retry", async () => {
  const returned = {ok:true,application:"boi-ech",deployment:{revision:"a".repeat(40),channel:"cloudflare-preview",paymentStorageReady:false}};
  const outcomes = [
    response(403,"CONTROL_SERVICE_FORBIDDEN"),
    response(403,"CONTROL_TICKET_FORBIDDEN"),
    Response.json(returned),
  ];
  const requests = [], delays = [];
  const fetcher = async (url,init) => {
    requests.push({url,init});
    return outcomes.shift();
  };
  const got = await readBoiPreviewRuntime(secret,fetcher,async ms => delays.push(ms));
  assert.deepEqual(got,returned);
  assert.deepEqual(delays,[1000,2000]);
  assert.equal(requests.length,3);
  for(const {url,init} of requests){
    assert.equal(url,target);
    assert.equal(init.headers.origin,origin);
    assert.equal(init.headers["x-control-role"],"viewer");
    assert.equal(init.headers.authorization,`Bearer ${secret}`);
    assert.equal(init.cache,"no-store");
    assert.equal(init.redirect,"error");
  }
});

test("never retry forbidden origin, WAF response, unknown 403 or server error",async()=>{
 const cases=[
  [response(403,"CONTROL_ORIGIN_FORBIDDEN"),"CONTROL_ORIGIN_FORBIDDEN"],
  [response(403,"ACCOUNT_SUMMARY_FORBIDDEN"),"UNKNOWN"],
  [new Response("<html>Cloudflare challenge</html>",{status:403,headers:{"content-type":"text/html"}}),"UNKNOWN"],
  [response(500,"DEVICE_SERVICE_ERROR"),"UNKNOWN"]
 ];
 for(const [result,expected] of cases){
  let requests=0, waits=0;
  await assert.rejects(
   readBoiPreviewRuntime(secret,async()=>{requests++;return result;},async()=>{waits++;}),
   error => error.message.includes(`safe code ${expected}`) &&
     !error.message.includes(secret) && !error.message.includes("Cloudflare challenge")
  );
  assert.equal(requests,1);
  assert.equal(waits,0);
 }
});

test("stale secret is bounded to five requests, without success or bypass",async()=>{
 let requests=0; const delays=[];
 await assert.rejects(
  readBoiPreviewRuntime(secret,async()=>{requests++;return response(403,"CONTROL_SERVICE_FORBIDDEN");},
    async ms=>delays.push(ms)),
  /HTTP 403; safe code CONTROL_SERVICE_FORBIDDEN/
 );
 assert.equal(requests,5);
 assert.deepEqual(delays,[1000,2000,4000,8000]);
});

test("Preview bridge requires exact checked Origin binding before any secret rotation",()=>{
 const file=fs.readFileSync(fileURLToPath(new URL("../scripts/preview-stack-remote.mjs",import.meta.url)),"utf8");
 const gate=file.indexOf('variable(boi,"APPLICATION_MANAGEMENT_ORIGIN")');
 const rotation=file.indexOf('for (const worker of [BOI, APP]) await api(worker, "secrets"');
 assert.ok(gate>0 && rotation>gate);
 assert.match(file,/Live Bơi Ếch Preview control Origin policy mismatch; refuse bridge writes/);
});
