import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {setup,grant,resources,api,person} from './helpers/training-fixture.mjs';
import {proof} from './helpers/device-auth-fixture.mjs';
const requireNative=createRequire(import.meta.url);
function load(file,fetch,react=React){const cache=new Map();function read(file){if(cache.has(file))return cache.get(file).exports;const record={exports:{}};cache.set(file,record);const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','module','exports','fetch',output)(name=>name==='react'?react:name.endsWith('.css')?{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})}:name.startsWith('.')?read(path.resolve(path.dirname(file),name+(name.endsWith('client')||name.endsWith('types')?'.ts':'.tsx'))):requireNative(name),record,record.exports,fetch);return record.exports;}return read(path.resolve(file));}

test('registration presents exactly the three requested choices in order and marks manager selection',()=>{
 const {RegistrationRoles}=load('app/registration-roles.tsx');
 const html=renderToStaticMarkup(React.createElement(RegistrationRoles,{value:'manager',onChange:()=>{}}));
 assert.equal((html.match(/type="radio"/g)||[]).length,3);
 assert.ok(html.indexOf('Học viên')<html.indexOf('Cán bộ quản lý'));assert.ok(html.indexOf('Cán bộ quản lý')<html.indexOf('Giảng viên'));
 assert.match(html.match(/<input[^>]*value="manager"[^>]*>/)[0],/checked=""/);assert.match(html,/quản trị/);
});

test('real client uses fresh signed proofs, keeps a command after lost reply, and reads actual counts',async()=>{
 const f=await setup();try{
  await grant(f);await resources(f);await person(f,'learner',110);
  let lost=true;let commands=[];
  const fetch=async(url,options)=>{assert.equal(url,'/api/training-management');const body=JSON.parse(options.body);commands.push(body.commandId);const response=await api(f).POST(new Request('https://boi-ech.boiech-ai.workers.dev'+url,{method:'POST',body:options.body}));if(body.action!=='list'&&lost){lost=false;throw new TypeError('reply lost');}return response;};
  const {createTrainingClient}=load('app/training-client.ts',fetch);const client=createTrainingClient(()=>proof(f,f.manager.key,f.manager.device.deviceId));
  const window={from:'2030-01-01T09:00:00Z',to:'2030-01-01T10:00:00Z'};
  const command={action:'save-resource',id:'second-room',kind:'room',name:'P102',parentId:'building',capacity:20,status:'active',expectedVersion:0};
  await assert.rejects(client.mutate(command,window),/reply lost|kết nối/i);
  const board=await client.mutate(command,window);assert.equal(commands[0],commands[1]);assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM training_resources WHERE id='second-room'").get().n,1);
  assert.equal(board.summary.freeRooms,2);assert.equal(board.resources.find(r=>r.id==='class').remaining,1);
  const {TrainingDashboard}=load('app/manager-workspace.tsx',fetch);
  for(const tab of ['overview','schedule','people','class','room','building']){
   const html=renderToStaticMarkup(React.createElement(TrainingDashboard,{board,tab,setTab:()=>{},busy:false,notice:'',onCommand:async()=>false,onWindowChange:()=>{}}));
   assert.match(html,/Cán bộ quản lý/);assert.match(html,/data-tone=/);assert.ok(!html.includes('0900000110'));
  }
 }finally{f.sqlite.close();}
});


test('aborted older reads cannot replace a newer allocation view',async()=>{
 let complete;const body=new Promise(resolve=>{complete=resolve;});
 const {createTrainingClient}=load('app/training-client.ts',async()=>({ok:true,json:()=>body}));
 const client=createTrainingClient(async()=>({deviceId:'test',challenge:'test',signature:'test'}));const controller=new AbortController();
 const pending=client.read({from:'2030-01-01T09:00:00Z',to:'2030-01-01T10:00:00Z'},controller.signal);
 await new Promise(resolve=>setImmediate(resolve));controller.abort();complete({board:{observedAt:'stale'}});
 await assert.rejects(pending,/hủy|thời gian/i);
});

function elements(node){if(Array.isArray(node))return node.flatMap(elements);if(!node||typeof node!=='object')return[];return[node,...elements(node.props?.children)];}
function content(node){if(Array.isArray(node))return node.map(content).join('');if(node===null||node===undefined)return'';if(typeof node!=='object')return String(node);return content(node.props?.children);}
function dashboardHarness(props){const values=[];let cursor=0;const hooks={...React,useState(initial){const index=cursor++;if(!(index in values))values[index]=typeof initial==='function'?initial():initial;return[values[index],next=>{values[index]=typeof next==='function'?next(values[index]):next;}];}};const {TrainingDashboard}=load('app/manager-workspace.tsx',async()=>{},hooks);return()=>{cursor=0;return elements(TrainingDashboard(props));};}

test('a scheduled session can be cancelled after its teacher expires and class is archived',async()=>{
 const teacher={id:'teacher',name:'Teacher',code:'SQ1',role:'teacher',className:'A',status:'approved',expired:true,registered:true,bookingCount:1};
 const session={id:'session',title:'Old',classId:'class',roomId:'room',teacherId:'teacher',startsAt:'2030-01-01T09:00:00Z',endsAt:'2030-01-01T10:00:00Z',status:'scheduled',version:1};
 const board={from:session.startsAt,to:session.endsAt,observedAt:session.startsAt,resources:[{id:'class',kind:'class',name:'A',status:'archived',capacity:20,learnerCount:0},{id:'room',kind:'room',name:'P1',status:'active',capacity:20,state:'full'}],people:[teacher],sessions:[session],summary:{}};
 let saved;const render=dashboardHarness({board,tab:'schedule',setTab:()=>{},busy:false,notice:'',onCommand:async payload=>{saved=payload;return true;},onWindowChange:()=>{}});
 render().find(node=>node.type==='button'&&content(node)==='Đổi lịch / trạng thái').props.onClick();
 let tree=render();assert.ok(tree.some(node=>node.type==='option'&&node.props.value==='teacher'),'retain an expired current teacher so cancelling does not fail required-field validation');assert.ok(tree.some(node=>node.type==='option'&&node.props.value==='class'));
 const status=tree.find(node=>node.type==='label'&&content(node).startsWith('Trạng thái')).props.children[1];status.props.onChange({target:{value:'cancelled'}});
 tree=render();tree.filter(node=>node.type==='form').at(-1).props.onSubmit({preventDefault(){}});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(saved.status,'cancelled');assert.equal(saved.teacherId,'teacher');
});

test('allocation failures are announced as errors with a distinct visible state',()=>{
 const {TrainingDashboard}=load('app/manager-workspace.tsx');const from='2030-01-01T09:00:00Z';
 const html=renderToStaticMarkup(React.createElement(TrainingDashboard,{board:{from,to:'2030-01-01T10:00:00Z',observedAt:from,people:[],resources:[],sessions:[],summary:{}},tab:'overview',setTab:()=>{},busy:false,notice:'Trùng lịch phòng',noticeError:true,onCommand:async()=>false,onWindowChange:()=>{}}));
 assert.match(html,/<p[^>]*role="alert"[^>]*>Trùng lịch phòng/);
});


test('an acknowledged assignment starts a fresh command when deliberately requested again',async()=>{
 const f=await setup();try{
  await grant(f);await resources(f);await f.call({action:'save-resource',id:'other-class',kind:'class',name:'Other',capacity:10,requiredTeachers:1,status:'active',expectedVersion:0});const learner=await person(f,'learner',126,'Other');
  const {createTrainingClient}=load('app/training-client.ts',async(url,init)=>api(f).POST(new Request('https://boi.test'+url,{method:'POST',body:init.body})));
  const client=createTrainingClient(()=>proof(f,f.manager.key,f.manager.device.deviceId));const range={from:'2030-01-01T09:00:00Z',to:'2030-01-01T10:00:00Z'};
  const change={action:'assign-person',personId:learner.device.deviceId,classIds:['class'],expectedClassName:'Other'};
  await client.mutate(change,range);
  assert.equal((await f.call({action:'assign-person',personId:learner.device.deviceId,classIds:['other-class'],expectedClassName:'A'})).status,200);
  await client.mutate(change,range);
  assert.equal(f.sqlite.prepare('SELECT class_name FROM device_access WHERE device_id=?').get(learner.device.deviceId).class_name,'A','a new deliberate assignment must not reuse an old applied receipt');
 }finally{f.sqlite.close();}
});
