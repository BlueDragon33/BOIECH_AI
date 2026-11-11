import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = file => fs.readFileSync(new URL("../app/"+file,import.meta.url),"utf8");
const blueprint=read("teacher-dashboard-blueprint.tsx");
const css=read("role-readable-v9.css");
const legacy=read("teacher-dashboard-usability-v29.css");
const layout=read("layout.tsx");
const shell=read("teacher-role-shell.tsx");
const page=read("page.tsx");

test("Legacy teacher refresh/sync/pro/alert controls are never dynamically reintroduced",()=>{
 assert.doesNotMatch(blueprint,/function ensureTopbarTools/);
 assert.doesNotMatch(blueprint,/badge\.textContent\s*=\s*"Giảng viên Pro"/);
 assert.doesNotMatch(blueprint,/refresh\.textContent\s*=\s*"Làm mới"/);
 assert.doesNotMatch(blueprint,/sync\.textContent\s*=\s*"Đồng bộ"/);
 assert.match(blueprint,/function removeLegacyTopbarTools/);
 assert.match(blueprint,/\.topbar-actions > \.teacher-topbar-refresh/);
 assert.match(blueprint,/\.topbar-actions > \.teacher-topbar-sync/);
 assert.match(blueprint,/\.topbar-actions > \.teacher-mode-badge/);
 assert.match(blueprint,/\.topbar-actions > \.teacher-alert-shortcut/);
 assert.match(blueprint,/removeLegacyTopbarTools\(\)/);
});

test("Desktop teacher sidebar occupies the grid column; no fixed overlay conflict",()=>{
 assert.match(legacy,/\.app-shell\s*\{[^}]*display:\s*grid\s*!important/);
 assert.match(css,/@media\(min-width:881px\)/);
 assert.match(css,/grid-template-columns:var\(--td8-sidebar,220px\) minmax\(0,1fr\)!important/);
 assert.match(css,/\.app-shell>\.sidebar\{\s*position:sticky!important/);
 assert.match(css,/width:var\(--td8-sidebar,220px\)!important/);
 assert.match(css,/\.app-shell>\.main-area\{\s*width:100%!important/);
 assert.match(css,/margin-left:0!important/);
 const previousFixed=css.indexOf('body[data-student-role-ui="active"] .app-shell>.sidebar{');
 const next=css.indexOf('body[data-student-role-ui="active"] .app-shell>.sidebar>.brand-row,',previousFixed);
 assert.ok(previousFixed>=0 && next>previousFixed);
 assert.doesNotMatch(css.slice(previousFixed,next),/body\[data-teacher-role-ui="active"\] \.app-shell>\.sidebar/);
});

test("Teacher brand remains visible while sidebar navigation scrolls independently",()=>{
 assert.match(css,/\.app-shell>\.sidebar>\.teacher-role-nav-mount\{\s*min-height:0!important/);
 assert.match(css,/flex:1 1 auto!important/);
 assert.match(css,/overflow-y:auto!important/);
 assert.match(css,/overflow-x:hidden!important/);
 assert.match(css,/\.app-shell>\.sidebar>\.teacher-role-nav-mount::-webkit-scrollbar/);
 assert.match(shell,/teacher-role-nav-mount/);
});

test("Phone and tablet keep native off-canvas drawer and full-width content",()=>{
 assert.match(css,/@media\(max-width:880px\)/);
 assert.match(css,/\.app-shell\{\s*display:block!important/);
 assert.match(css,/\.app-shell>\.sidebar\{\s*position:fixed!important/);
 assert.match(css,/width:min\(88vw,320px\)!important/);
 assert.match(css,/\.app-shell>\.main-area\{\s*width:100%!important/);
 assert.match(read("globals.css"),/\.sidebar\.is-open\s*\{\s*transform:\s*translateX\(0\)/);
});

test("Teacher command bar keeps search, real profile and appearance without overflow",()=>{
 assert.match(css,/\.main-area>\.topbar\{\s*display:flex!important/);
 assert.match(css,/flex-wrap:wrap!important/);
 assert.match(css,/\.teacher-role-search-mount\{\s*flex:1 1 270px!important/);
 assert.match(css,/\.topbar-actions\{\s*flex:0 1 auto!important/);
 assert.match(css,/\.topbar-actions>\s*:is\(\.teacher-topbar-refresh,\.teacher-topbar-sync,\.teacher-mode-badge,\.teacher-alert-shortcut\)/);
 assert.match(shell,/teacher-appearance-shortcut/);
 assert.match(page,/boi:appearance:open/);
 assert.match(layout,/import "\.\/role-readable-v9.css"/);
});

test("UI correction changes no account approvals, database, or backend routes",()=>{
 assert.doesNotMatch(css,/ALTER TABLE|DELETE FROM|wrangler deploy|\/api\/|http[s]?:\/\//);
 assert.doesNotMatch(blueprint,/fetch\(|CREATE TABLE|UPDATE account/);
 assert.match(shell,/tab === "learners"/);
 assert.match(shell,/tab === "tasks"/);
 assert.match(shell,/tab === "reports"/);
});
