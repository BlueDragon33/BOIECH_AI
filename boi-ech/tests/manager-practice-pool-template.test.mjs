import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";
import ts from "typescript";
import {setup,grant,resources,person} from "./helpers/training-fixture.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../app");
const read=(name)=>fs.readFileSync(path.join(root,name),"utf8");
function loadHelper(){
 const code=ts.transpileModule(read("manager-practice-pool.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const output={exports:{}};
 new Function("module","exports",code)(output,output.exports);
 return output.exports;
}

test("swimming template: stable exact identity, no unrelated building mistaken for the pool",()=>{
 const h=loadHelper();
 assert.equal(h.PRACTICE_POOL_BUILDING_NAME,"Tòa bể bơi");
 assert.equal(h.PRACTICE_POOL_ROOM_NAME,"Bể bơi thực hành");
 assert.equal(h.PRACTICE_POOL_DRAFT_CAPACITY,1);
 assert.equal(h.isPracticePoolBuilding({id:"building-a",kind:"building",name:"Tòa học A"}),false);
 assert.equal(h.isPracticePoolBuilding({id:h.PRACTICE_POOL_BUILDING_ID,kind:"building",name:"Tên đã đổi"}),true);
 assert.equal(h.isPracticePoolRoom({id:h.PRACTICE_POOL_ROOM_ID,kind:"room",name:"Bể tên mới"}),true);
 assert.equal(h.isPracticePoolRoom({id:"unrelated",kind:"class",name:"Bể bơi thực hành"}),false);
 const b={id:"existing-building",kind:"building",name:"Tòa bể bơi",parentId:null};
 const r={id:"existing-basin",kind:"room",name:"Bể bơi thực hành",parentId:b.id};
 assert.equal(h.existingPracticePoolBuilding([b]),b);
 assert.equal(h.existingPracticePoolRoom([r],b.id),r);
 assert.equal(h.existingPracticePoolRoom([r],"wrong"),undefined);
});

test("practice pool installed by authorized manager is persisted once, never schedulable before capacity confirmation",async()=>{
 const f=await setup();
 try{
  await grant(f);await resources(f);
  const h=loadHelper();
  const building={action:"save-resource",id:h.PRACTICE_POOL_BUILDING_ID,kind:"building",name:h.PRACTICE_POOL_BUILDING_NAME,
   parentId:"",capacity:1,status:"active",requiredTeachers:1,expectedVersion:0};
  const savedBuilding=await f.call(building);
  assert.equal(savedBuilding.status,200,JSON.stringify(savedBuilding));
  const pool={action:"save-resource",id:h.PRACTICE_POOL_ROOM_ID,kind:"room",name:h.PRACTICE_POOL_ROOM_NAME,
   parentId:building.id,capacity:h.PRACTICE_POOL_DRAFT_CAPACITY,status:"unavailable",requiredTeachers:1,expectedVersion:0};
  const savedPool=await f.call(pool);
  assert.equal(savedPool.status,200,JSON.stringify(savedPool));
  const poolResource=savedPool.board.resources.find(r=>r.id===pool.id);
  assert.equal(poolResource.parentId,building.id);
  assert.equal(poolResource.state,"inactive");
  assert.equal(savedPool.board.resources.filter(r=>r.name===h.PRACTICE_POOL_BUILDING_NAME).length,1);
  assert.equal(savedPool.board.resources.filter(r=>r.name===h.PRACTICE_POOL_ROOM_NAME).length,1);
  const duplicate=await f.call(pool);
  assert.equal(duplicate.status,409);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM training_resources WHERE id=?").get(pool.id).count,1);
  const teacher=await person(f,"teacher",960,"A");
  const schedule={action:"save-session",id:"pool-practice-session",title:"Buổi thực hành bơi ếch",classId:"class",roomId:pool.id,
   teacherId:teacher.device.deviceId,assistantTeacherId:null,periodStart:null,periodEnd:null,
   startsAt:"2030-01-01T09:00:00Z",endsAt:"2030-01-01T10:00:00Z",status:"scheduled",expectedVersion:0};
  assert.equal((await f.call(schedule)).status,409,"inactive pool must not accept a session");
  const openPool=await f.call({...pool,capacity:2,status:"active",expectedVersion:1});
  assert.equal(openPool.status,200,JSON.stringify(openPool));
  const scheduled=await f.call(schedule);
  assert.equal(scheduled.status,200,JSON.stringify(scheduled));
  assert.equal(scheduled.board.sessions.some(s=>s.roomId===pool.id),true);
 }finally{f.sqlite.close();}
});

test("pool UI: never fake persisted inventory or silently schedule an unconfigured basin",()=>{
 const workspace=read("manager-workspace.tsx");
 const studio=read("manager-building-studio.tsx");
 const overview=read("manager-command-center.tsx");
 const rooms=read("manager-console-v12.tsx");
 assert.match(workspace,/onInstallPoolTemplate=\{installPracticePoolTemplate\}/);
 assert.match(workspace,/async function installPracticePoolTemplate/);
 assert.match(workspace,/status:"unavailable",expectedVersion:0/);
 assert.match(workspace,/return await onCommand\(\{action:"save-resource",id:PRACTICE_POOL_ROOM_ID/);
 assert.match(studio,/Chưa thêm vào dữ liệu/);
 assert.match(studio,/Chờ xác nhận sức chứa/);
 assert.match(studio,/onInstallPoolTemplate\(\)/);
 assert.match(studio,/PracticePoolBasinArt/);
 assert.match(overview,/ManagerCampusMap/);
 assert.match(read("manager-campus-map.tsx"),/PracticePoolBuildingArt/);
 assert.match(rooms,/PracticePoolBuildingArt/);
 assert.match(rooms,/PracticePoolBasinArt/);
 assert.match(rooms,/disabled=\{busy\|\|r.status!=="active"\|\|b.status!=="active"\}/);
});
