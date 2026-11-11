import assert from "node:assert/strict";
import {createRequire} from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";

const nativeRequire=createRequire(import.meta.url);
function load(entry,react=React){
 const cache=new Map();
 function read(filename){
  if(cache.has(filename))return cache.get(filename).exports;
  const record={exports:{}};cache.set(filename,record);
  const output=ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  new Function("require","module","exports",output)(name=>{
   if(name==="react")return react;
   if(name.endsWith(".css"))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
   if(!name.startsWith("."))return nativeRequire(name);
   const base=path.resolve(path.dirname(filename),name);
   return read([base,base+".ts",base+".tsx"].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile()));
  },record,record.exports);
  return record.exports;
 }
 return read(path.resolve(entry));
}
const commandCenter=load("app/manager-command-center.tsx");
const {sessionsInWindow,classesInRoom,roomHasNoBookings,roomNeedsAttention}=commandCenter;
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
test("manager campus initially renders only real buildings and does not auto-expand hidden rooms",()=>{
 const markup=renderToStaticMarkup(React.createElement(commandCenter.default,{board:board(),busy:false,
  onNavigate:()=>{},onOpenDetail:()=>{},onAssignPerson:()=>{},onCreateResource:()=>{},onCreateSession:()=>{}}));
 assert.match(markup,/aria-label="Sơ đồ phân cấp cơ sở tương tác"/);
 assert.match(markup,/Tòa B/);
 assert.match(markup,/data-stage="buildings"/);
 assert.doesNotMatch(markup,/aria-label="Mở phòng Hồ 25m"/);
 assert.doesNotMatch(markup,/aria-label="Mở danh sách lớp Ếch cơ bản"/);
 assert.doesNotMatch(markup,/PRIVATE-PHONE/);
});
test("empty building state offers real setup instead of showing fake map data",()=>{
 const b=board();b.resources=[];b.sessions=[];
 const markup=renderToStaticMarkup(React.createElement(commandCenter.default,{board:b,busy:false,onNavigate:()=>{},onOpenDetail:()=>{},onAssignPerson:()=>{},onCreateResource:()=>{},onCreateSession:()=>{}}));
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

function elements(node){if(Array.isArray(node))return node.flatMap(elements);if(!node||typeof node!=="object")return [];return [node,...elements(node.props?.children)];}
function contentText(node){if(Array.isArray(node))return node.map(contentText).join("");if(node==null)return "";return typeof node==="object"?contentText(node.props?.children):String(node);}
function hookHarness(props){
 const state=[];let cursor=0;
 const hooks={...React,useState(initial){const slot=cursor++;if(!(slot in state))state[slot]=typeof initial==="function"?initial():initial;return [state[slot],next=>{state[slot]=typeof next==="function"?next(state[slot]):next;}] }};
 const Component=load("app/manager-command-center.tsx",hooks).default;
 return ()=>{cursor=0;return elements(Component(props));};
}
test("contextual room creation stays under the selected real building",()=>{
 const creations=[];const render=hookHarness({board:board(),busy:false,onNavigate:()=>{},onOpenDetail:()=>{},onAssignPerson:()=>{},
  onCreateResource:(...args)=>creations.push(args),onCreateSession:()=>{}});
 let tree=render();
 tree.find(node=>node.type==="button"&&node.props["aria-label"]==="Mở tòa Tòa B").props.onClick();
 tree=render();
 const addRoom=tree.find(node=>node.type==="button"&&contentText(node).includes("＋ Phòng"));
 assert.ok(addRoom);addRoom.props.onClick();
 assert.deepEqual(creations,[[ "room","building-1" ]]);
});
test("nested building→room→class retains real context for new class session",()=>{
 const sessions=[];const render=hookHarness({board:board(),busy:false,onNavigate:()=>{},onOpenDetail:()=>{},onAssignPerson:()=>{},
  onCreateResource:()=>{},onCreateSession:(...args)=>sessions.push(args)});
 let tree=render();
 tree.find(node=>node.props?.["aria-label"]==="Mở tòa Tòa B").props.onClick();tree=render();
 assert.ok(tree.find(node=>node.props?.["aria-label"]==="Mở phòng Hồ 25m"));
 tree.find(node=>node.props?.["aria-label"]==="Mở phòng Hồ 25m").props.onClick();tree=render();
 assert.ok(tree.find(node=>node.props?.["aria-label"]==="Mở danh sách lớp Ếch cơ bản"));
 const addCa=()=>tree.find(node=>node.type==="button"&&contentText(node).includes("＋ Thêm ca"));
 addCa().props.onClick();assert.deepEqual(sessions.pop(),["room-1",undefined]);
 tree.find(node=>node.props?.["aria-label"]==="Mở danh sách lớp Ếch nâng cao").props.onClick();
 tree=render();
 const popup=tree.find(node=>typeof node.type==="function"&&node.type.name==="ClassRosterDialog");
 assert.ok(popup,"class selection opens a dedicated popup component");
 assert.equal(popup.props.klass.id,"class-b");
 assert.deepEqual(popup.props.people.map(person=>person.id),["t1"],"only scoped people from real class");
 addCa().props.onClick();assert.deepEqual(sessions.pop(),["room-1","class-b"]);
});
test("manager workspace carries selected room and class into existing session editor",()=>{
 const render=workspaceHarness(workspaceProps());
 const center=render().find(node=>typeof node.type==="function"&&node.type.name==="ManagerCommandCenter");
 assert.ok(center,"live command center must be mounted in existing manager workspace");
 center.props.onCreateSession("room-1","class-b");
 const values=render().filter(node=>node.type==="select").map(node=>node.props.value);
 assert.ok(values.includes("room-1"),"room in selected diagram must prefill the actual session editor");
 assert.ok(values.includes("class-b"),"selected class must prefill the actual session editor");
});
test("manager workspace carries selected building into existing new-room editor",()=>{
 const render=workspaceHarness(workspaceProps());
 const center=render().find(node=>typeof node.type==="function"&&node.type.name==="ManagerCommandCenter");
 center.props.onCreateResource("room","building-1");
 const values=render().filter(node=>node.type==="select").map(node=>node.props.value);
 assert.ok(values.includes("building-1"),"selected building must prefill existing room editor");
});

test("a room alerts on overlapping training sessions, not adjacent distinct classes",()=>{
 const b=board();
 assert.equal(roomNeedsAttention(b,"room-1"),false,"adjacent classes do not collide");
 b.sessions[1]={...b.sessions[1],startsAt:"2030-05-03T08:30:00.000Z"};
 assert.equal(roomNeedsAttention(b,"room-1"),true,"overlap requires management attention");
 b.sessions[1]={...b.sessions[1],status:"cancelled"};
 assert.equal(roomNeedsAttention(b,"room-1"),false,"cancelled conflicts must not alert");
});

test("review shortcut opens dedicated manager-only approval tab without account writes",()=>{
 const props=workspaceProps();let writes=0;
 props.setTab=next=>{props.tab=next;};
 props.onCommand=async()=>{writes++;return false;};
 const render=workspaceHarness(props);
 const center=render().find(node=>typeof node.type==="function"&&node.type.name==="ManagerCommandCenter");
 assert.ok(center);center.props.onNavigate("review");
 assert.equal(props.tab,"approval");
 assert.equal(writes,0);
});
test("room sessions use chronological instants across timezone offsets without false conflicts",()=>{
 const b=board();
 b.sessions=[
  {...b.sessions[0],startsAt:"2030-05-03T10:00:00+02:00",endsAt:"2030-05-03T11:00:00+02:00"},
  {...b.sessions[1],startsAt:"2030-05-03T09:30:00Z",endsAt:"2030-05-03T10:30:00Z"},
 ];
 assert.deepEqual(sessionsInWindow(b).map(s=>s.id),["one","two"]);
 assert.equal(roomNeedsAttention(b,"room-1"),false,"disjoint instants must not be flagged as overlapping");
});

test("free rooms require an existing active building even when room state is stale",()=>{
 for(const status of ["unavailable","archived","missing"]){
  const b=board();b.sessions=[];
  b.resources=status==="missing"?b.resources.filter(r=>r.id!=="building-1"):b.resources.map(r=>r.id==="building-1"?{...r,status}:r);
  assert.equal(roomHasNoBookings(b,"room-1"),false,status);
  assert.equal(roomNeedsAttention(b,"room-1"),true,status);
 }
});

test("booked rooms flag an ineligible assigned coach even when the class has enough other staff",()=>{
 for(const change of [{expired:true},{status:"blocked"},{registered:false},{role:"learner"},{className:"Lớp ngoài"}]){
  const b=board();
  b.people.push({...b.people[0],id:"other-teacher",name:"HLV khác"});
  b.people=b.people.map(p=>p.id==="t1"?{...p,...change}:p);
  assert.equal(roomNeedsAttention(b,"room-1"),true,JSON.stringify(change));
 }
 const b=board();b.people=b.people.filter(p=>p.id!=="t1");
 assert.equal(roomNeedsAttention(b,"room-1"),true,"missing session coach reference");
});

test("changing building or room keeps nonselected siblings as compact icons inside the same campus",()=>{
 const b=board();
 b.resources.push({...b.resources[0],id:"building-2",name:"Tòa A"});
 b.resources.push({...b.resources[1],id:"room-2",name:"Hồ 50m",parentId:"building-1"});
 const render=hookHarness({board:b,busy:false,onNavigate:()=>{},onOpenDetail:()=>{},onAssignPerson:()=>{},
  onCreateResource:()=>{},onCreateSession:()=>{}});
 let tree=render();
 tree.find(node=>node.props?.["aria-label"]==="Mở tòa Tòa B").props.onClick();tree=render();
 assert.ok(tree.find(node=>node.props?.["aria-label"]==="Chuyển sang tòa Tòa A"),"other building remains available");
 tree.find(node=>node.props?.["aria-label"]==="Mở phòng Hồ 25m").props.onClick();tree=render();
 assert.ok(tree.find(node=>node.props?.["aria-label"]==="Chuyển sang phòng Hồ 50m"),"other room collapses, not disappears");
 tree.find(node=>node.props?.["aria-label"]==="Chuyển sang phòng Hồ 50m").props.onClick();tree=render();
 assert.ok(tree.find(node=>node.props?.["aria-label"]==="Chuyển sang phòng Hồ 25m"));
 const back=tree.find(node=>node.type==="button"&&contentText(node)==="← Tất cả phòng");
 assert.ok(back);back.props.onClick();tree=render();
 assert.ok(tree.find(node=>node.props?.["aria-label"]==="Mở phòng Hồ 25m"),"back restores room list");
 tree.find(node=>node.props?.["aria-label"]==="Chuyển sang tòa Tòa A").props.onClick();tree=render();
 assert.ok(tree.find(node=>node.props?.["aria-label"]==="Chuyển sang tòa Tòa B"),"building switching is reversible");
});

test("class popup uses a body portal and role-scoped roster, with no inline full-person list",()=>{
 const source=fs.readFileSync("app/manager-command-center.tsx","utf8");
 assert.match(source,/createPortal\(<div className=\{styles\.classModalBackdrop\}/);
 assert.match(source,/role="dialog" aria-modal="true"/);
 assert.match(source,/aria-label=\{`Danh sách học viên và giảng viên lớp/);
 assert.match(source,/teachers=people\.filter\(person=>person\.role==="teacher"\)/);
 assert.match(source,/learners=people\.filter\(person=>person\.role==="learner"\)/);
 assert.match(source,/onOpenDetail\(\{kind:"person",id:person\.id\}\)/);
 assert.doesNotMatch(source,/<div className=\{styles\.personIconGrid\}>/);
});

test("hierarchy CSS bounds icon rails and responsive grids within the campus frame",()=>{
 const css=fs.readFileSync("app/manager-command-center.module.css","utf8");
 for(const token of [".hierarchyWorkspace",".compactRail",".roomWorkspace",".focusedContent",".focusIconGrid",
  ".classModalBackdrop","overflow-x:auto","max-height:530px","@media(max-width:660px)"])
   assert.ok(css.includes(token),token);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\)!important/);
});
