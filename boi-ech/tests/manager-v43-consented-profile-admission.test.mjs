import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {createRequire} from "node:module";
import {DatabaseSync} from "node:sqlite";
import ts from "typescript";

const require=createRequire(import.meta.url);
const source=readFileSync(resolve("app/training-ai-profile-data.server.ts"),"utf8");
const api=readFileSync(resolve("app/api/training-ai-profiles/route.ts"),"utf8");
const schema=readFileSync(resolve("drizzle/0045_training_ai_consented_profiles.sql"),"utf8");
const boardSource=readFileSync(resolve("app/training-management.server.ts"),"utf8");
const mgrSource=readFileSync(resolve("app/manager-ai-allocation-v42.ts"),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const dataModule={exports:{}};
new Function("require","module","exports",compiled)((name)=>require(name),dataModule,dataModule.exports);
const data=dataModule.exports;
const future=new Date(Date.now()+20*86400000).toISOString();
const afterWeek=new Date(Date.now()+7*86400000).toISOString();
const start=new Date(Date.now()+2*86400000).toISOString();
const end=new Date(Date.now()+2*86400000+3600000).toISOString();
const certifiedTeacher={certificates:[{code:"BREAST-COACH",validUntil:future}],
 available:[{startsAt:start,endsAt:end}],absences:[],maxActiveClasses:2};
const classSafe={requiredCertification:"BREAST-COACH",requiredLevel:"beginner",
 trainingWindows:[{startsAt:start,endsAt:end}],poolSafetyApproved:true,trainerToLearnerLimit:15};
function fixture(t){
 const sqlite=new DatabaseSync(":memory:");
 t.after(()=>sqlite.close());
 sqlite.exec(`CREATE TABLE device_access(device_id TEXT PRIMARY KEY,role TEXT);
 CREATE TABLE training_resources(id TEXT PRIMARY KEY,kind TEXT,status TEXT);
 CREATE TABLE course_audit_log(actor TEXT,action TEXT,target TEXT,detail_json TEXT);
 INSERT INTO device_access VALUES('T1','teacher'),('L1','learner');
 INSERT INTO training_resources VALUES('C1','class','active');`);
 sqlite.exec(schema.replace(/^--.*$/gm,"").replaceAll("--> statement-breakpoint",""));
 const db={
  prepare(sql){
   const bind=(...args)=>{
    const stmt=sqlite.prepare(sql);
    return {
     async run(){const r=stmt.run(...args);return {meta:{changes:r.changes,last_row_id:Number(r.lastInsertRowid)}};},
     async all(){return {results:stmt.all(...args)};},
     async first(){return stmt.get(...args)??null;}
    };
   };
   return Object.assign(bind(),{bind});
  },
  async batch(prepared){
   sqlite.exec("BEGIN");try{const rows=[];for(const p of prepared)rows.push(await p.run());
    sqlite.exec("COMMIT");return rows;
   }catch(e){sqlite.exec("ROLLBACK");throw e;}
  }
 };
 let role="teacher",deviceId="T1",enabled=true;
 class DeviceAccessError extends Error{constructor(m,status,code){super(m);this.status=status;this.code=code;}}
 const board={from:start,to:end,
  people:[{id:"T1",role:"teacher",status:"approved",registered:true,expired:false},
   {id:"L1",role:"learner",status:"approved",registered:true,expired:false}],
  resources:[{id:"C1",kind:"class",status:"active"}]};
 const mocks={
  "../../device-auth.server":{
   DeviceAccessError,deviceErrorResponse:e=>Response.json({error:e.message},{status:e.status??403}),
   getCourseDatabase:async()=>db,
   verifyDeviceRequest:async()=>({deviceId,personRole:role,deviceCode:deviceId,status:"approved"})
  },
  "../../training-management.server":{
   requireManager:a=>{if(a.personRole!=="manager")throw new DeviceAccessError("Wrong role",403,"DENIED");},
   trainingBoard:async()=>board,trainingWindow:p=>({from:p.from,to:p.to})
  },
  "../../training-ai-profile-data.server":{
   ...data,profileAdmissionEnabled:async()=>enabled
  }
 };
 // Diagnostic is limited to the transient local test build; runtime API stays generic.
 const debugApi=api.replace('  if(error instanceof SyntaxError)return respond(', '  if(error instanceof SyntaxError)return respond(')
  .replace('  return respond({error:"Không thể xử lý hồ sơ bổ sung;', '  console.error("V43_PROFILE_TEST_CAUSE",error); return respond({error:"Không thể xử lý hồ sơ bổ sung;');
 const js=ts.transpileModule(debugApi,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const apiModule={exports:{}};
 new Function("require","module","exports",js)((name)=>mocks[name]??require(name),apiModule,apiModule.exports);
 const post=async(action,body={})=>{
  const res=await apiModule.exports.POST(new Request("https://example.org/api/training-ai-profiles",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({action,from:start,to:end,...body})
  }));
  return {status:res.status,data:await res.json()};
 };
 return {sqlite,db,post,as:(nextRole,id)=>{role=nextRole;deviceId=id;},enabled:v=>{enabled=v;}};
}
test("profile sources are disabled by default until explicit data-owner policy",async t=>{
 const f=fixture(t);f.enabled(false);
 assert.equal((await f.post("submit",{consent:true,expectedRevision:0,profile:certifiedTeacher})).status,409);
 assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM training_ai_profile_submissions").get().n,0);
 assert.match(source,/BOI_ECH_AI_PROFILE_ADMISSION/);
});
test("self-consented instructor profile is pending until signed manager verifies external source",async t=>{
 const f=fixture(t);
 const first=await f.post("submit",{consent:true,expectedRevision:0,profile:certifiedTeacher});
 assert.equal(first.status,200);assert.equal(first.data.status,"pending");
 assert.equal((await f.post("submit",{consent:true,expectedRevision:0,profile:certifiedTeacher})).status,409);
 f.as("manager","M1");
 const denied=await f.post("verify",{deviceId:"T1",expectedRevision:1,
 verificationReference:"bad",validUntil:future});
 assert.equal(denied.status,400);
 const verify=await f.post("verify",{deviceId:"T1",expectedRevision:1,
 verificationReference:"CERT-REV-001",validUntil:afterWeek});
 assert.equal(verify.status,200);
 const admitted=await f.post("manager-list");
 assert.equal(admitted.status,200);assert.equal(admitted.data.verified.teacher.length,1);
 assert.equal(admitted.data.verified.teacher[0].certificates[0].verified,true);
 assert.equal(admitted.data.verified.teacher[0].seal.consented,true);
 f.as("teacher","T1");
 const withdrawn=await f.post("withdraw",{expectedRevision:1});
 assert.equal(withdrawn.status,200);
 assert.equal(f.sqlite.prepare("SELECT payload_json AS p FROM training_ai_profile_submissions WHERE device_id='T1'").get().p,"{}");
 f.as("manager","M1");
 assert.equal((await f.post("manager-list")).data.verified.teacher.length,0);
});
test("learner's signed own profile cannot impersonate another teacher or manager verification",async t=>{
 const f=fixture(t);f.as("learner","L1");
 const r=await f.post("submit",{consent:true,expectedRevision:0,
  profile:{declaredLevel:"beginner",desiredWindows:[{startsAt:start,endsAt:end}]}});
 assert.equal(r.status,200);
 assert.equal((await f.post("verify",{deviceId:"L1",expectedRevision:1,
 verificationReference:"REF-LEARNER-0001",validUntil:future})).status,403);
 f.as("manager","M1");
 assert.equal((await f.post("verify",{deviceId:"L1",expectedRevision:1,
 verificationReference:"REF-LEARNER-0001",validUntil:afterWeek})).status,200);
 assert.equal((await f.post("manager-list")).data.verified.learner.length,1);
});
test("human attested safety is versioned and requires source, manager role and validated pool constraints",async t=>{
 const f=fixture(t);f.as("manager","M1");
 assert.equal((await f.post("attest-class",{classId:"C1",profile:{...classSafe,poolSafetyApproved:false},
  expectedRevision:0,verificationReference:"POOL-SAFETY-REF1",validUntil:afterWeek})).status,400);
 const first=await f.post("attest-class",{classId:"C1",profile:classSafe,
  expectedRevision:0,verificationReference:"POOL-SAFETY-REF1",validUntil:afterWeek});
 assert.equal(first.status,200);
 assert.equal((await f.post("attest-class",{classId:"C1",profile:classSafe,
  expectedRevision:0,verificationReference:"POOL-SAFETY-REF1",validUntil:afterWeek})).status,409);
 assert.equal((await f.post("manager-list")).data.verified.safety.length,1);
});
test("manager allocation only uses admitted sources when feature active; server approval denies missing eligibility",()=>{
 assert.match(boardSource,/if\(await profileAdmissionEnabled\(\)\)/);
 assert.match(boardSource,/readManagerProfileAdmission\(db,\{people:visiblePeople,resources\}\)/);
 assert.match(mgrSource,/assessProfilePlacement\(/);
 assert.match(mgrSource,/assessInstructorForClass\(/);
 assert.match(mgrSource,/admissible:!admission\|\|/);
 const decisions=readFileSync(resolve("app/api/training-ai-proposals/route.ts"),"utf8");
 assert.match(decisions,/AI_PROFILE_EVIDENCE_REQUIRED/);
});
