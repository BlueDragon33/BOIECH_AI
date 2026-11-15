import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve,dirname} from "node:path";
import test from "node:test";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"../app");
const source=(name)=>readFileSync(resolve(root,name),"utf8");

test("campus UI: both overview and room tab use the same illustrative building and real data",()=>{
 const art=source("manager-campus-illustration.tsx");
 const overview=source("manager-command-center.tsx");
 const rooms=source("manager-console-v12.tsx");
 assert.match(art,/viewBox="0 0 280 210"/);
 assert.ok(overview.includes('ManagerCampusMap board={board} mode="overview"'));
 const map=source("manager-campus-map.tsx");
 assert.ok(map.includes("CampusBuildingArt variant={index}"));
 assert.match(map,/MainLectureHallArt/);
 assert.match(rooms,/CampusBuildingArt variant=\{index\}/);
 assert.match(rooms,/selectedId=\{activeBuilding\?\.id\}/);
 assert.match(rooms,/onCreateRoom\(b.id\)/);
 assert.match(rooms,/onEditSession\(undefined,r.id\)/);
});

test("building studio retains server authority for all building/room writes",()=>{
 const studio=source("manager-building-studio.tsx");
 const workspace=source("manager-workspace.tsx");
 assert.match(studio,/board\.resources\.filter\(r=>r\.kind==="building"\)/);
 assert.match(studio,/board\.resources\.filter\(r=>r\.kind==="room"\)/);
 assert.match(studio,/onCreateBuilding/);
 assert.match(studio,/onEditBuilding\(current\)/);
 assert.match(studio,/onCreateRoom\(current\.id\)/);
 assert.match(studio,/onEditRoom\(room\)/);
 assert.match(studio,/onCreateSession\(room\.id\)/);
 assert.match(workspace,/tab==="building"\?<ManagerBuildingStudio/);
 assert.match(workspace,/onCreateBuilding=\{\(\)=>newResource\("building"\)\}/);
 assert.match(workspace,/onCreateRoom=\{buildingId=>newResource\("room",buildingId\)\}/);
 assert.match(workspace,/async function submitResource\(event:FormEvent\)/);
 assert.match(workspace,/action:"save-resource"/);
 assert.match(studio,/Chưa có thực thể “tầng” hoặc “khối” riêng/);
});

test("campus UI provides responsive high contrast and focus styles",()=>{
 const studioCss=source("manager-building-studio.module.css");
 const roomCss=source("manager-console-v12.module.css");
 assert.match(studioCss,/:focus-visible/);
 assert.match(studioCss,/@media\(max-width:540px\)/);
 assert.match(roomCss,/\.campusNodes/);
 assert.match(roomCss,/@media\(max-width:620px\)/);
});
