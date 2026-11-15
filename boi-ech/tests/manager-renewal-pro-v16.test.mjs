import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const ts=require("typescript");
const file=name=>readFileSync(new URL("../app/"+name,import.meta.url),"utf8");
function load(source,requireFn=()=>{throw new Error("Unexpected dependency");}){
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const moduleInstance={exports:{}};
 new Function("module","exports","require",js)(moduleInstance,moduleInstance.exports,requireFn);
 return moduleInstance.exports;
}
const accountTerm=load(file("account-term.ts"));
const view=load(file("manager-renewal-view.ts"),name=>{
 assert.equal(name,"./account-term");
 return accountTerm;
});
const forever=accountTerm.FOREVER_EXPIRES_AT;
const now=Date.UTC(2026,10,15,12,0);
const make=(name,role,expiry,progress=null)=>({accountId:"acc_"+String(name.length).padStart(64,"0"),name,role,expiresAt:expiry,revision:0,progress});

test("permanent canonical account never carries expired label or generated future year",()=>{
 assert.equal(view.accountTermState(forever,now),"permanent");
 assert.equal(view.remainingAccountDays(forever,now),null);
 assert.equal(view.renewalStatusText("permanent"),"Vĩnh viễn");
 assert.equal(view.accountTimeLabel(forever,now),"Không giới hạn");
 assert.equal(view.renewalMatchesStatus(make("Giảng viên A","teacher",forever),"permanent",now),true);
 assert.equal(view.renewalMatchesStatus(make("Giảng viên A","teacher",forever),"expired",now),false);
 assert.equal(view.accountTermState("9999-12-31T23:59:58.000Z",now),"active","near-sentinel remains finite");
});
test("30-day, expired, 5-min and exact-boundary statuses are correctly classified",()=>{
 const later=days=>new Date(now+days*86400000).toISOString();
 assert.equal(view.accountTermState(later(30),now),"soon");
 assert.equal(view.accountTermState(later(30)+".invalid",now),"unknown");
 assert.equal(view.accountTermState(later(31),now),"active");
 assert.equal(view.accountTermState(later(0),now),"expired");
 assert.equal(view.accountTermState(later(-1),now),"expired");
 assert.equal(view.accountTermState(new Date(now+300000).toISOString(),now),"soon");
 assert.equal(view.accountTimeLabel(new Date(now+300000).toISOString(),now),"Còn dưới 1 ngày");
 assert.equal(view.renewalStatusText("soon"),"Sắp hết hạn");
 assert.equal(view.renewalStatusText("expired"),"Hết hạn");
 assert.equal(view.expiryDateLabel("not-a-date"),"Chưa xác định");
});
test("summary cards are derived only from verified server rows",()=>{
 const data=[
  make("A","learner",new Date(now+180*86400000).toISOString()),
  make("B","learner",new Date(now+30*86400000).toISOString()),
  make("C","teacher",forever),
  make("D","teacher",new Date(now-1000).toISOString())
 ];
 assert.deepEqual(view.renewalCounts(data,now),{verified:4,soon:1,teacher:2,learner:2});
 assert.deepEqual(view.renewalCounts([],now),{verified:0,soon:0,teacher:0,learner:0});
 assert.equal(view.renewalMatchesStatus(data[1],"soon",now),true);
 assert.equal(view.renewalMatchesStatus(data[2],"soon",now),false);
 assert.equal(view.renewalMatchesStatus(data[3],"expired",now),true);
});
test("progress bars only use valid progress returned by server",()=>{
 assert.deepEqual(view.verifiedProgress({completed:6,total:8}),{completed:6,total:8,percent:75});
 assert.deepEqual(view.verifiedProgress({completed:0,total:8}),{completed:0,total:8,percent:0});
 assert.equal(view.verifiedProgress({completed:8,total:0}),null);
 assert.equal(view.verifiedProgress({completed:9,total:8}),null);
 assert.equal(view.verifiedProgress(null),null);
});
test("actual Manager renewal UI has separate role sections, selected status filters and permanent-only display",()=>{
 const jsx=file("manager-renewal-panel.tsx");
 const css=file("manager-renewal-panel.module.css");
 assert.match(jsx,/data-role="learner" aria-labelledby="renewal-learner-heading"/);
 assert.match(jsx,/data-role="teacher" aria-labelledby="renewal-teacher-heading"/);
 assert.match(jsx,/role!=="teacher"/);
 assert.match(jsx,/role!=="learner"/);
 assert.match(jsx,/renewalMatchesStatus\(x,statusFilter,now\)/);
 assert.match(jsx,/aria-pressed=\{statusFilter===item.id\}/);
 assert.match(jsx,/renewalCounts\(rows\?\?\[\],now\)/);
 assert.match(jsx,/\{rows\?counts\[card.key\]:"—"\}/);
 assert.match(jsx,/unlimited\?<div className=\{styles\.permanentInfo\} data-permanent="true"/);
 assert.match(jsx,/Loại thời hạn/);
 assert.match(jsx,/Không giới hạn/);
 assert.match(jsx,/\}:<div className=\{styles\.expiryInfo\}/);
 assert.match(jsx,/verifiedProgress\(x.progress\)/);
 assert.doesNotMatch(jsx,/(?:ngô tuyết quỳnh|caovan dung|42,300|181 ngày|100%)/i,"must not hardcode concept data");
 assert.match(css,/\.roleSection\[data-role=teacher\]/);
 assert.match(css,/\.metrics\{/);
 assert.match(css,/\.filterGroup\{/);
 assert.match(css,/\.panel :is\(button,input,select,textarea\):focus-visible/);
 assert.match(css,/@media\(max-width:490px\)/);
 assert.doesNotMatch(css,/\.list\{[^}]*max-height:/,"browser should scroll naturally, no cutoff roster");
});
test("server-side revision, explicit user confirmation and D1 readback remain unmodified",()=>{
 const jsx=file("manager-renewal-panel.tsx");
 assert.match(jsx,/action:"manager-renew-list"/);
 assert.match(jsx,/action:"manager-renew",accountId:record.accountId/);
 assert.match(jsx,/expectedRevision:record.revision/);
 assert.match(jsx,/window.confirm\("ĐẶT LẠI"/);
 assert.match(jsx,/result.entitlement.revision!==record.revision\+1/);
 assert.match(jsx,/reason.trim\(\).length<10/);
 assert.match(jsx,/Lưu và đọc lại D1/);
 assert.match(jsx,/role="dialog" aria-modal="true"/);
});
