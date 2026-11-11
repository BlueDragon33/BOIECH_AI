import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import ts from "typescript";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";

const require=createRequire(import.meta.url);
function panel(){
  const source=fs.readFileSync(new URL("../app/teacher-roster-manager.tsx",import.meta.url),"utf8")+
    "\nexport {RosterPanel};";
  const loaded={exports:{}};
  new Function("require","module","exports",ts.transpileModule(source,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
  }).outputText)(require,loaded,loaded.exports);
  return loaded.exports.RosterPanel;
}
const item={status:"approved",name:"Học viên được duyệt",personCode:"HV_PRIVATE_ONLY",
 className:"Lớp 1",registrationComplete:true,lastSeenAt:"2026-11-11"};
const data={canManage:false,roster:[item],counts:{pending:0,approved:1,blocked:0},syncedAt:"2026-11-11"};
test("V9 teacher roster shows only approved assigned class, with no personal code column",()=>{
 const html=renderToStaticMarkup(React.createElement(panel(),{data,loading:false,error:"",onSync:()=>{}}));
 assert.match(html,/Học viên được duyệt/);
 assert.match(html,/Lớp 1/);
 assert.match(html,/Cán bộ quản lý/);
 assert.doesNotMatch(html,/HV_PRIVATE_ONLY/);
 assert.doesNotMatch(html,/<th>Mã<\/th>/);
});
test("V9 teacher roster cannot show approve, block, remove or restore actions",()=>{
 const html=renderToStaticMarkup(React.createElement(panel(),{data,loading:false,error:"",onSync:()=>{}}));
 assert.doesNotMatch(html,/<button[^>]*class="(?:approve|remove|restore)"/);
 assert.doesNotMatch(html,/Loại khỏi lớp|Khôi phục tài khoản|Phê duyệt<\/button>/);
 assert.match(html,/Đồng bộ dữ liệu/);
});
