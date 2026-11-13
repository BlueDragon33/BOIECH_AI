import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src=name=>fs.readFileSync(new URL("../app/"+name,import.meta.url),"utf8");
test("Unexpected manager personnel render exceptions show a recoverable error, not a blank page",()=>{
 const page=src("page.tsx"),boundary=src("manager-render-boundary.tsx"),css=src("manager-workspace.module.css");
 assert.match(page,/import ManagerRenderBoundary from/);
 assert.match(page,/<ManagerRenderBoundary key=\{deviceAccess\.deviceId\}>/);
 assert.match(page,/<ManagerWorkspace key=/);
 assert.match(boundary,/getDerivedStateFromError/);
 assert.match(boundary,/role="alert"/);
 assert.match(boundary,/Không thể hiển thị giao diện Cán bộ quản lý/);
 assert.match(boundary,/window\.location\.reload\(\)/);
 assert.match(css,/\.managerRenderFallback\{/);
});
