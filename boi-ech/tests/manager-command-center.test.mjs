import assert from "node:assert/strict";
import {createRequire} from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";

const nativeRequire=createRequire(import.meta.url);
function load(entry){
 const cache=new Map();
 function read(filename){
  if(cache.has(filename))return cache.get(filename).exports;
  const record={exports:{}};cache.set(filename,record);
  const output=ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  new Function("require","module","exports",output)(name=>{
   if(name.endsWith(".css"))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
   if(!name.startsWith("."))return nativeRequire(name);
   const base=path.resolve(path.dirname(filename),name);
   return read([base,base+".ts",base+".tsx"].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile()));
  },record,record.exports);
  return record.exports;
 }
 return read(path.resolve(entry));
}
const module=load("app/manager-command-center.tsx");
const {sessionsInWindow,classesInRoom,roomHasNoBookings,roomNeedsAttention}=module;
const resource={id:"class-a",kind:"class",name:"Ếch cơ bản",parentId:null,capacity:20,requiredTeachers:1,status:"active",version:1,learnerCount:10,teacherCount:1,remaining:10,missingTeachers:0,bookingCount:1,state:"available",roomCount:0};
function board(){
 return {
  from:"2030-05-03T08:00:00.000Z",to:"2030-05-03T12:00:00.000Z",observedAt:"2030-05-03T07:55:00.000Z",
  resources:[{...resource,id:"building-1",kind:"building",name:"Tòa B",parentId:null,roomCount:1,remaining:0,state:"full"},{...resource,id:"room-1",kind:"room",name:"Hồ 25m",parentId:"building-1",capacity:30,roomCount:0,state:"full"},resource,{...resource,id:"class-b",name:"Ếch nâng cao"},{...resource,id:"other",name:"Lớp ngoài"}],
  people:[{id:"t1",role:"teacher",name:"HLV An",code:"T01",className:"Ếch cơ bản; Ếch nâng cao",registered:true,status:"approved",expired:false,bookingCount:2},{id:"l1",role:"learner",name:"Học viên mẫu",code:"L01",className:"Ếch cơ bản",registered:true,status:"approved",expired:false,bookingCount:1},{id:"l2",role:"learner",name:"Hồ sơ đang chờ",code:"L02",className:"",registered:true,status:"pending",expired:false,bookingCount:0}],
  sessions:[
   {id:"one",title:"Ca sáng",classId:"class-a",roomId:"room-1",teacherId:"t1",startsAt:"2030-05-03T08:00:00.000Z",endsAt:"2030-05-03T09:00:00.000Z",status:"scheduled",version:1},
   {id:"two",title:"Ca tiếp theo",classId:"class-b",roomId:"room-1",teacherId:"t1",startsAt:"2030-05-03T09:00:00.000Z",endsAt:"2030-05-03T10:00:00.000Z",status:"scheduled",version:1},
   {id:"cancelled",title:"Ca hủy",classId:"other",roomId:"room-1",teacherId:"t1",startsAt:"2030-05-03T10:00:00.000Z",endsAt:"2030-05-03T11:00:00.000Z",status:"cancelled",version:1},
   {id:"outside",title:"Ngoài khung giờ",classId:"other",roomId:"room-1",teacherId:"t1",startsAt:"2030-05-03T12:00:00.000Z",endsAt:"2030-05-03T13:00:00.000Z",status:"scheduled",version:1}
  ],
  summary:{freeRooms:0,occupiedRooms:1,missingLearners:0,missingTeachers:0,unassignedLearners:1,unassignedTeachers:0}
 };
}
test("room contains two scheduled classes in separate time slots, not cancelled or out-of-window",()=>{
 const b=board();
 assert.deepEqual(sessionsInWindow(b).map(s=>s.id),["one","two"]);
 assert.deepEqual(classesInRoom(b,"room-1").map(r=>r.id),["class-a","class-b"]);
});
test("exactly touching the time-window edge does not count as a booking",()=>{
 const b=board();b.sessions=[{...b.sessions[0],startsAt:"2030-05-03T07:00:00.000Z",endsAt:b.from},{...b.sessions[1],startsAt:b.to,endsAt:"2030-05-03T13:00:00.000Z"}];
 assert.deepEqual(sessionsInWindow(b),[]);
 assert.deepEqual(classesInRoom(b,"room-1"),[]);
});
test("invalid time window does not invent occupied rooms or assigned classes",()=>{
 const b=board();b.from="bad";
 assert.deepEqual(sessionsInWindow(b),[]);
 assert.deepEqual(classesInRoom(b,"room-1"),[]);
});
test("manager UI renders real hierarchy, multiple room classes and the pending queue",()=>{
 const b=board();const markup=renderToStaticMarkup(React.createElement(module.default,{board:b,busy:false,onNavigate:()=>{},onOpenDetail:()=>{},onAssignPerson:()=>{},onCreateResource:()=>{},onCreateSession:()=>{}}));
 for(const term of ["Tòa B","Hồ 25m","Ếch cơ bản","Ếch nâng cao","HLV An","Ca sáng","Ca tiếp theo","Hồ sơ cần xem","2 lớp"])assert.ok(markup.includes(term),term);
 assert.match(markup,/aria-label="Sơ đồ phân cấp tòa phòng lớp"/);
 assert.match(markup,/aria-pressed="true"/);
 assert.ok(!markup.includes("Lớp ngoài"));
 assert.ok(!markup.includes("PRIVATE-PHONE"));
});
test("empty building state offers real setup instead of showing fake map data",()=>{
 const b=board();b.resources=[];b.sessions=[];
 const markup=renderToStaticMarkup(React.createElement(module.default,{board:b,busy:false,onNavigate:()=>{},onOpenDetail:()=>{},onAssignPerson:()=>{},onCreateResource:()=>{},onCreateSession:()=>{}}));
 assert.ok(markup.includes("Chưa có tòa học"));
 assert.ok(markup.includes("Tạo tòa"));
 assert.ok(!markup.includes("Tòa A"));
});

test("attention filter includes scheduled teacher shortages and overflow, not unrelated classes",()=>{
 const b=board();
 assert.equal(roomNeedsAttention(b,"room-1"),false);
 b.resources=b.resources.map(r=>r.id==="class-a"?{...r,missingTeachers:1,state:"missing"}:r);
 assert.equal(roomNeedsAttention(b,"room-1"),true);
 b.resources=b.resources.map(r=>r.id==="class-a"?{...r,missingTeachers:0,state:"available"}:r.id==="class-b"?{...r,state:"overloaded"}:r);
 assert.equal(roomNeedsAttention(b,"room-1"),true);
 b.resources=b.resources.map(r=>r.id==="class-b"?{...r,state:"available"}:r.id==="other"?{...r,state:"overloaded"}:r);
 assert.equal(roomNeedsAttention(b,"room-1"),false,"cancelled/out-of-window class must not flag room");
});
test("attention filter includes inactive rooms, inactive scheduled classes and broken references",()=>{
 const b=board();
 b.resources=b.resources.map(r=>r.id==="room-1"?{...r,state:"inactive"}:r);
 assert.equal(roomNeedsAttention(b,"room-1"),true);
 b.resources=b.resources.map(r=>r.id==="room-1"?{...r,state:"full"}:r.id==="class-a"?{...r,status:"archived"}:r);
 assert.equal(roomNeedsAttention(b,"room-1"),true);
 b.resources=b.resources.filter(r=>r.id!=="class-a");
 assert.equal(roomNeedsAttention(b,"room-1"),true);
 assert.equal(roomNeedsAttention(b,"unknown-room"),false);
});
test("free-room filter requires valid window, active parent, and no booking",()=>{
 const b=board();
 assert.equal(roomHasNoBookings(b,"room-1"),false);
 b.sessions=[];
 assert.equal(roomHasNoBookings(b,"room-1"),true);
 b.from="invalid";
 assert.equal(roomHasNoBookings(b,"room-1"),false);
 b.from="2030-05-03T08:00:00.000Z";
 b.resources=b.resources.map(r=>r.id==="room-1"?{...r,state:"inactive"}:r);
 assert.equal(roomHasNoBookings(b,"room-1"),false);
 assert.equal(roomHasNoBookings(b,"unknown-room"),false);
});
