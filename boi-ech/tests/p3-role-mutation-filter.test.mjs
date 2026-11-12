import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../app/role-mutation-filter.ts", import.meta.url), "utf8");
const student = readFileSync(new URL("../app/student-role-shell.tsx", import.meta.url), "utf8");
const teacher = readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function("exports","module",code)(mod.exports,mod);
const { shouldRefreshRoleShell } = mod.exports;

class FakeNode {
  constructor({types=[],parent=null,children=[]}={}){
    this.nodeType=1;this.parentElement=parent;this.tags=new Set(types);this.children=children;
    this.tags.add("ELEMENT");
  }
  matches(selector){return selector.split(",").some(s=>this.tags.has(s.trim()));}
  closest(selector){for(let n=this;n;n=n.parentElement)if(n.matches(selector))return n;return null;}
  querySelector(selector){for(const node of this.children){if(node.matches(selector))return node;const inside=node.querySelector(selector);if(inside)return inside;}return null;}
}
const root=new FakeNode({types:["BODY"]});
const shell=new FakeNode({types:[".app-shell"],parent:root});
const sidebar=new FakeNode({types:[".sidebar"],parent:shell});
const chip=new FakeNode({types:[".learner-chip"],parent:shell});
const main=new FakeNode({types:[".main-area"],parent:shell});
const media=new FakeNode({types:[".video-motion-stage"],parent:main});
const roleMount=new FakeNode({types:["[data-student-role-ui]:not(body)"],parent:main});
const roleInner=new FakeNode({parent:roleMount});
const teacherMount=new FakeNode({types:["[data-teacher-role-ui]:not(body)"],parent:main});
function record(target,type="characterData",addedNodes=[],removedNodes=[]){
 return {target,type,addedNodes,removedNodes};
}
function textNode(parentElement){return {nodeType:3,parentElement};}

test("P3 ignores text updates inside both React portals without scheduling another scan",()=>{
 const changes=[record(textNode(roleInner)),record(textNode(teacherMount))];
 assert.equal(shouldRefreshRoleShell(changes,"student"),false);
 assert.equal(shouldRefreshRoleShell(changes,"teacher"),false);
});
test("P3 retains legitimate role, navigation, and label changes",()=>{
 for(const role of ["student","teacher"]) {
  assert.equal(shouldRefreshRoleShell([record(shell,"attributes")],role),true);
  assert.equal(shouldRefreshRoleShell([record(textNode(chip))],role),true);
  assert.equal(shouldRefreshRoleShell([record(sidebar,"attributes")],role),true);
  assert.equal(shouldRefreshRoleShell([record(root,"childList",[shell])],role),true);
  assert.equal(shouldRefreshRoleShell([record(root,"childList",[],[shell])],role),true);
 }
});
test("P3 filters unrelated media/AI mutations and outside-page updates",()=>{
 const outside=new FakeNode({types:[".unrelated-overlay"],parent:root});
 for(const role of ["student","teacher"]) {
  assert.equal(shouldRefreshRoleShell([record(textNode(media)),record(outside,"attributes")],role),false);
  assert.equal(shouldRefreshRoleShell([record(root,"attributes")],role),false);
 }
});
test("P3 student still tracks quiz progress while teacher avoids lesson-only observer work",()=>{
 const overview=new FakeNode({types:[".page-overview"],parent:main});
 const progress=new FakeNode({types:[".sidebar-progress"],parent:sidebar});
 assert.equal(shouldRefreshRoleShell([record(textNode(overview))],"student"),true);
 assert.equal(shouldRefreshRoleShell([record(textNode(progress))],"student"),true);
 assert.equal(shouldRefreshRoleShell([record(textNode(overview))],"teacher"),false);
});
test("P3 both role adapters share filter, retain source watcher and clean up",()=>{
 assert.match(student,/shouldRefreshRoleShell\(mutations, "student"\)/);
 assert.match(teacher,/shouldRefreshRoleShell\(mutations, "teacher"\)/);
 for(const role of [student,teacher]){
  assert.match(role,/observer\.observe\(document\.body/);
  assert.match(role,/observer(?:\?)?\.disconnect\(\)/);
  assert.match(role,/window\.clearTimeout\(timer\)/);
 }
});
