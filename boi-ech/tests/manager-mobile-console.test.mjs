import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const nativeRequire=createRequire(import.meta.url);
function load(entry,react=React){
 const cache=new Map();
 function read(file){
  if(cache.has(file))return cache.get(file).exports;
  const record={exports:{}};cache.set(file,record);
  const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',output)(name=>{
   if(name==='react')return react;
   if(name.endsWith('.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
   if(!name.startsWith('.'))return nativeRequire(name);
   const base=path.resolve(path.dirname(file),name);
   return read([base,base+'.ts',base+'.tsx'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile()));
  },record,record.exports);
  return record.exports;
 }
 return read(path.resolve(entry));
}
const person={id:'learner',name:'Học viên mẫu',code:'DEMO01',role:'learner',className:'A',status:'approved',expired:false,registered:true,bookingCount:0};
const resource={id:'class',kind:'class',name:'A',parentId:null,capacity:2,requiredTeachers:1,status:'active',version:7,learnerCount:3,teacherCount:0,remaining:0,missingTeachers:1,bookingCount:0,state:'overloaded',roomCount:0};
function board(){return {
 from:'2030-01-01T09:00:00Z',to:'2030-01-01T11:00:00Z',observedAt:'2030-01-01T08:55:00Z',
 resources:[resource,{...resource,id:'room',kind:'room',name:'P101',parentId:'building',capacity:30,learnerCount:0,missingTeachers:0,bookingCount:3,state:'full'},{...resource,id:'building',kind:'building',name:'Tòa A',roomCount:1,remaining:0,state:'full'}],
 people:[person,{...person,id:'teacher',name:'Giảng viên mẫu',code:'DEMO02',role:'teacher',className:'A; AA',bookingCount:2}],
 sessions:[
  {id:'one',title:'Buổi một',classId:'class',roomId:'room',teacherId:'teacher',startsAt:'2030-01-01T08:45:00Z',endsAt:'2030-01-01T09:30:00Z',status:'scheduled',version:1},
  {id:'two',title:'Buổi hai',classId:'class',roomId:'room',teacherId:'teacher',startsAt:'2030-01-01T09:15:00Z',endsAt:'2030-01-01T10:00:00Z',status:'scheduled',version:2},
  {id:'three',title:'Buổi ba',classId:'class',roomId:'room',teacherId:'teacher',startsAt:'2030-01-01T10:45:00Z',endsAt:'2030-01-01T11:30:00Z',status:'completed',version:3},
  {id:'cancelled',title:'Buổi đã hủy',classId:'class',roomId:'room',teacherId:'teacher',startsAt:'2030-01-01T09:00:00Z',endsAt:'2030-01-01T11:00:00Z',status:'cancelled',version:4},
 ],summary:{freeRooms:0,occupiedRooms:1,missingLearners:0,missingTeachers:1,unassignedLearners:0,unassignedTeachers:0},
};}
function statusModel(){try{return load('app/manager-status.tsx');}catch(error){if(error.code==='ENOENT')return {};throw error;}}

// These cases catch treating seat capacity/bookings as time occupancy, double-counting
// overlapping sessions, hiding overload, or calling blocked/expired people available.
test('room bar merges bookings, clips the selected window and ignores cancellation',()=>{
 const {roomOccupancy}=statusModel();assert.equal(typeof roomOccupancy,'function','room occupancy model is missing');
 assert.deepEqual(roomOccupancy('room',board()),{valid:true,totalMinutes:120,occupiedMinutes:75,freeMinutes:45,percent:62.5,bookingCount:3});
});
test('room bar leaves an unbooked room empty and does not count adjacent outside sessions',()=>{
 const {roomOccupancy}=statusModel();assert.equal(typeof roomOccupancy,'function');
 const b=board();b.sessions=[{...b.sessions[0],endsAt:b.from},{...b.sessions[1],startsAt:b.to,endsAt:'2030-01-01T12:00:00Z'}];
 assert.deepEqual(roomOccupancy('room',b),{valid:true,totalMinutes:120,occupiedMinutes:0,freeMinutes:120,percent:0,bookingCount:0});
});
test('invalid room window is explicitly unverified rather than reported free',()=>{
 const {roomOccupancy}=statusModel();assert.equal(typeof roomOccupancy,'function');
 const value=roomOccupancy('room',{...board(),to:'invalid'});assert.equal(value.valid,false);assert.equal(Number.isFinite(value.percent),true);
});
test('room occupancy supports valid intervals before the Unix epoch',()=>{
 const {roomOccupancy}=statusModel();assert.equal(typeof roomOccupancy,'function');
 const b=board();b.from='1960-01-01T09:00:00Z';b.to='1960-01-01T10:00:00Z';b.sessions=[{...b.sessions[0],startsAt:b.from,endsAt:b.to}];
 assert.equal(roomOccupancy('room',b).occupiedMinutes,60);
});
test('blocked and expired people never become available because they have no booking',()=>{
 const {personReadiness}=statusModel();assert.equal(typeof personReadiness,'function');
 const blocked=personReadiness({...person,status:'blocked',expired:true},board().resources);
 assert.equal(blocked.label,'Đã khóa');assert.equal(blocked.ready,false);
 assert.equal(personReadiness({...person,expired:true},board().resources).label,'Hết hạn');
 assert.equal(personReadiness({...person,registered:false},board().resources).label,'Chưa đủ hồ sơ');
 assert.equal(personReadiness({...person,status:'pending'},board().resources).label,'Chờ duyệt');
});
test('readiness distinguishes a missing class from a retained inactive class assignment',()=>{
 const {personReadiness}=statusModel();assert.equal(typeof personReadiness,'function');
 assert.equal(personReadiness({...person,className:'AA'},board().resources).label,'Chưa phân lớp');
 assert.equal(personReadiness(person,[{...resource,status:'archived'}]).label,'Lớp tạm ngừng');
 assert.equal(personReadiness(person,board().resources).stages.filter(s=>s.complete).length,4);
});
test('validity stage remains distinct from pending or blocked approval',()=>{
 const {personReadiness}=statusModel();
 for(const status of ['pending','blocked']){
  const state=personReadiness({...person,status},board().resources);
  assert.equal(state.stages.find(s=>s.label==='Duyệt').complete,false);
  assert.equal(state.stages.find(s=>s.label==='Còn hạn').complete,true);
 }
 assert.equal(personReadiness({...person,expired:true},board().resources).stages.find(s=>s.label==='Còn hạn').complete,false);
});
test('class bars expose actual overflow and missing teachers with valid accessible ranges',()=>{
 const {ResourceStatusBars}=statusModel();assert.equal(typeof ResourceStatusBars,'function');
 const html=renderToStaticMarkup(React.createElement(ResourceStatusBars,{resource,board:board()}));
 assert.match(html,/3\s*\/\s*2/);assert.match(html,/Vượt 1/);assert.match(html,/Thiếu 1 giảng viên/);
 assert.match(html,/role="progressbar"/);assert.match(html,/aria-valuenow="2"/);assert.match(html,/aria-valuemax="2"/);
 assert.ok(!html.includes('150%'));
});
test('person status strip names all registration stages without inventing learning progress',()=>{
 const {PersonStatusBar}=statusModel();assert.equal(typeof PersonStatusBar,'function');
 const html=renderToStaticMarkup(React.createElement(PersonStatusBar,{person,resources:board().resources}));
 for(const label of ['Hồ sơ','Duyệt','Còn hạn','Phân lớp'])assert.ok(html.includes(label));
 assert.ok(!/hoàn thành.*100%|tiến độ học/i.test(html));
});
test('display preferences reject malformed or unsupported persisted settings',()=>{
 const {parseDisplayPreferences}=statusModel();assert.equal(typeof parseDisplayPreferences,'function');
 for(const value of ['broken','null','[]','{"theme":"unknown","textSize":"tiny"}'])assert.deepEqual(parseDisplayPreferences(value),{theme:'system',textSize:'standard'});
 assert.deepEqual(parseDisplayPreferences('{"theme":"dark","textSize":"large","admin":true}'),{theme:'dark',textSize:'large'});
});

function elements(node){if(Array.isArray(node))return node.flatMap(elements);if(!node||typeof node!=='object')return [];return[node,...elements(node.props?.children)];}
function text(node){if(Array.isArray(node))return node.map(text).join('');if(node==null)return '';return typeof node==='object'?text(node.props?.children):String(node);}
function harness(props){const state=[];let cursor=0;const hooks={...React,useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];}};const {TrainingDashboard}=load('app/manager-workspace.tsx',hooks);return()=>{cursor=0;return elements(TrainingDashboard(props));};}
function props(extra={}){return {board:board(),tab:'overview',setTab:()=>{},busy:false,notice:'',onCommand:async()=>false,onWindowChange:()=>{},...extra};}
test('phone home launcher and bottom navigation reach rooms and settings without mutations',()=>{
 let selected;let writes=0;const render=harness(props({setTab:value=>{selected=value;},onCommand:async()=>{writes++;return true;}}));
 const tree=render();const nav=tree.find(n=>n.type==='nav'&&n.props['aria-label']==='Điều phối đào tạo');
 assert.ok(nav);const buttons=elements(nav).filter(n=>n.type==='button');assert.equal(buttons.length,5);
 const settings=buttons.find(n=>text(n).includes('Cài đặt'));assert.ok(settings);settings.props.onClick();assert.equal(selected,'settings');
 const room=tree.find(n=>n.type==='button'&&n.props['data-app']==='room');assert.ok(room);room.props.onClick();assert.equal(selected,'room');assert.equal(writes,0);
});
test('settings changes display preferences without emitting a training mutation',()=>{
 let appearance;let writes=0;const tree=harness(props({tab:'settings',appearance:{theme:'system',textSize:'large'},onAppearanceChange:next=>{appearance=next;},onCommand:async()=>{writes++;return true;}}))();
 const theme=tree.find(n=>n.type==='select'&&n.props['aria-label']==='Giao diện');assert.ok(theme);
 theme.props.onChange({target:{value:'dark'}});assert.deepEqual(appearance,{theme:'dark',textSize:'large'});assert.equal(writes,0);
});
test('the schedule time window can be collapsed and reopened',()=>{
 const render=harness(props({tab:'schedule'}));
 const toggle=()=>render().find(n=>n.type==='button'&&n.props['aria-expanded']!==undefined);
 assert.equal(toggle().props['aria-expanded'],true);toggle().props.onClick();assert.equal(toggle().props['aria-expanded'],false);
 toggle().props.onClick();assert.equal(toggle().props['aria-expanded'],true);
});
test('availability filter excludes unassigned and inactive-class people',()=>{
 const b=board();b.resources.push({...resource,id:'archived',name:'Old',status:'archived',state:'inactive'});
 b.people=[person,{...person,id:'unassigned',name:'Chưa phân lớp',className:''},{...person,id:'old',name:'Lớp cũ',className:'Old'}];
 const render=harness(props({board:b,tab:'people'}));
 render().find(n=>n.type==='select'&&elements(n).some(x=>x.type==='option'&&x.props.value==='available')).props.onChange({target:{value:'available'}});
 assert.deepEqual(render().filter(n=>n.type==='article').map(n=>text(n).includes('Học viên mẫu')), [true]);
});
test('setup offers the first active class after a building exists',()=>{
 let selected;const b=board();b.resources=b.resources.filter(r=>r.kind!=='class');
 const tree=harness(props({board:b,setTab:next=>{selected=next;}}))();
 const next=tree.find(n=>n.type==='button'&&text(n)==='Thiết lập lớp học');assert.ok(next);
 next.props.onClick();assert.equal(selected,'class');
});
test('replacing inactive memberships requires an explicit confirmation and keeps the CAS source',async()=>{
 const b=board();b.resources.push({...resource,id:'old',name:'Old',status:'archived',state:'inactive'});
 b.people=[{...person,id:'teacher',role:'teacher',className:'A; Old'}];const commands=[];
 const render=harness(props({board:b,tab:'people',onCommand:async payload=>{commands.push(payload);return true;}}));
 render().find(n=>n.type==='button'&&text(n)==='Phân công lớp').props.onClick();let tree=render();
 assert.ok(tree.some(n=>n.type==='p'&&text(n).includes('A; Old')));
 assert.equal(tree.find(n=>n.type==='button'&&text(n)==='Lưu phân công').props.disabled,true);
 tree.filter(n=>n.type==='form').at(-1).props.onSubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.equal(commands.length,0);
 const confirmation=tree.find(n=>n.type==='label'&&text(n).includes('Tôi xác nhận thay thế')).props.children.find(n=>n.type==='input');
 confirmation.props.onChange({target:{checked:true}});tree=render();
 assert.equal(tree.find(n=>n.type==='button'&&text(n)==='Lưu phân công').props.disabled,false);
 tree.filter(n=>n.type==='form').at(-1).props.onSubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));
 assert.equal(commands.length,1);assert.equal(commands[0].expectedClassName,'A; Old');assert.deepEqual(commands[0].classIds,['class']);
});
test('class detail uses canonical memberships and current source sessions, omitting unrelated fields',()=>{
 let module;try{module=load('app/manager-details.tsx');}catch(error){if(error.code!=='ENOENT')throw error;module={};}
 assert.equal(typeof module.ManagerDetailSheet,'function');const b=board();b.people.push({...person,id:'other',name:'Unrelated AA',className:'AA',phone:'PRIVATE-PHONE'});
 const html=renderToStaticMarkup(React.createElement(module.ManagerDetailSheet,{target:{kind:'resource',id:'class'},board:b,onClose:()=>{},onEditResource:()=>{},onAssignPerson:()=>{},onEditSession:()=>{}}));
 assert.match(html,/Học viên mẫu/);assert.match(html,/Giảng viên mẫu/);assert.match(html,/Buổi một/);assert.ok(!html.includes('Unrelated AA'));assert.ok(!html.includes('PRIVATE-PHONE'));
});
test('editing a resource keeps its optimistic version and preserves a rejected draft',async()=>{
 let sent;const render=harness(props({tab:'class',onCommand:async payload=>{sent=payload;return false;}}));
 render().find(n=>n.type==='button'&&text(n)==='Chỉnh sửa').props.onClick();let tree=render();
 const name=tree.find(n=>n.type==='input'&&n.props.maxLength===50);name.props.onChange({target:{value:'A sửa'}});
 tree=render();await tree.filter(n=>n.type==='form').at(-1).props.onSubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));
 assert.equal(sent.expectedVersion,7);assert.equal(sent.name,'A sửa');assert.equal(render().find(n=>n.type==='input'&&n.props.maxLength===50).props.value,'A sửa');
});
