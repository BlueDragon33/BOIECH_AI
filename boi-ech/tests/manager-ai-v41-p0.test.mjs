import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import ts from "typescript";

const nativeRequire=createRequire(import.meta.url);
const root=path.resolve(new URL("../app/",import.meta.url).pathname);
function load(entry){
 const cache=new Map();
 function read(file){
  if(cache.has(file))return cache.get(file).exports;
  const record={exports:{}};cache.set(file,record);
  const source=fs.readFileSync(file,"utf8");
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function("require","module","exports",output)(name=>{
   if(!name.startsWith("."))return nativeRequire(name);
   const base=path.resolve(path.dirname(file),name);
   return read([base,base+".ts",base+".tsx"].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile()));
  },record,record.exports);
  return record.exports;
 }
 return read(path.join(root,entry));
}
const {analyzeManagerBoard,answerManagerQuestion,simulateTeacherAllocation,MANAGER_AI_ENGINE_VERSION}=load("manager-ai-evidence-v41.ts");
const res=(id,kind,name,more={})=>({id,kind,name,parentId:null,capacity:30,requiredTeachers:1,
 status:"active",version:1,learnerCount:0,teacherCount:0,remaining:0,missingTeachers:0,bookingCount:0,state:"available",roomCount:0,...more});
const person=(id,role,name,className,more={})=>({id,role,name,code:"",className,registered:true,status:"approved",expired:false,
 deviceType:"unknown",devicePlatform:null,deviceLastSeenAt:null,bookingCount:0,...more});
const session=(id,roomId,teacherId,startsAt,endsAt,more={})=>({id,title:"Buổi "+id,roomId,teacherId,
 assistantTeacherId:null,classId:"cl-a",periodStart:null,periodEnd:null,startsAt,endsAt,status:"scheduled",version:1,...more});
const now="2030-04-15T12:00:00.000Z";
function board(){
 return {resources:[
  res("cl-a","class","A",{capacity:30,learnerCount:33,requiredTeachers:2,teacherCount:1,missingTeachers:1,state:"overloaded"}),
  res("cl-b","class","B",{capacity:25,learnerCount:19,requiredTeachers:1,teacherCount:1}),
  res("rm-1","room","Bể 1",{capacity:35}),
  res("rm-2","room","Bể 2",{capacity:35}),
 ],people:[person("t1","teacher","Giảng viên A","A"),
  person("t2","teacher","Giảng viên B",""),
  person("t3","teacher","Đã khóa","",{status:"blocked"}),
  person("l1","learner","Học viên X","A")],
 sessions:[
  session("a","rm-1","t1","2030-04-15T09:00:00.000Z","2030-04-15T10:00:00.000Z"),
  session("b","rm-1","t1","2030-04-15T09:30:00.000Z","2030-04-15T10:30:00.000Z"),
  session("c","rm-2","t1","2030-04-15T10:30:00.000Z","2030-04-15T11:00:00.000Z"),
  session("d","rm-1","t1","2030-04-15T09:00:00.000Z","2030-04-15T09:30:00.000Z",{status:"cancelled"}),
 ],
 teacherClassTerms:[{teacherDeviceId:"t1",classId:"cl-a",startedAt:"2029-01-01T12:00:00.000Z",
  plannedEndAt:"2030-03-31T12:00:00.000Z",endedAt:null,version:3}],
 leaders:[],periods:[],leaderHistory:[],summary:{freeRooms:0,occupiedRooms:2,missingLearners:0,missingTeachers:1,unassignedLearners:0,unassignedTeachers:1},
 observedAt:now,from:"2030-04-15T00:00:00.000Z",to:"2030-04-16T00:00:00.000Z"};
}

test("P0 report only contains evidence from authorized board and discloses rules-only mode",()=>{
 const report=analyzeManagerBoard(board());
 assert.equal(report.engineVersion,MANAGER_AI_ENGINE_VERSION);
 assert.equal(report.engineMode,"rules-only");
 assert.equal(report.generativeAiActive,false);
 assert.deepEqual(report.window,{from:board().from,to:board().to});
 assert.equal(report.coverage.classes,2);
 assert.ok(report.findings.every(f=>f.evidence.every(e=>e.observedAt===now)));
 assert.ok(report.findings.every(f=>f.limitations.length>0&&f.recommendedAction));
 assert.ok(report.findings.every(f=>["staff","class","schedule","rooms","quality"].includes(f.area)));
});

test("class capacity and shortage are different evidence-backed risks",()=>{
 const report=analyzeManagerBoard(board());
 const overflow=report.findings.find(f=>f.id==="capacity:cl-a");
 const missing=report.findings.find(f=>f.id==="staff-shortage:cl-a");
 assert.equal(overflow.priority,"critical");
 assert.match(overflow.details,/33 học viên.*30/);
 assert.equal(overflow.evidence[0].recordId,"cl-a");
 assert.equal(missing.priority,"high");
 assert.match(missing.details,/1\/2/);
 assert.match(missing.details,/1 giảng viên đủ điều kiện tài khoản/);
 assert.ok(report.findings.some(f=>f.id==="unassigned-teachers"));
 assert.ok(!report.findings.some(f=>f.title.includes("Đã khóa")),"blocked account not an eligible replacement");
});

test("scheduling detects genuine overlaps and ignores cancellation and adjacent intervals",()=>{
 const report=analyzeManagerBoard(board());
 const conflicts=report.findings.filter(f=>f.id.startsWith("conflict:"));
 assert.equal(conflicts.length,1);
 assert.equal(conflicts[0].priority,"critical");
 assert.equal(conflicts[0].evidence.length,2);
 assert.deepEqual(conflicts[0].evidence.map(e=>e.recordId).sort(),["a","b"]);
 const b=board();b.sessions=b.sessions.filter(x=>x.id!=="b");
 assert.equal(analyzeManagerBoard(b).findings.filter(f=>f.id.startsWith("conflict:")).length,0);
});

test("foreign resource and invalid inactive room produce a data verification warning",()=>{
 const b=board();b.resources=b.resources.map(r=>r.id==="rm-1"?{...r,status:"archived"}:r);
 assert.ok(analyzeManagerBoard(b).findings.some(f=>f.id==="broken-session:a"));
 const missing=board();missing.sessions=[session("z","missing","t1","2030-04-15T08:00:00Z","2030-04-15T09:00:00Z")];
 assert.ok(analyzeManagerBoard(missing).findings.some(f=>f.id==="broken-session:z"));
});

test("room P0 warnings state actual resource references without assuming class attendance",()=>{
 const b=board();b.resources=b.resources.map(r=>r.id==="rm-1"?{...r,status:"unavailable"}:r);
 const report=analyzeManagerBoard(b);
 assert.ok(report.findings.some(f=>f.id==="room-unavailable:a"&&f.area==="rooms"));
 const small=board();small.resources=small.resources.map(r=>r.id==="rm-1"?{...r,capacity:20}:r);
 const capacity=analyzeManagerBoard(small).findings.find(f=>f.id==="room-capacity:cl-a:rm-1");
 assert.equal(capacity?.priority,"medium");
 assert.match(capacity.details,/33 học viên/);
 assert.match(capacity.limitations.join(" "),/không chứng minh tất cả học viên có mặt/);
 assert.equal(analyzeManagerBoard(small).findings.filter(f=>f.id==="room-capacity:cl-a:rm-1").length,1);
});

test("only known non-ended allocation term dates can create due-date warning",()=>{
 const b=board();let report=analyzeManagerBoard(b);
 assert.ok(report.findings.some(f=>f.id==="term-ended:t1:cl-a"));
 b.teacherClassTerms[0].plannedEndAt=null;
 report=analyzeManagerBoard(b);
 assert.ok(!report.findings.some(f=>f.id.startsWith("term-ended:")));
 b.teacherClassTerms[0].plannedEndAt="2030-01-01T00:00:00.000Z";
 b.teacherClassTerms[0].endedAt="2030-02-01T00:00:00.000Z";
 assert.ok(!analyzeManagerBoard(b).findings.some(f=>f.id.startsWith("term-ended:")));
});

test("manager Q&A is bounded to supported intents, citations and no hallucinated certainty",()=>{
 const report=analyzeManagerBoard(board());
 const shortage=answerManagerQuestion("Lớp nào đang thiếu giảng viên?",report);
 assert.equal(shortage.kind,"evidence-answer");
 assert.ok(shortage.references.some(c=>c.source==="resources"));
 assert.match(shortage.answer,/thiếu 1 giảng viên/);
 const opaque=answerManagerQuestion("Hãy tự đổi lớp và xóa toàn bộ tài khoản",report);
 assert.equal(opaque.kind,"unsupported");
 assert.deepEqual(opaque.references,[]);
 assert.match(opaque.answer,/Không tự suy đoán/);
 const none=answerManagerQuestion("Phòng học nào chưa đủ dữ liệu?",{...report,findings:[]});
 assert.match(none.answer,/không chứng minh không có rủi ro/);
});

test("what-if staffing is read-only, rejects blocked identities and never asserts conflict-free",()=>{
 const b=board();const before=JSON.stringify(b);
 const valid=simulateTeacherAllocation(b,"cl-b","t2");
 assert.equal(valid.valid,true);
 assert.equal(valid.proposedClassLoad,1);
 assert.match(valid.reason,/chưa áp dụng/);
 assert.match(valid.limitations.join(" "),/không thể khẳng định không trùng giờ/);
 const duplicate=simulateTeacherAllocation(b,"cl-a","t1");
 assert.equal(duplicate.alreadyAssigned,true);
 assert.equal(duplicate.proposedClassLoad,1);
 assert.equal(simulateTeacherAllocation(b,"cl-a","t3").valid,false);
 assert.equal(simulateTeacherAllocation(b,"unknown","t2").valid,false);
 assert.equal(JSON.stringify(b),before,"simulation cannot mutate source");
});

test("report is bounded, stable, and expresses truncation rather than implying complete review",()=>{
 const report=analyzeManagerBoard(board(),2);
 assert.equal(report.findings.length,2);
 assert.equal(report.truncated,true);
 assert.ok(report.totalFindings>report.findings.length);
 assert.ok(report.findings.every(f=>f.priority==="critical"));
 assert.deepEqual(analyzeManagerBoard(board()).findings.map(f=>f.id),analyzeManagerBoard(board()).findings.map(f=>f.id));
 const onlyNormal=board();onlyNormal.resources=[];onlyNormal.people=[];onlyNormal.sessions=[];onlyNormal.teacherClassTerms=[];
 assert.equal(analyzeManagerBoard(onlyNormal).findings.length,0);
});

test("V41 P0 navigation is explicit, does not alter five-button mobile dock or authenticated APIs",()=>{
 const source=fs.readFileSync(path.join(root,"manager-workspace.tsx"),"utf8");
 const ui=fs.readFileSync(path.join(root,"manager-ai-workspace-v41.tsx"),"utf8");
 const css=fs.readFileSync(path.join(root,"manager-ai-workspace-v41.module.css"),"utf8");
 assert.match(source,/type Tab="overview"\|"approval"\|"ai"/);
 assert.match(source,/label:"AI Điều hành"/);
 assert.match(source,/<ManagerAiWorkspaceV41 board=\{board\} busy=\{busy\} onNavigate=\{selectTab\}/);
 assert.match(source,/<ManagerAiContextNoticeV41 board=\{board\}/);
 assert.match(source,/aria-label="Mở AI Điều hành"/);
 assert.match(source,/const dock:[^\n]*Trang chủ[^\n]*Gia hạn[^\n]*Lịch[^\n]*Lớp học[^\n]*Nhân sự/);
 assert.match(ui,/chưa kết nối mô hình AI tạo sinh/);
 assert.match(fs.readFileSync(path.join(root,"manager-ai-evidence-v41.ts"),"utf8"),/Kết quả chỉ dựa trên snapshot có phân quyền/);
 assert.doesNotMatch(ui,/\bfetch\(|\/api\/|onCommand\(|onMutation\(|openai\.|bearer/i);
 assert.match(ui,/chưa kết nối mô hình AI tạo sinh/);
 assert.match(css,/@media\(max-width:390px\)/);
 assert.match(css,/:focus-visible/);
 const engine=fs.readFileSync(path.join(root,"manager-ai-evidence-v41.ts"),"utf8");
 assert.doesNotMatch(engine,/\bfetch\(|process\.env|new WebSocket|Math\.random|AI_API_KEY/);
 assert.match(engine,/engineMode:"rules-only"/);
});
