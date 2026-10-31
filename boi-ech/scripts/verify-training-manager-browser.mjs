import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawn,execFileSync} from "node:child_process";
import {chromium,expect} from "playwright/test";
const origin="http://127.0.0.1:4173";
for(const key of ["CLOUDFLARE_API_TOKEN","CLOUDFLARE_ACCOUNT_ID"]) assert.ok(!process.env[key],"Local acceptance must not receive provider credentials.");
assert.ok(process.env.CONTROL_SERVICE_SECRET?.length>=32,"Ephemeral local control fixture is required.");
fs.mkdirSync("qa-artifacts",{recursive:true});
const checks=[],samples=[],errors=[];
const wrangler="node_modules/wrangler/bin/wrangler.js";
function sql(command){return JSON.parse(execFileSync(process.execPath,[wrangler,"d1","execute","boi-ech-local","--local","--config","wrangler.local.jsonc","--persist-to",".training-qa-state","--json","--command",command],{encoding:"utf8",timeout:60000,maxBuffer:4*1024*1024}));}
const output=fs.openSync("qa-artifacts/local-worker-internal.log","w",0o600);
const server=spawn(process.execPath,[wrangler,"dev","--local","--config","dist/server/wrangler.json","--ip","127.0.0.1","--port","4173","--persist-to",".training-qa-state"],{stdio:["ignore",output,output],env:process.env});
async function post(payload){
 const response=await fetch(origin+"/api/device",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
 const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;
}
async function person(role,code,given){
 const key=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 const publicKey=await crypto.subtle.exportKey("jwk",key.publicKey);
 const {device}=await post({action:"register",publicKey});
 const {challenge}=await post({action:"challenge",deviceId:device.deviceId});
 const signature=Buffer.from(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key.privateKey,new TextEncoder().encode("boi-ech:"+device.deviceId+":"+challenge))).toString("base64url");
 const saved=await post({action:"save-registration",deviceId:device.deviceId,challenge,signature,personRole:role,personCode:code,learnerFamilyName:"QA",learnerGivenName:given,className:"Chờ phân công",phone:({QATEACHER:"0900000002",QALEARNER1:"0900000003",QALEARNER2:"0900000004"})[code]});
 return saved.device;
}
let browser,page;
async function enter(){
 await page.reload({waitUntil:"domcontentloaded"});
 const button=page.getByRole("button",{name:/^Vào khu điều phối/});
 await button.waitFor({state:"visible",timeout:60000});
 await button.click();
}
async function mutate(action,operation,status=200){
 const wait=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/training-management"&&r.request().method()==="POST"&&r.request().postDataJSON()?.action===action,{timeout:30000});
 await operation();const response=await wait;const value=await response.json();
 assert.equal(response.status(),status,JSON.stringify(value));
 await expect(page.locator("main")).toHaveAttribute("aria-busy","false",{timeout:10000});
 return value.board||value;
}
async function select(label,text){
 const field=page.getByLabel(label,{exact:true});
 const option=field.getByRole("option").filter({hasText:text}).first();
 const value=await option.getAttribute("value");assert.ok(value);await field.selectOption(value);
}
async function photograph(name,contrast=true){
 await page.evaluate(()=>document.fonts.ready);
 const measured=await page.evaluate(()=>{
  const main=document.querySelector('[data-person-role="manager"] main');
  const report={overflow:document.documentElement.scrollWidth>innerWidth+1,width:innerWidth,ratios:[],unresolved:[]};
  if(!main)return report;
  const rgba=s=>{const n=s.match(/[\d.]+/g)?.map(Number);return n&&n.length>=3?[n[0],n[1],n[2],n[3]??1]:null;};
  const over=(a,b)=>[0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3])).concat([1]);
  const light=c=>c.slice(0,3).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  for(const el of main.querySelectorAll("span[data-tone],h1,h2,p,small,label,button,a,article strong,article>span")){
   const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
   if(!rect.width||!rect.height||style.visibility!=="visible"||el.closest("fieldset:disabled")||el.matches(":disabled"))continue;
   const chain=[];let p=el,unknown=false;
   while(p){const s=getComputedStyle(p),bg=rgba(s.backgroundColor);if(Number(s.opacity)!==1||s.backgroundImage!=="none"){unknown=true;break;}if(bg)chain.unshift(bg);if(bg?.[3]===1)break;p=p.parentElement;}
   if(unknown){report.unresolved.push(el.tagName+":"+el.textContent.slice(0,40));continue;}
   let bg=[255,255,255,1];for(const paint of chain)bg=over(paint,bg);
   const fg=over(rgba(style.color),bg),l1=light(fg),l2=light(bg),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
   const size=parseFloat(style.fontSize),weight=parseFloat(style.fontWeight)||400,minimum=size>=24||size>=18.6667&&weight>=700?3:4.5;
   report.ratios.push({text:el.textContent.trim().slice(0,55),ratio:Number(ratio.toFixed(3)),minimum,tone:el.getAttribute("data-tone")});
  }
  return report;
 });
 assert.equal(measured.overflow,false,name+": horizontal overflow");
 if(contrast){
  assert.equal(measured.unresolved.length,0,name+": unmeasured paint layers");
  assert.ok(measured.ratios.length>10,name+": rendered text sample missing");
  const failures=measured.ratios.filter(x=>x.ratio+.01<x.minimum);
  assert.deepEqual(failures,[],name+": final rendered/composited contrast");
 }
 samples.push({name,...measured});
 await page.screenshot({path:"qa-artifacts/"+name+".png",fullPage:true});
}
try{
 let ready=false;
 for(let i=0;i<120;i++){try{const r=await fetch(origin,{signal:AbortSignal.timeout(2000)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
 assert.ok(ready,"Built local Cloudflare Worker did not become ready.");
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:"vi-VN",timezoneId:"Europe/Moscow"});
 page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin,{waitUntil:"domcontentloaded"});
 await expect(page.getByRole("heading",{name:"Đăng ký thông tin sử dụng.",exact:true})).toBeVisible({timeout:60000});
 assert.deepEqual(await page.locator(".person-role-field label b").allTextContents(),["Học viên","Cán bộ quản lý","Giảng viên"]);
 await photograph("registration-desktop",false);
 await page.setViewportSize({width:390,height:844});await photograph("registration-mobile",false);
 await page.locator('input[name="person-role"][value="manager"]').check();
 await page.getByLabel("Họ",{exact:true}).fill("QA");await page.getByLabel("Tên",{exact:true}).fill("Manager");
 await page.getByLabel("Số hiệu cán bộ / SQ / QNCN",{exact:true}).fill("QAMANAGER");
 await page.getByLabel("Đơn vị công tác",{exact:true}).fill("QA Điều phối");
 await page.getByLabel("Số điện thoại",{exact:true}).fill("0900000001");
 const savedPromise=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/device"&&r.request().postDataJSON()?.action==="save-registration");
 await page.getByRole("button",{name:"Lưu thông tin & mở điều phối",exact:true}).click();
 const savedResponse=await savedPromise;assert.equal(savedResponse.status(),200);
 const {device:manager}=await savedResponse.json();assert.equal(manager.personRole,"manager");assert.equal(manager.managementEnabled,false);
 checks.push("Actual browser registration: exact role order; manager registration grants no management permission.");
 await person("teacher","QATEACHER","Teacher");
 await person("learner","QALEARNER1","Learner1");await person("learner","QALEARNER2","Learner2");
 sql("UPDATE device_access SET status='approved',access_group='free',payment_status='free',access_expires_at='2035-01-01T00:00:00Z' WHERE person_code IN ('QAMANAGER','QATEACHER','QALEARNER1','QALEARNER2');");
 await enter();
 await expect(page.getByRole("status")).toContainText("Owner",{timeout:30000});
 await expect(page.getByRole("navigation",{name:"Điều phối đào tạo"})).toHaveCount(0);
 const granted=await fetch(origin+"/api/control/management-access",{method:"POST",headers:{authorization:"Bearer "+process.env.CONTROL_SERVICE_SECRET,"x-control-role":"owner","x-control-actor":"local-qa@example.invalid",origin,"content-type":"application/json"},body:JSON.stringify({deviceId:manager.deviceId,expectedPersonCode:"QAMANAGER",enabled:true})});
 const grantBody=await granted.json();assert.equal(granted.status,200,JSON.stringify(grantBody));assert.equal(grantBody.managementEnabled,true);
 await enter();const nav=page.getByRole("navigation",{name:"Điều phối đào tạo"});
 await expect(nav).toBeVisible({timeout:30000});
 checks.push("Real local Worker authorization: approved manager denied until Owner control endpoint grants permission; signed client board then loads.");
 async function resource(tab,button,name,capacity,parent){
  await nav.getByRole("button",{name:tab,exact:true}).click();await page.getByRole("button",{name:button,exact:true}).click();
  await page.getByLabel("Tên",{exact:true}).fill(name);
  if(parent)await select("Thuộc tòa học",parent);
  if(capacity)await page.getByLabel("Sức chứa học viên",{exact:true}).fill(String(capacity));
  return mutate("save-resource",()=>page.getByRole("button",{name:"Lưu và xác minh",exact:true}).click());
 }
 await resource("Tòa học","+ Thêm tòa học","QA Building");
 await resource("Phòng học","+ Thêm phòng","QA Room",2,"QA Building");
 let board=await resource("Lớp học","+ Thêm lớp","QA A",2);
 assert.equal(board.resources.find(x=>x.kind==="class").remaining,2);
 await nav.getByRole("button",{name:"Nhân sự",exact:true}).click();
 for(const name of ["QA Teacher","QA Learner1","QA Learner2"]){
  const card=page.getByRole("article").filter({has:page.getByRole("heading",{name,exact:true})});
  await card.getByRole("button",{name:name==="QA Teacher"?"Phân công lớp":"Phân lớp",exact:true}).click();
  await page.getByRole("checkbox",{name:/QA A/}).check();
  board=await mutate("assign-person",()=>page.getByRole("button",{name:"Lưu phân công",exact:true}).click());
 }
 const cls=board.resources.find(x=>x.kind==="class");assert.equal(cls.learnerCount,2);assert.equal(cls.remaining,0);assert.equal(cls.missingTeachers,0);assert.equal(cls.state,"full");
 checks.push("Real signed UI writes: create building/room/class, assign registered teacher and two learners; owning readback reports full class and zero missing staff.");
 const start=new Date(Date.now()+86400000);start.setUTCMinutes(0,0,0);const end=new Date(start.getTime()+3600000);
 const localValue=d=>new Date(d.getTime()+3*3600000).toISOString().slice(0,16);
 async function session(title){
  await nav.getByRole("button",{name:"Xếp lịch",exact:true}).click();await page.getByRole("button",{name:"+ Xếp buổi học",exact:true}).click();
  await page.getByLabel("Tên buổi học",{exact:true}).fill(title);await select("Lớp","QA A");await select("Phòng","QA Room");await select("Giảng viên phụ trách","QA Teacher");
  await page.getByLabel("Bắt đầu",{exact:true}).fill(localValue(start));await page.getByLabel("Kết thúc",{exact:true}).fill(localValue(end));
 }
 await session("QA Session");board=await mutate("save-session",()=>page.getByRole("button",{name:"Lưu và xác minh",exact:true}).click());
 assert.equal(board.summary.occupiedRooms,1);assert.equal(board.summary.freeRooms,0);
 await session("QA Overlap");await mutate("save-session",()=>page.getByRole("button",{name:"Lưu và xác minh",exact:true}).click(),409);
 await expect(page.getByRole("alert")).toContainText("Trùng lịch");await expect(page.getByLabel("Tên buổi học",{exact:true})).toHaveValue("QA Overlap");
 await photograph("conflict-draft-mobile");await page.getByRole("button",{name:"Hủy chỉnh sửa",exact:true}).click();
 const card=page.getByRole("article").filter({has:page.getByRole("heading",{name:"QA Session",exact:true})});
 await card.getByRole("button",{name:"Đổi lịch / trạng thái",exact:true}).click();await page.getByLabel("Trạng thái",{exact:true}).selectOption("cancelled");
 board=await mutate("save-session",()=>page.getByRole("button",{name:"Lưu và xác minh",exact:true}).click());
 assert.equal(board.summary.freeRooms,1);assert.equal(board.summary.occupiedRooms,0);
 checks.push("Real local backend: scheduled room occupied; overlap returns 409 with retained draft; cancelling returns the room to available.");
 for(const scheme of ["light","dark"]){
  await page.emulateMedia({colorScheme:scheme});
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===390?844:1000});
   for(const tab of ["Tổng quan","Xếp lịch","Nhân sự","Lớp học","Phòng học","Tòa học"]){
    await nav.getByRole("button",{name:tab,exact:true}).click();
    await photograph("manager-"+scheme+"-"+width+"-"+["Tổng quan","Xếp lịch","Nhân sự","Lớp học","Phòng học","Tòa học"].indexOf(tab));
   }
  }
 }
 assert.deepEqual(errors,[],"Browser runtime errors");
 checks.push("Six actual rendered manager views at desktop/mobile widths and both system color schemes: no horizontal overflow; final computed/composited text contrast checked including all five labeled state colors.");
 fs.writeFileSync("qa-artifacts/training-local-preview-report.json",JSON.stringify({schema:"training-manager.local-worker-acceptance/v1",sourceRevision:process.env.GITHUB_SHA,passed:true,checks,samples,physicalIOS:"not-performed",realCloudflareD1:"not-performed",humanOwnerMFA:"not-performed",scope:"Built application Worker, isolated local D1, real signed APIs and actual rendered UI; no provider credential or production data."},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,renderedSamples:samples.length,productionWrites:false}));
}catch(error){if(page)await page.screenshot({path:"qa-artifacts/failure.png",fullPage:true}).catch(()=>{});console.error(error);process.exitCode=1;}
finally{if(browser)await browser.close();server.kill("SIGTERM");fs.closeSync(output);}
