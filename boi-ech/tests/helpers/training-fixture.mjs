import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fixture, identity, proof } from './device-auth-fixture.mjs';
export function api(f, endpoint = 'training-management', role = 'owner', onClassKey) {
  const root = path.resolve('app');
  const cache = new Map([[path.join(root, 'device-auth.server.ts'), { exports: f.auth }], [path.join(root, 'control-auth.server.ts'), { exports: { requireControlService: async () => ({ actor: 'test-owner', role }), controlResponse: (data,status=200) => Response.json(data,{status}), controlPreflight: () => new Response(null), withControlCors: (_req,response) => response } }]]);
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const record = { exports: {} }; cache.set(file, record);
    const output = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require','module','exports',output)(name => { assert.ok(name.startsWith('.')); return load(path.resolve(path.dirname(file),name+'.ts')); },record,record.exports);
    if (onClassKey && file.endsWith("training-types.ts")) { const original=record.exports.classKey; record.exports.classKey=value=>{onClassKey();return original(value);}; }
    return record.exports;
  }
  return load(path.join(root,'api',endpoint,'route.ts'));
}
export async function person(f, role, index, className='A') {
  const key = await identity();
  const {device} = await f.post({action:'register',publicKey:key.publicKey});
  const saved = await f.post({action:'save-registration',...await proof(f,key,device.deviceId),learnerFamilyName:'Kiểm',learnerGivenName:'Thử',personRole:role,personCode:'TEST'+index,className,phone:'090000'+String(index).padStart(4,'0')});
  assert.equal(saved.status,200,JSON.stringify(saved));
  return {key,device:saved.device};
}
export async function setup() {
  const f=fixture('managed',true); await f.auth.getCourseDatabase();
  f.sqlite.exec('UPDATE access_automation_settings SET auto_confirm_new_devices=1,default_device_limit=100');
  const manager=await person(f,'manager',101);
  return {...f,manager, async call(payload={action:'list'},p=manager,commandId=crypto.randomUUID()) {
    const response=await api(f).POST(new Request('https://boi-ech.boiech-ai.workers.dev/api/training-management',{method:'POST',body:JSON.stringify({...await proof(f,p.key,p.device.deviceId),from:'2030-01-01T09:00:00Z',to:'2030-01-01T10:00:00Z',commandId,...payload})}));
    return {status:response.status,...await response.json()};
  }};
}
export async function grant(f) {
  const response=await api(f,'control/management-access').POST(new Request('https://boi-ech.boiech-ai.workers.dev/api/control/management-access',{method:'POST',body:JSON.stringify({deviceId:f.manager.device.deviceId,expectedPersonCode:'TEST101',enabled:true})}));
  assert.equal(response.status,200,await response.clone().text());
}
export async function resources(f) {
  for (const resource of [{id:'building',kind:'building',name:'Tòa A',capacity:1},{id:'room',kind:'room',name:'P101',parentId:'building',capacity:2},{id:'class',kind:'class',name:'A',capacity:2,requiredTeachers:1}]) {
    const result=await f.call({action:'save-resource',...resource,status:'active',expectedVersion:0}); assert.equal(result.status,200,JSON.stringify(result));
  }
}

