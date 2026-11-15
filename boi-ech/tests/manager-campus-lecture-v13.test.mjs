import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";
import ts from "typescript";
import {setup,grant,resources} from "./helpers/training-fixture.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../app");
const src=(name)=>fs.readFileSync(path.join(root,name),"utf8");
function helper(){
 const code=ts.transpileModule(src("manager-lecture-hall.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};new Function("module","exports",code)(m,m.exports);return m.exports;
}
test("approved scene has one dominant lecture hall and exactly four named satellite slots",()=>{
 const map=src("manager-campus-map.tsx");
 const css=src("manager-campus-map.module.css");
 const art=src("manager-lecture-hall-art.tsx");
 assert.match(map,/main:\{key:"main",title:MAIN_LECTURE_HALL_NAME/);
 assert.match(map,/sub:\[a,b,pool,c\]/);
 assert.match(map,/MainLectureHallArt/);
 assert.match(map,/PracticePoolBuildingArt/);
 assert.match(map,/const assigned=new Set/);
 assert.match(map,/extra:buildings\.filter/);
 assert.ok(css.includes('grid-template-areas:"a main b" "pool main c"'));
 assert.ok(css.includes('grid-template-areas:"main main" "a b" "pool c"'));
 assert.match(css,/\.node\[data-node=main\] \.art\{[^}]*height:365px/);
 assert.match(css,/\.links\{/);
 assert.match(css,/:focus-visible/);
 assert.match(art,/viewBox="0 0 520 378"/);
 assert.match(art,/linearGradient/);
 assert.match(art,/M227 291/);
});
test("lecture hall identity matches existing named resource without manufacturing counts",()=>{
 const h=helper();
 assert.equal(h.MAIN_LECTURE_HALL_NAME,"Tòa giảng đường");
 assert.equal(h.MAIN_LECTURE_HALL_ID,"boiech_main_lecture_hall_v1");
 assert.equal(h.isMainLectureHall({kind:"room",id:h.MAIN_LECTURE_HALL_ID,name:"Tòa giảng đường"}),false);
 assert.equal(h.isMainLectureHall({kind:"building",id:"existing",name:"Tòa giảng đường"}),true);
 assert.equal(h.isMainLectureHall({kind:"building",id:"other",name:"Tòa học A"}),false);
 assert.equal(h.existingMainLectureHall([]),undefined);
 const existing={id:"existing",kind:"building",name:"Tòa giảng đường",status:"active"};
 assert.equal(h.existingMainLectureHall([existing]),existing);
 const map=src("manager-campus-map.tsx");
 assert.match(map,/const buildings=board\.resources\.filter\(r=>r\.kind==="building"\)/);
 assert.match(map,/Chưa tạo/);
 assert.match(map,/không phải tòa đã được lưu/);
 assert.match(map,/onOpenMainTemplate/);
 assert.match(map,/bookedIds/);
});
test("authorized manager can create hall exactly once with no synthetic rooms",async()=>{
 const f=await setup();
 try{
  await grant(f);await resources(f);
  const h=helper();
  const data={action:"save-resource",id:h.MAIN_LECTURE_HALL_ID,kind:"building",name:h.MAIN_LECTURE_HALL_NAME,
   parentId:"",capacity:1,requiredTeachers:1,status:"active",expectedVersion:0};
  const saved=await f.call(data);
  assert.equal(saved.status,200,JSON.stringify(saved));
  const hall=saved.board.resources.find(r=>r.id===data.id);
  assert.equal(hall.name,data.name);
  assert.equal(hall.kind,"building");
  assert.equal(saved.board.resources.filter(r=>r.id===data.id).length,1);
  assert.equal(saved.board.resources.filter(r=>r.kind==="room"&&r.parentId===data.id).length,0);
  const duplicate=await f.call(data);
  assert.equal(duplicate.status,409,"idempotent UI guards plus server version checks prevent duplicated writes");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM training_resources WHERE id=?").get(data.id).count,1);
 }finally{f.sqlite.close();}
});
test("building/overview/room tabs share one scene with active server-side resource actions",()=>{
 const studio=src("manager-building-studio.tsx");
 const overview=src("manager-command-center.tsx");
 const room=src("manager-console-v12.tsx");
 const workspace=src("manager-workspace.tsx");
 for(const x of [studio,overview,room])assert.match(x,/ManagerCampusMap/);
 assert.match(studio,/onInstallMainHallTemplate\(\)/);
 assert.match(workspace,/async function installLectureHallTemplate\(\)/);
 assert.match(workspace,/MAIN_LECTURE_HALL_ID/);
 assert.match(workspace,/action:"save-resource",id:MAIN_LECTURE_HALL_ID/);
 assert.match(studio,/onEditBuilding\(current\)/);
 assert.match(room,/onCreateRoom\(b.id\)/);
 assert.match(overview,/onSelectBuilding=\{building=>selectBuilding\(building.id\)\}/);
});
