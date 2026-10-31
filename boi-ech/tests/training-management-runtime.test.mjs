import assert from 'node:assert/strict';
import test from 'node:test';
import { proof } from './helpers/device-auth-fixture.mjs';
import { api,person,setup,grant,resources } from './helpers/training-fixture.mjs';

test('registration offers manager identity without self-granting global management rights',async()=>{
 const f=await setup();try {
  assert.equal(f.manager.device.personRole,'manager'); assert.equal(f.manager.device.managementEnabled,false);
  assert.equal((await f.call()).status,403);
  const learner=await person(f,'learner',102); assert.equal((await f.call({action:'list'},learner)).status,403);
  const publisher=await api(f,'control/management-access','publisher').POST(new Request('https://boi.test/api/control/management-access',{method:'POST',body:JSON.stringify({deviceId:f.manager.device.deviceId,enabled:true,expectedPersonCode:'TEST101'})})); assert.equal(publisher.status,403);
  await grant(f); assert.equal((await f.call()).status,200);
  const changed=await f.post({action:'save-registration',...await proof(f,f.manager.key,f.manager.device.deviceId),learnerFamilyName:'Kiểm',learnerGivenName:'Thử',personRole:'learner',personCode:'TEST101',className:'A',phone:'0900000101'});
  assert.equal(changed.device.managementEnabled,false); assert.equal((await f.call()).status,403);
 }finally{f.sqlite.close();}
});

test('canonical assignments, real capacity counts, version conflicts and idempotent receipts',async()=>{
 const f=await setup();try {
  await grant(f);await resources(f);
  const teacher=await person(f,'teacher',103,'Other'); const learner=await person(f,'learner',104,'Other');
  const assign=await f.call({action:'assign-person',personId:teacher.device.deviceId,classIds:['class'],expectedClassName:'Other'});assert.equal(assign.status,200,JSON.stringify(assign));
  assert.equal(f.sqlite.prepare('SELECT class_name FROM device_access WHERE device_id=?').get(teacher.device.deviceId).class_name,'A');
  const command={action:'assign-person',personId:learner.device.deviceId,classIds:['class'],expectedClassName:'Other'};const id=crypto.randomUUID();
  assert.equal((await f.call(command,f.manager,id)).status,200);assert.equal((await f.call(command,f.manager,id)).status,200);
  assert.equal((await f.call({...command,classIds:[]},f.manager,id)).status,409);
  const board=await f.call();const cls=board.board.resources.find(r=>r.id==='class');assert.equal(cls.learnerCount,1);assert.equal(cls.remaining,1);assert.equal(cls.missingTeachers,0);
  assert.equal((await f.call({action:'save-resource',id:'class',kind:'class',name:'A',capacity:3,status:'active',requiredTeachers:1,expectedVersion:0})).status,409);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM training_commands WHERE command_id=?").get(id).count,1);
  assert.ok(!('phone' in board.board.people[0]));
 }finally{f.sqlite.close();}
});

test('scheduling rejects overlaps atomically, accepts adjacency and releases cancelled occupancy',async()=>{
 const f=await setup();try {
  await grant(f); await resources(f); const teacher=await person(f,'teacher',105);
  const session={action:'save-session',id:'session-one',title:'Bơi ếch',classId:'class',roomId:'room',teacherId:teacher.device.deviceId,startsAt:'2030-01-01T09:00:00Z',endsAt:'2030-01-01T10:00:00Z',status:'scheduled',expectedVersion:0};
  assert.equal((await f.call(session)).status,200);
  assert.equal((await f.call({...session,id:'session-two',startsAt:'2030-01-01T09:30:00Z'})).status,409);
  assert.equal((await f.call({...session,id:'session-three',startsAt:'2030-01-01T10:00:00Z',endsAt:'2030-01-01T11:00:00Z'})).status,200);
  assert.throws(()=>f.sqlite.prepare("INSERT INTO training_sessions(id,title,class_id,room_id,teacher_id,starts_at,ends_at,status,version) VALUES ('racing','Race','class','room',?,'2030-01-01T09:30:00.000Z','2030-01-01T10:30:00.000Z','scheduled',1)").run(teacher.device.deviceId),/TRAINING_CONFLICT/);
  assert.equal((await f.call({...session,status:'cancelled',expectedVersion:1})).status,200);
  const room=(await f.call()).board.resources.find(r=>r.id==='room');assert.equal(room.bookingCount,0);
 }finally{f.sqlite.close();}
});

test('capacity, unavailable buildings, expired staff and stale assignments cannot create invalid schedules',async()=>{
 const f=await setup();try{
  await grant(f);await resources(f);const teacher=await person(f,'teacher',106);
  await person(f,'learner',107);await person(f,'learner',108);
  const session={action:'save-session',id:'session',title:'Lớp',classId:'class',roomId:'room',teacherId:teacher.device.deviceId,startsAt:'2030-01-01T09:00:00Z',endsAt:'2030-01-01T10:00:00Z',status:'scheduled',expectedVersion:0};
  assert.equal((await f.call(session)).status,200);
  assert.equal((await f.call({action:'save-resource',id:'room',kind:'room',name:'P101',parentId:'building',capacity:1,status:'active',expectedVersion:1})).status,409);
  assert.equal((await f.call({action:'save-resource',id:'building',kind:'building',name:'Tòa A',capacity:1,status:'unavailable',expectedVersion:1})).status,409);
  assert.equal((await f.call({action:'assign-person',personId:teacher.device.deviceId,classIds:[],expectedClassName:'A'})).status,409);
  f.sqlite.prepare("UPDATE device_access SET access_expires_at='2000-01-01T00:00:00Z' WHERE device_id=?").run(teacher.device.deviceId);
  assert.equal((await f.call({...session,id:'expired',startsAt:'2030-01-01T11:00:00Z',endsAt:'2030-01-01T12:00:00Z'})).status,409);
  f.sqlite.prepare('UPDATE device_access SET management_enabled=0 WHERE device_id=?').run(f.manager.device.deviceId);
  assert.equal((await f.call()).status,403);
 }finally{f.sqlite.close();}
});

test('student availability follows scheduled classes and class fullness follows actual headcount',async()=>{
 const f=await setup();try{
  await grant(f);await resources(f);const teacher=await person(f,'teacher',111);const learner=await person(f,'learner',112);
  const result=await f.call({action:'save-session',id:'honest-state',title:'Bơi',classId:'class',roomId:'room',teacherId:teacher.device.deviceId,startsAt:'2030-01-01T09:00:00Z',endsAt:'2030-01-01T10:00:00Z',status:'scheduled',expectedVersion:0});
  assert.equal(result.status,200);assert.equal(result.board.people.find(p=>p.id===learner.device.deviceId).bookingCount,1);
  assert.equal(result.board.resources.find(r=>r.id==='class').state,'available');
 }finally{f.sqlite.close();}
});

test('every identity writer clears manager permission, including role changes away and back',async()=>{
 const f=await setup();try{
  await grant(f);
  f.sqlite.prepare("UPDATE device_access SET person_role='learner' WHERE device_id=?").run(f.manager.device.deviceId);
  f.sqlite.prepare("UPDATE device_access SET person_role='manager' WHERE device_id=?").run(f.manager.device.deviceId);
  assert.equal((await f.call()).status,403);
 }finally{f.sqlite.close();}
});

test('invalid calendar dates, midnight overflow and non-object requests fail before allocations',async()=>{
 const f=await setup();try{
  await grant(f);
  for(const [from,to] of [['2030-02-31T09:00:00Z','2030-03-04T10:00:00Z'],['2030-01-01T24:00:00Z','2030-01-02T10:00:00Z']])assert.equal((await f.call({action:'list',from,to})).status,400);
  const response=await api(f).POST(new Request('https://boi.test/api/training-management',{method:'POST',body:'null'}));assert.equal(response.status,400);
 }finally{f.sqlite.close();}
});

test('activation, renewal and unblock cannot overfill a class with an accepted room booking',async()=>{
 const f=await setup();try{
  await grant(f);await resources(f);const teacher=await person(f,'teacher',120);const first=await person(f,'learner',121);await person(f,'learner',122);
  assert.equal((await f.call({action:'save-session',id:'capacity-activation',title:'A',classId:'class',roomId:'room',teacherId:teacher.device.deviceId,startsAt:'2030-01-01T09:00:00Z',endsAt:'2030-01-01T10:00:00Z',status:'scheduled',expectedVersion:0})).status,200);
  const third=await person(f,'learner',123);assert.equal(third.device.status,'pending','registration remains usable, while class capacity defers automatic admission');
  const deferred=f.sqlite.prepare("SELECT detail_json FROM course_audit_log WHERE target=? AND action='learning_device_auto_confirmation_deferred' ORDER BY id DESC LIMIT 1").get(third.device.deviceId);assert.equal(JSON.parse(deferred.detail_json).reason,'class_capacity_reached');
  f.sqlite.prepare("UPDATE device_access SET class_name=NULL,status='approved' WHERE device_id=?").run(third.device.deviceId);
  assert.throws(()=>f.sqlite.prepare("UPDATE device_access SET class_name='A' WHERE device_id=?").run(third.device.deviceId),/TRAINING_CAPACITY/);
  f.sqlite.prepare("UPDATE device_access SET class_name='A',status='pending' WHERE device_id=?").run(third.device.deviceId);
  const activate=id=>f.sqlite.prepare("UPDATE device_access SET status='approved' WHERE device_id=?").run(id);
  assert.throws(()=>activate(third.device.deviceId),/TRAINING_CAPACITY/);
  f.sqlite.prepare("UPDATE device_access SET status='blocked' WHERE device_id=?").run(first.device.deviceId);activate(third.device.deviceId);
  assert.throws(()=>activate(first.device.deviceId),/TRAINING_CAPACITY/);
  f.sqlite.prepare("UPDATE device_access SET access_expires_at='2000-01-01T00:00:00Z' WHERE device_id=?").run(third.device.deviceId);activate(first.device.deviceId);
  assert.throws(()=>f.sqlite.prepare('UPDATE device_access SET access_expires_at=NULL WHERE device_id=?').run(third.device.deviceId),/TRAINING_CAPACITY/);
  assert.equal((await f.call()).board.resources.find(r=>r.id==='class').learnerCount,2);
 }finally{f.sqlite.close();}
});

test('renaming a class cannot orphan comma/newline teacher assignments or confuse internal spaces',async()=>{
 const f=await setup();try{
  await grant(f);await resources(f);f.sqlite.prepare('UPDATE device_access SET class_name=? WHERE device_id=?').run('Unit',f.manager.device.deviceId);await person(f,'teacher',124,'A, B');
  assert.equal((await f.call({action:'save-resource',id:'class',kind:'class',name:'Renamed',capacity:2,status:'active',requiredTeachers:1,expectedVersion:1})).status,409);
  assert.equal((await f.call()).board.resources.find(r=>r.id==='class').teacherCount,1);
  for(const [id,name] of [['spaced','A B'],['compact','AB']])assert.equal((await f.call({action:'save-resource',id,kind:'class',name,capacity:2,status:'active',requiredTeachers:1,expectedVersion:0})).status,200);
  await person(f,'teacher',127,'A B, Other');
  assert.equal((await f.call({action:'save-resource',id:'compact',kind:'class',name:'Compact renamed',capacity:2,status:'active',requiredTeachers:1,expectedVersion:1})).status,200);
  assert.equal((await f.call({action:'save-resource',id:'spaced',kind:'class',name:'Spaced renamed',capacity:2,status:'active',requiredTeachers:1,expectedVersion:1})).status,409);
 }finally{f.sqlite.close();}
});

test('a bounded board aggregates large directories without repeated class scans',async t=>{
 const f=await setup();try{
  await grant(f);const db=f.sqlite;
  db.exec("INSERT INTO training_resources(id,kind,name,capacity,status) VALUES ('building','building','Building',1,'active'),('class','class','ZZZ-PERF',5000,'active'); INSERT INTO training_resources(id,kind,name,parent_id,capacity,status) VALUES ('room','room','Room','building',5000,'active')");
  const teacher=await person(f,'teacher',125,'ZZZ-PERF');
  db.exec('BEGIN');
  const addRoom=db.prepare("INSERT INTO training_resources(id,kind,name,parent_id,capacity,status) VALUES (?,'room',?,'building',5000,'active')");
  for(let i=0;i<997;i++)addRoom.run('room-'+i,'Room-'+String(i).padStart(4,'0'));
  const addLearner=db.prepare("INSERT INTO device_access(device_id,display_code,public_key_jwk,status,learner_name,person_role,person_code,class_name,registration_submitted_at) VALUES (?,?,'{}','approved',?,'learner',?,'ZZZ-PERF',CURRENT_TIMESTAMP)");
  for(let i=0;i<949;i++)addLearner.run(i.toString(16).padStart(64,'0'),'BE-PERF-'+i,'Perf-'+i,'PERF-'+i);
  const addSession=db.prepare("INSERT INTO training_sessions(id,title,class_id,room_id,teacher_id,starts_at,ends_at,status) VALUES (?,'Perf','class','room',?,?,?,'scheduled')");
  const start=Date.parse('2030-01-01T00:00:00Z');
  for(let i=0;i<1000;i++)addSession.run('slot-'+i,teacher.device.deviceId,new Date(start+i*1800000).toISOString(),new Date(start+(i+1)*1800000).toISOString());
  db.exec('COMMIT');let comparisons=0;
  const route=api(f,'training-management','owner',()=>{if(++comparisons>50000)throw new Error('Class lookup budget exceeded');});
  const started=performance.now();
  const response=await route.POST(new Request('https://boi.test/api/training-management',{method:'POST',body:JSON.stringify({...await proof(f,f.manager.key,f.manager.device.deviceId),action:'list',from:'2030-01-01T00:00:00Z',to:'2030-01-22T00:00:00Z'})}));
  assert.equal(response.status,200,'a supported board must not scan the full resource list per person/session');const {board}=await response.json();
  assert.equal(board.people.length,950);assert.equal(board.resources.length,1000);assert.equal(board.sessions.length,1000);assert.equal(board.resources.find(r=>r.id==='class').learnerCount,949);assert.equal(board.people.find(p=>p.role==='learner').bookingCount,1000);t.diagnostic(`Local SQLite board read: ${Math.round(performance.now()-started)}ms, ${comparisons} class comparisons`);
 }finally{f.sqlite.close();}
});
