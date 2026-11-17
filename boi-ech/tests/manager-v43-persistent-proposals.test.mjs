import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {createRequire} from "node:module";
import {DatabaseSync} from "node:sqlite";
import ts from "typescript";

const require=createRequire(import.meta.url);
const api=readFileSync(resolve("app/api/training-ai-proposals/route.ts"),"utf8");
const migration=readFileSync(resolve("drizzle/0044_manager_ai_proposal_review.sql"),"utf8");
const panel=readFileSync(resolve("app/manager-ai-allocation-panel-v42.tsx"),"utf8");
const manager=readFileSync(resolve("app/manager-workspace.tsx"),"utf8");
const js=ts.transpileModule(api,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const when="2030-06-06T09:00:00Z";
function fixture(t){
 const sqlite=new DatabaseSync(":memory:");
 t.after(()=>sqlite.close());
 sqlite.exec(`
 CREATE TABLE device_access(device_id TEXT PRIMARY KEY,class_name TEXT);
 CREATE TABLE training_resources(id TEXT PRIMARY KEY,name TEXT);
 INSERT INTO device_access VALUES('t1','Chưa phân công');
 INSERT INTO training_resources VALUES('class1','Lớp 1');
 `);
 sqlite.exec(migration.replace(/^--.*$/gm,"").replaceAll("--> statement-breakpoint",""));
 const db={
  prepare(sql){return {bind(...args){const stmt=sqlite.prepare(sql);return {
   async run(){const r=stmt.run(...args);return {meta:{changes:r.changes,last_row_id:Number(r.lastInsertRowid)}};},
   async all(){return {results:stmt.all(...args)};},
   async first(){return stmt.get(...args)??null;}
  };}};},
  async batch(stmts){
   sqlite.exec("BEGIN");
   try{const results=[];for(const s of stmts)results.push(await s.run());sqlite.exec("COMMIT");return results;}
   catch(error){sqlite.exec("ROLLBACK");throw error;}
  }
 };
 const board={from:"2030-06-06T00:00:00Z",to:"2030-06-07T00:00:00Z",observedAt:when,
  resources:[{id:"class1",kind:"class",name:"Lớp 1",status:"active",capacity:20,requiredTeachers:1,learnerCount:3,teacherCount:0,version:1}],
  people:[{id:"t1",role:"teacher",className:"Chưa phân công",status:"approved",registered:true,expired:false}],
  sessions:[]};
 const proposal={id:"teacher:class1:t1",kind:"teacher",personId:"t1",classId:"class1",
  priority:"medium",suggestedRole:"teacher-alternative"};
 let actorRole="manager",truncated=false;
 class DeviceAccessError extends Error{constructor(message,status,code){super(message);this.status=status;this.code=code;}}
 const mocks={
  "../../device-auth.server":{
   DeviceAccessError,deviceErrorResponse:(error)=>Response.json({error:error.message},{status:error.status??403}),
   verifyDeviceRequest:async()=>({deviceId:"manager1",personRole:actorRole})
  },
  "../../training-management.server":{
   requireManager:actor=>{if(actor.personRole!=="manager")throw new DeviceAccessError("role",403,"ROLE");},
   trainingCommand:async()=>{throw new Error("Review and approve must never call apply.");},
   trainingBoard:async()=>board,
   trainingDatabase:async()=>db,
   trainingWindow:payload=>({from:payload.from,to:payload.to})
  },
  "../../manager-ai-allocation-v42":{
   buildAllocationReview:()=>({teacherShortlist:[proposal],learnerShortlist:[],sourceMayBeTruncated:truncated})
  },
  "../../training-types":{
   classNames:s=>s.split(/[;,\n]+/).map(x=>x.trim()).filter(Boolean),
   classKey:s=>s.trim().replace(/[A-Z]/g,c=>c.toLowerCase())
  }
 };
 const exports={};
 const runtimeModule={exports};
 new Function("require","module","exports",js)((name)=>mocks[name]??require(name),runtimeModule,exports);
 const post=async(action,{commandId,expectedRevision=0,reason="Đã đối chiếu lịch và chứng từ.",proposalId=proposal.id}={})=>{
  const payload={action,commandId,expectedRevision,reason,proposalId,from:board.from,to:board.to};
  const res=await runtimeModule.exports.POST(new Request("https://example.org/api/training-ai-proposals",{
   method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)
  }));
  return {status:res.status,data:await res.json()};
 };
 return {sqlite,db,board,proposal,post,setRole:value=>{actorRole=value;},
   setTruncated:value=>{truncated=value;}};
}
test("real manager AI endpoint requires review before approval; audit and command-id dedupe",async t=>{
 const {sqlite,post}=fixture(t);
 let r=await post("approve",{commandId:"cmd_approve_0001",expectedRevision:0});
 assert.equal(r.status,409);
 r=await post("review",{commandId:"cmd_review_0001"});
 assert.equal(r.status,200);assert.equal(r.data.status,"reviewed");
 r=await post("review",{commandId:"cmd_review_0001"});
 assert.equal(r.status,200);assert.equal(r.data.replayed,true);
 r=await post("approve",{commandId:"cmd_approve_0002",expectedRevision:1});
 assert.equal(r.status,200);assert.equal(r.data.status,"approved");
 assert.equal(r.data.applied,false);
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM training_ai_proposal_commands").get().n,2);
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM training_ai_proposal_audit").get().n,2);
 assert.equal(sqlite.prepare("SELECT class_name AS name FROM device_access WHERE device_id='t1'").get().name,"Chưa phân công");
});
test("concurrent approval expectedRevision CAS, rejection and command replay collision fail closed",async t=>{
 const {post}=fixture(t);
 assert.equal((await post("review",{commandId:"cmd_review_0001"})).status,200);
 assert.equal((await post("approve",{commandId:"cmd_approve_0001",expectedRevision:1})).status,200);
 assert.equal((await post("approve",{commandId:"cmd_approve_0002",expectedRevision:1})).status,409);
 assert.equal((await post("reject",{commandId:"cmd_review_0001",expectedRevision:2})).status,409);
 assert.equal((await post("reject",{commandId:"cmd_reject_0002",expectedRevision:2})).status,409);
});
test("stale source fingerprint requires fresh review, never stale automatic approval",async t=>{
 const {board,post}=fixture(t);
 assert.equal((await post("review",{commandId:"cmd_review_0001"})).status,200);
 board.resources[0].learnerCount++;
 const r=await post("list");
 assert.equal(r.status,200);assert.equal(r.data.items[0].status,"stale");
 const stale=await post("approve",{commandId:"cmd_approve_0001",expectedRevision:1});
 assert.equal(stale.status,409);
 const revived=await post("review",{commandId:"cmd_review_0002",expectedRevision:1});
 assert.equal(revived.status,200);assert.equal(revived.data.revision,2);
});
test("unauthorized role, truncated evidence and malformed command cannot write",async t=>{
 const f=fixture(t);
 f.setRole("teacher");
 assert.equal((await f.post("review",{commandId:"cmd_review_0001"})).status,403);
 f.setRole("manager");f.setTruncated(true);
 assert.equal((await f.post("review",{commandId:"cmd_review_0001"})).status,409);
 f.setTruncated(false);
 assert.equal((await f.post("review",{commandId:"bad"})).status,400);
 assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM training_ai_proposals").get().n,0);
});
test("manager UI uses separately signed manager capability; approve opens existing human-confirmed assignment",()=>{
 assert.match(api,/await verifyDeviceRequest\(payload,false\)/);
 assert.match(api,/requireManager\(actor\)/);
 assert.match(api,/await trainingBoard\(from,to,actor\)/);
 assert.match(api,/if\(review\.sourceMayBeTruncated\)/);
 assert.match(panel,/api\/training-ai-proposals/);
 assert.match(panel,/if\(action==="approve"\)onReviewProposal/);
 assert.match(manager,/onReviewAllocation=\{reviewAllocation\} getProof=\{getProof\}/);
 assert.match(api,/if\(action==="apply"\)/);
 assert.match(api,/await trainingCommand\(actor,/);
 assert.equal((api.match(/await trainingCommand\(actor,/g)??[]).length,1,
  "Only the explicit apply branch can call the canonical class mutation");
 assert.match(panel,/data-ai-apply-confirm/);

});
