import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=(name)=>readFileSync(new URL("../app/"+name,import.meta.url),"utf8");
const roleCss=app("role-readable-v9.css");
const layout=app("layout.tsx");
const teacher=app("teacher-role-shell.tsx");
const page=app("page.tsx");
const oldStructure=app("teacher-dashboard-structure-v4.css");
const oldReference=app("teacher-dashboard-reference.css");

test("V9 fixes the actual teacher appearance button hidden by two historical styles",()=>{
  assert.match(oldReference,/\.appearance-trigger \{ display: none !important; \}/);
  assert.match(oldStructure,/\.topbar-actions > \.appearance-trigger \{/);
  const last=layout.indexOf('import "./role-readable-v9.css"');
  const older=layout.indexOf('import "./teacher-premium-v9-layout-clean.css"');
  assert.ok(last>older&&older>=0,"role repair CSS must be the last presentation import");
  assert.match(roleCss,/\.app-shell \.main-area > \.topbar \.topbar-actions > button\.appearance-trigger/);
  assert.match(roleCss,/display:inline-flex!important/);
  assert.match(roleCss,/visibility:visible!important/);
});

test("Teacher sidebar uses the canonical persisted appearance preferences, not a second form",()=>{
  assert.match(teacher,/aria-label="Mở cài đặt giao diện Giảng viên"/);
  assert.match(teacher,/boi:appearance:open/);
  assert.match(page,/window\.addEventListener\("boi:appearance:open", openAppearance\)/);
  assert.match(page,/setAppearanceOpen\(true\)/);
  assert.match(page,/boi-ech-appearance-v1/);
  assert.match(page,/data-appearance-density=\{appearance\.density\}/);
  assert.match(page,/data-appearance-theme=\{appearance\.theme\}/);
  assert.match(page,/--font-adjust/);
  for(const value of [0,2,4])assert.match(page,new RegExp("value: "+value+", label: "));
});

test("Teacher appearance changes size of actual capability body text and tabs",()=>{
  assert.match(roleCss,/\.teacher-capability-action strong\{[\s\S]*?font-size:calc\(16px \+ var\(--font-adjust,0px\)\)!important/);
  assert.match(roleCss,/\.teacher-capability-action small\{[\s\S]*?font-size:calc\(14px \+ var\(--font-adjust,0px\)\)!important/);
  assert.match(roleCss,/\.teacher-role-nav-list button span\{[\s\S]*?font-size:calc\(14px \+ var\(--font-adjust,0px\)\)!important/);
  assert.match(roleCss,/\.teacher-table td,/);
  assert.match(roleCss,/\.teacher-rail-empty/);
  assert.match(roleCss,/\.teacher-capability-grid\{[\s\S]*?repeat\(2,minmax\(0,1fr\)\)!important/);
});

test("Learner 8 lesson cards also use real font preference, never fixed miniature labels",()=>{
  assert.match(roleCss,/\.student-lesson-grid>button>small\{[\s\S]*?font-size:calc\(12px \+ var\(--font-adjust,0px\)\)!important/);
  assert.match(roleCss,/\.student-lesson-grid>button>strong\{[\s\S]*?font-size:calc\(16px \+ var\(--font-adjust,0px\)\)!important/);
  assert.match(roleCss,/\.student-lesson-grid>button>p\{[\s\S]*?font-size:calc\(13px \+ var\(--font-adjust,0px\)\)!important/);
  assert.match(roleCss,/\.student-lesson-grid>button\.locked\{[\s\S]*?opacity:\.83!important/);
  assert.match(roleCss,/@media\(max-width:700px\)/);
});

test("Teacher sidebar does not clip bottom navigation or profession profile",()=>{
  assert.match(roleCss,/\.app-shell \.sidebar\{[\s\S]*?overflow-y:auto!important/);
  assert.match(roleCss,/max-height:100dvh!important/);
  assert.match(roleCss,/\.teacher-role-nav\{[\s\S]*?display:flex!important/);
  assert.match(roleCss,/\.teacher-role-nav-list\{[\s\S]*?grid-auto-rows:minmax\(49px,auto\)/);
  assert.match(roleCss,/\.teacher-nav-quote\{[\s\S]*?white-space:normal!important/);
  assert.match(roleCss,/\.teacher-role-nav-list button span\{[\s\S]*?overflow-wrap:anywhere/);
  assert.match(roleCss,/\.sidebar::after\{[\s\S]*?display:none!important/);
});

test("V9 display repair is role-scoped without altering Account-first or D1",()=>{
  assert.match(roleCss,/body\[data-teacher-role-ui="active"\]/);
  assert.match(roleCss,/body\[data-student-role-ui="active"\]/);
  assert.doesNotMatch(roleCss,/wrangler|fetch\(|\/api\/|account_entitlements|SELECT \* FROM|boi-ech-db/);
  assert.doesNotMatch(teacher,/boi:appearance:open[^\n]*fetch\(/);
});
