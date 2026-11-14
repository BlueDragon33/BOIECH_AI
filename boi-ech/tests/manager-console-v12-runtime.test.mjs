import assert from "node:assert/strict";
import test from "node:test";
import {person,setup,grant,resources} from "./helpers/training-fixture.mjs";

test("V12: cadre contact is a replaceable class descriptor, with CAS and real history",async()=>{
 const f=await setup();try{
  await grant(f);await resources(f);
  const base={action:"save-leader",classId:"class",slot:"cadre",source:"cadre",memberDeviceId:null,
    displayName:"Trần Văn Anh",birthDate:"1990-02-14",militaryRank:"Đại úy",battalion:"Tiểu đoàn 3"};
  const first=await f.call({...base,expectedVersion:0});
  assert.equal(first.status,200,JSON.stringify(first));
  const old=first.board.leaders.find(l=>l.classId==="class"&&l.slot==="cadre");
  assert.equal(old.displayName,base.displayName);
  assert.equal(old.version,1);
  assert.equal((await f.call({...base,displayName:"Phạm Văn Bình",expectedVersion:1})).status,200);
  const after=await f.call();
  assert.equal(after.board.leaders.find(l=>l.slot==="cadre").displayName,"Phạm Văn Bình");
  assert.equal(after.board.leaderHistory.find(h=>h.slot==="cadre").previousDisplayName,"Trần Văn Anh");
  assert.equal((await f.call({...base,expectedVersion:1})).status,409);
  assert.equal((await f.call({...base,source:"none",displayName:null,birthDate:null,militaryRank:null,battalion:null,expectedVersion:2})).status,200);
  assert.equal(f.sqlite.prepare("SELECT source FROM training_class_leaders WHERE class_id='class' AND slot='cadre'").get().source,"none");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM training_class_leader_history WHERE class_id='class' AND slot='cadre'").get().n,2);
  assert.equal((await f.call({...base,birthDate:"1990-02-31",expectedVersion:3})).status,400);
  assert.equal((await f.call({...base,memberDeviceId:f.manager.device.deviceId,expectedVersion:3})).status,400);
 }finally{f.sqlite.close();}
});

test("V12: student class leader can be chosen inside class or provisionally outside, never silently enrolled",async()=>{
 const f=await setup();try{
  await grant(f);await resources(f);
  const inside=await person(f,"learner",501,"A");
  const outside=await person(f,"learner",502,"Other");
  const base={action:"save-leader",classId:"class",slot:"student",birthDate:null,militaryRank:null,battalion:null};
  const selected=await f.call({...base,source:"class",memberDeviceId:inside.device.deviceId,
    displayName:"Học viên trong lớp",expectedVersion:0});
  assert.equal(selected.status,200,JSON.stringify(selected));
  const mismatch=await f.call({...base,source:"class",memberDeviceId:outside.device.deviceId,
    displayName:"Sai lớp",expectedVersion:1});
  assert.equal(mismatch.status,409);
  const provisional=await f.call({...base,source:"outside",memberDeviceId:outside.device.deviceId,
    displayName:"Học viên ngoài lớp",expectedVersion:1});
  assert.equal(provisional.status,200,JSON.stringify(provisional));
  assert.equal(provisional.board.leaders.find(l=>l.slot==="student").source,"outside");
  assert.equal(f.sqlite.prepare("SELECT class_name FROM device_access WHERE device_id=?").get(outside.device.deviceId).class_name,"Other");
  assert.equal(provisional.board.resources.find(r=>r.id==="class").learnerCount,1);
  const candidate=await f.call({...base,source:"outside",memberDeviceId:null,
    displayName:"Hồ sơ khách chưa có tài khoản",expectedVersion:2});
  assert.equal(candidate.status,200);
  assert.equal(candidate.board.leaders.find(l=>l.slot==="student").source,"outside");
  const restored=await f.call({...base,source:"class",memberDeviceId:inside.device.deviceId,
    displayName:"Học viên trong lớp",expectedVersion:3});
  assert.equal(restored.status,200);
  const forbidden=await f.call({action:"assign-person",personId:inside.device.deviceId,
    expectedClassName:"A",classIds:[]});
  assert.equal(forbidden.status,409,"a class leader cannot be silently transferred out");
  const cleared=await f.call({...base,source:"none",memberDeviceId:null,displayName:null,expectedVersion:4});
  assert.equal(cleared.status,200);
  assert.equal((await f.call({action:"assign-person",personId:inside.device.deviceId,
    expectedClassName:"A",classIds:[]})).status,200);
 }finally{f.sqlite.close();}
});

test("V12: assistant instructor and period labels are persisted, read back and conflicting slots rejected",async()=>{
 const f=await setup();try{
  await grant(f);await resources(f);
  const primary=await person(f,"teacher",503,"A");
  const assistant=await person(f,"teacher",504,"A");
  for(const period of [{number:1,startTime:"09:00",endTime:"09:45"},
                      {number:2,startTime:"09:45",endTime:"10:30"}]){
    const result=await f.call({action:"save-period",...period,timezone:"Etc/UTC",expectedVersion:0});
    assert.equal(result.status,200,JSON.stringify(result));
  }
  const data={action:"save-session",id:"session-v12",title:"Bơi ếch",classId:"class",roomId:"room",
    teacherId:primary.device.deviceId,assistantTeacherId:assistant.device.deviceId,
    periodStart:1,periodEnd:2,startsAt:"2030-01-01T09:00:00Z",endsAt:"2030-01-01T10:00:00Z",
    status:"scheduled",expectedVersion:0};
  const result=await f.call(data);
  assert.equal(result.status,200,JSON.stringify(result));
  const session=result.board.sessions.find(s=>s.id==="session-v12");
  assert.equal(session.assistantTeacherId,assistant.device.deviceId);
  assert.equal(session.periodStart,1);assert.equal(session.periodEnd,2);
  assert.equal(result.board.people.find(p=>p.id===assistant.device.deviceId).bookingCount,1);
  assert.equal((await f.call({...data,id:"same-teacher",assistantTeacherId:primary.device.deviceId})).status,400);
  assert.equal((await f.call({...data,id:"no-period",periodStart:14,periodEnd:15})).status,400);
  assert.equal((await f.call({action:"assign-person",personId:assistant.device.deviceId,
    classIds:[],expectedClassName:"A"})).status,409);
 }finally{f.sqlite.close();}
});

test("V12: unprivileged learner cannot create leaders or teaching periods",async()=>{
 const f=await setup();try{
  await grant(f);await resources(f);
  const learner=await person(f,"learner",505,"A");
  const request={action:"save-leader",classId:"class",slot:"cadre",source:"cadre",displayName:"Không có quyền",
    birthDate:"1990-01-01",militaryRank:"Đại úy",battalion:"1",expectedVersion:0};
  assert.equal((await f.call(request,learner)).status,403);
  assert.equal((await f.call({action:"save-period",number:1,startTime:"09:00",endTime:"09:45",
    timezone:"Etc/UTC",expectedVersion:0},learner)).status,403);
 }finally{f.sqlite.close();}
});
