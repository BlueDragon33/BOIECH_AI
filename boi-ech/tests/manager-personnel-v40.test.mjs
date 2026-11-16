import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {person,setup,grant,resources} from "./helpers/training-fixture.mjs";

const read=p=>readFileSync(new URL("../app/"+p,import.meta.url),"utf8");
const ui=read("manager-personnel-v40.tsx");
const shell=read("manager-console-v12.tsx");
const css=read("manager-personnel-v40.module.css");
const server=read("training-management.server.ts");
const types=read("training-types.ts");

test("Manager V40 mount uses real teacher board, verified device type and no mock personnel",()=>{
 assert.match(shell,/<ManagerPersonnelV40 board=\{board\} busy=\{busy\}/);
 assert.match(ui,/board\.people\.filter\(p=>p\.role==="teacher"\)/);
 assert.match(ui,/teacherClassTerms\?\?\[\]/);
 assert.match(ui,/const unmatched=names\.filter/);
 assert.match(ui,/const assigned=classes\.filter/);
 assert.match(ui,/deviceLabel/);
 assert.match(ui,/Chưa ghi nhận/);
 assert.match(ui,/Máy tính \/ laptop/);
 assert.match(ui,/không phải xác nhận phần cứng hoặc thiết bị đang online/);
 assert.doesNotMatch(ui,/Math\.random\(|fakeData|mockTeachers|deviceOnline|isOnline/);
 assert.match(types,/teacherClassTerms:TrainingTeacherClassTerm\[\]/);
 assert.match(server,/device_type_override/);
 assert.match(server,/deviceLastSeenAt/);
});
test("V40 personnel filters, multi-class sorting and preview-safe empty state",()=>{
 assert.match(ui,/sort==="classes-desc"/);
 assert.match(ui,/sort==="started-new"/);
 assert.match(ui,/category==="multiple"/);
 assert.match(ui,/category==="unassigned"/);
 assert.match(ui,/category==="needs-review"/);
 assert.match(ui,/device!=="all"/);
 assert.match(ui,/startFrom\|\|startTo/);
 assert.match(ui,/Không có giảng viên khớp bộ lọc/);
 assert.match(css,/\.metrics\{display:grid/);
 assert.match(css,/@media\(max-width:1080px\)/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/:focus-visible/);
});
test("V40 stores manually verified per-class dates; does not infer historic allocation date",async()=>{
 const f=await setup();try{
  await grant(f);await resources(f);
  const p=await person(f,"teacher",811,"A");
  const original=await f.call();
  assert.equal(original.status,200,JSON.stringify(original));
  const teacher=original.board.people.find(x=>x.id===p.device.deviceId);
  assert.equal(teacher.deviceType,"desktop");
  assert.equal(original.board.teacherClassTerms.some(x=>x.teacherDeviceId===p.device.deviceId),false,
    "existing register/legacy class assignment must have no made-up first date");
  const base={action:"save-teacher-class-term",teacherDeviceId:p.device.deviceId,classId:"class",
    startedAt:"2030-02-01T10:00:00Z",plannedEndAt:"2030-10-31T10:00:00Z"};
  const inserted=await f.call({...base,expectedVersion:0});
  assert.equal(inserted.status,200,JSON.stringify(inserted));
  const term=inserted.board.teacherClassTerms.find(x=>x.teacherDeviceId===p.device.deviceId&&x.classId==="class");
  assert.equal(term?.startedAt,new Date(base.startedAt).toISOString());
  assert.equal(term?.plannedEndAt,new Date(base.plannedEndAt).toISOString());
  assert.equal(term?.version,1);
  const update=await f.call({...base,plannedEndAt:"2030-11-30T10:00:00Z",expectedVersion:1});
  assert.equal(update.status,200,JSON.stringify(update));
  assert.equal((await f.call({...base,expectedVersion:1})).status,409,"CAS must fail on outdated term");
  assert.equal((await f.call({...base,startedAt:"2030-12-01T10:00:00Z",expectedVersion:2})).status,400,"end before start cannot be stored");
  const outsider=await person(f,"teacher",812,"Other");
  assert.equal((await f.call({...base,teacherDeviceId:outsider.device.deviceId,expectedVersion:0})).status,409,"no metadata permission for class not assigned");
  f.sqlite.prepare("UPDATE device_access SET device_type='tablet',platform='Android' WHERE device_id=?").run(p.device.deviceId);
  const readBack=await f.call();
  const updatedTeacher=readBack.board.people.find(x=>x.id===p.device.deviceId);
  assert.equal(updatedTeacher.deviceType,"tablet");
  assert.equal(updatedTeacher.devicePlatform,"Android");
  assert.ok(updatedTeacher.deviceLastSeenAt);
 }finally{f.sqlite.close();}
});
test("V40 migration automatically timestamps only post-migration manager class allocations",async()=>{
 const f=await setup();try{
  await grant(f);await resources(f);
  assert.equal((await f.call({action:"save-resource",id:"other-class",kind:"class",name:"B",
   capacity:10,requiredTeachers:1,status:"active",expectedVersion:0})).status,200);
  const p=await person(f,"teacher",813,"A");
  const move=await f.call({action:"assign-person",personId:p.device.deviceId,expectedClassName:"A",
   classIds:["class","other-class"]});
  assert.equal(move.status,200,JSON.stringify(move));
  const registered=move.board.teacherClassTerms.find(x=>x.teacherDeviceId===p.device.deviceId&&x.classId==="other-class");
  assert.ok(registered?.startedAt,"new assignment must record actual update instant");
  const removed=await f.call({action:"assign-person",personId:p.device.deviceId,expectedClassName:"A; B",classIds:["class"]});
  assert.equal(removed.status,200,JSON.stringify(removed));
  assert.ok(!removed.board.teacherClassTerms.some(x=>x.teacherDeviceId===p.device.deviceId&&x.classId==="other-class"),
    "removed class is not shown as active assignment");
 }finally{f.sqlite.close();}
});
