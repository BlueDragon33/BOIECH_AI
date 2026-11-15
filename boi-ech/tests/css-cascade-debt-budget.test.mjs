import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

/**
 * AUDIT-001 / Blueprint OS 1.3.0 / P1
 *
 * Baseline measured from main bb7e7cace5c4a3e158f3afec99d14888d1510acb.
 * This is a regression budget, NOT evidence that the existing 34 global CSS
 * layers are clean or that computed colors pass WCAG. Future changes should
 * REPLACE superseded declarations with scoped styles rather than adding
 * another numbered global override layer.
 */
const audited=new Set([
  "globals.css","student-role-shell.css","student-adaptive-coach.css",
  "teacher-role-shell.css","role-typography.css","teacher-action-bridge.css",
  "multi-account-switcher.css","teacher-dashboard-reference.css",
  "teacher-dashboard-blueprint.css","teacher-dashboard-scale-v3.css",
  "teacher-dashboard-structure-v4.css","teacher-dashboard-visual-v5.css",
  "teacher-dashboard-data-v6.css","teacher-dashboard-actions-v7.css",
  "teacher-dashboard-visual-v8.css","teacher-roster-sync-v9.css",
  "teacher-learning-analytics-l7.css","teacher-smart-interventions-l8.css",
  "two-way-messaging-l9.css","assignment-schedule-l10.css",
  "teacher-secondary-tabs-v10.css","teacher-dashboard-usability-v29.css",
  "teacher-control-center-v30.css","teacher-class-filter-v32.css",
  "teacher-class-actions-v33.css","teacher-reference-layout-v36.css",
  "teacher-secondary-tabs-v37.css","video-analysis-v37.css",
  "teacher-premium-v9-layout-clean.css","role-readable-v9.css",
  "modal-contrast-v9.css","device-gate-premium.css","manual-sync-badge.css",
  "teacher-contrast-content-first.css"
]);
function read(relative){return fs.readFileSync(new URL(relative,import.meta.url),"utf8");}
function inventory(){
  const layout=read("../app/layout.tsx");
  const imported=[...layout.matchAll(/import\s+["']\.\/([^"']+\.css)["'];?/g)].map(m=>m[1]);
  const files=imported.map(name=>({name,text:read("../app/"+name)}));
  return {layout,imported,files,important:files.reduce((n,f)=>
    n+(f.text.match(/!important/g)||[]).length,0),
    heroRules:files.reduce((n,f)=>n+(f.text.match(/\.teacher-hero\s*\{/g)||[]).length,0)};
}
test("global CSS imports cannot silently grow into another versioned override layer",()=>{
  const x=inventory();
  assert.equal(new Set(x.imported).size,x.imported.length,"global CSS must not be imported twice");
  assert.ok(x.imported.length<=34,"AUDIT-001: excessive global CSS files; consolidate instead");
  assert.deepEqual(x.imported.filter(name=>!audited.has(name)),[],
    "new global CSS layer requires explicit P1 debt budget review; prefer CSS Modules");
});
test("existing !important cascade budget can decrease, never silently increase",()=>{
  const x=inventory();
  assert.ok(x.important<=892,
    "AUDIT-001: global !important debt increased beyond measured baseline; reduce cascade conflicts");
  assert.ok(x.heroRules<=20,
    "AUDIT-001: .teacher-hero already has overlapping old/new rules; consolidate rather than append");
  console.log("AUDIT-001 CSS source metrics:",JSON.stringify({
    importedStylesheets:x.imported.length,
    importantDeclarations:x.important,teacherHeroRuleBlocks:x.heroRules,
    computedStyleEvidence:false
  }));
});
test("the reviewed Content First contrast fix stays after legacy teacher CSS",()=>{
  const x=inventory();
  const current=x.imported.indexOf("teacher-contrast-content-first.css");
  assert.ok(current>=0,"PR #172 contrast fix must remain imported");
  for(const legacy of ["teacher-role-shell.css","teacher-dashboard-visual-v8.css",
    "teacher-premium-v9-layout-clean.css","role-readable-v9.css"]){
    assert.ok(x.imported.indexOf(legacy)<current,
      "the reviewed contrast layer must override legacy "+legacy);
  }
});
