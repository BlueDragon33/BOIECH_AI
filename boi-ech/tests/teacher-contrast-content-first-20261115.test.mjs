import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const css=readFileSync(new URL("../app/teacher-contrast-content-first.css",import.meta.url),"utf8");
const layout=readFileSync(new URL("../app/layout.tsx",import.meta.url),"utf8");
const roster=readFileSync(new URL("../app/teacher-roster-manager.tsx",import.meta.url),"utf8");
const shell=readFileSync(new URL("../app/teacher-role-shell.tsx",import.meta.url),"utf8");
function block(marker){
 const at=css.indexOf(marker);
 assert.ok(at>=0,"Expected CSS palette block "+marker);
 const start=css.indexOf("{",at);
 const end=css.indexOf("}",start);
 assert.ok(end>start);
 return css.slice(start+1,end);
}
function colors(marker){
 const result={};
 for(const [,key,value] of block(marker).matchAll(/(--tc-[\w-]+):\s*(#[a-f0-9]{6})\s*;/gi))
  result[key]=value.toLowerCase();
 return result;
}
function luminance(hex){
 const rgb=hex.slice(1).match(/[a-f0-9]{2}/gi).map(h=>parseInt(h,16)/255);
 const linear=rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
}
function contrast(front,back){
 const f=luminance(front),b=luminance(back);
 return (Math.max(f,b)+.05)/(Math.min(f,b)+.05);
}
const light=colors('body[data-teacher-role-ui="active"] {');
const dark=colors('body[data-teacher-role-ui="active"] .app-shell[data-appearance-theme="dark"] {');
const check=(label,fg,bg)=>{
 assert.ok(typeof fg==="string"&&typeof bg==="string",`${label} must use real six-digit color tokens`);
 assert.ok(contrast(fg,bg)>=4.5,`${label}: ${contrast(fg,bg).toFixed(2)}:1 < 4.5:1 (${fg} on ${bg})`);
};
test("teacher content-first palette pairs all primary and secondary text with real surface in both modes",()=>{
 for(const [name,p] of [["light",light],["dark",dark]]){
  for(const bg of ["--tc-panel","--tc-panel-alt"])check(name+" main body "+bg,p["--tc-ink"],p[bg]);
  check(name+" table headings",p["--tc-strong"],p["--tc-heading"]);
  check(name+" secondary text",p["--tc-muted"],p["--tc-panel-alt"]);
  check(name+" actionable button",p["--tc-action-ink"],p["--tc-action-bg"]);
  check(name+" progress text",p["--tc-track-ink"],p["--tc-panel"]);
  check(name+" warning",p["--tc-warning-ink"],p["--tc-warning-bg"]);
  check(name+" okay",p["--tc-ok-ink"],p["--tc-ok-bg"]);
 }
});
test("disabled, hover and focus visuals have sufficient contrast and visible state",()=>{
 check("light enabled hover","#ffffff","#145b8e");
 check("dark enabled hover","#ffffff","#23688f");
 check("disabled action","#40556b","#d4deea");
 assert.match(css,/\.teacher-row-action:disabled\s*\{[^}]*opacity:\s*1\s*!important;/s);
 assert.match(css,/cursor:\s*not-allowed/);
 assert.match(css,/\.teacher-table button:focus-visible\s*\{/);
});
test("actual learner names and headers in roster and watchlist are targeted as foreground-background PAIRS",()=>{
 assert.match(roster,/className="teacher-roster-table"/);
 assert.match(roster,/<th>Học viên<\/th><th>Lớp phụ trách<\/th>/);
 assert.match(roster,/<td><strong>\{person.name\}<\/strong><\/td>/);
 assert.match(shell,/className="teacher-table"/);
 assert.match(shell,/>Xem hồ sơ<\/button>/);
 for(const name of [".teacher-roster-manager",".teacher-roster-table tbody tr td",
  ".teacher-roster-table td strong",".teacher-table tbody tr td",
  ".teacher-table .teacher-student strong",".teacher-table .teacher-row-action"]){
  assert.ok(css.includes(name),`missing contrast repair for ${name}`);
 }
 assert.match(css,/\.teacher-roster-table :is\(thead,th\)\s*\{[^}]*background: var\(--tc-heading\) !important;[^}]*color: var\(--tc-strong\) !important;/s);
 assert.match(css,/\.teacher-table :is\(thead,th\)\s*\{[^}]*background: var\(--tc-heading\) !important;[^}]*color: var\(--tc-strong\) !important;/s);
 assert.match(css,/\.teacher-roster-table td strong\s*\{[^}]*color: var\(--tc-strong\)/s);
 assert.match(css,/\.teacher-table \.teacher-student strong,\s*body\[data-teacher-role-ui="active"\] \.teacher-table \.teacher-number-cell\s*\{[^}]*color: var\(--tc-strong\)/s);
});
test("content-first stylesheet is loaded after inherited conflicting teacher styles",()=>{
 const idx=layout.indexOf('import "./teacher-contrast-content-first.css";');
 assert.ok(idx>0);
 for(const previous of ["teacher-reference-layout-v36.css","teacher-premium-v9-layout-clean.css",
  "role-readable-v9.css","manual-sync-badge.css"])assert.ok(idx>layout.indexOf(previous),previous);
 assert.ok(css.indexOf('data-appearance-theme="dark"')>0);
 assert.match(css,/\.app-shell\[data-appearance-theme="dark"\] \.teacher-table tbody tr td\s*\{[^}]*background: var\(--tc-panel\) !important;[^}]*color: var\(--tc-ink\) !important;/s);
 assert.doesNotMatch(css,/body\s*\{\s*color:|:root\s*\{\s*--tc-ink/);
});
test("contrast fixes preserve teacher APIs, roster approval and learner navigation",()=>{
 assert.match(roster,/Giảng viên không thể duyệt, loại, khóa hay khôi phục/);
 assert.match(shell,/onClick=\{\(\) => onSelect\(learner\)\}/);
 assert.match(css,/min-height:\s*42px/);
 assert.match(css,/font-size:\s*calc\(14px \+ var\(--font-adjust,0px\)\) !important/);
 assert.match(css,/@media \(max-width: 640px\)/);
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
});
