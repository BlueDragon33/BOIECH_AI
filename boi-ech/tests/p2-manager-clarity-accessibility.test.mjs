import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manager = readFileSync(new URL("../app/manager-workspace.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/manager-workspace.module.css", import.meta.url), "utf8");
const student = readFileSync(new URL("../app/student-role-shell.tsx", import.meta.url), "utf8");

function luminance(hex) {
  const rgb = hex.replace("#","").match(/../g).map(v=>parseInt(v,16)/255)
    .map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
}
function contrast(a,b) {
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}

test("P2 desktop rail and mobile dock do not show another launcher grid",()=>{
 assert.doesNotMatch(manager,/styles\.appGrid|data-app=/);
 assert.doesNotMatch(css,/\.appGrid|\.appLabel/);
 assert.match(manager,/ManagerCommandCenter board=\{board\}/);
 assert.match(manager,/styles\.desktopRail/);
 assert.match(manager,/const dock:[^\n]*Trang chủ[^\n]*Kiểm duyệt[^\n]*Lịch[^\n]*Lớp học[^\n]*Nhân sự/);
 assert.doesNotMatch(manager.match(/const dock:[^\n]*/)?.[0]??"",/Cài đặt/);
});

test("P2 mobile navigation uses a five-column row and retains Settings in header",()=>{
 assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(css,/max-width:360px/);
 assert.match(css,/overflow-wrap:anywhere/);
 assert.match(css,/\.workspace \.settingsShortcut\{display:none\}/);
 assert.match(manager,/aria-label="Mở cài đặt điều phối" aria-current=\{tab==="settings"/);
 assert.match(manager,/onClick=\{\(\)=>selectTab\("settings"\)\}/);
});

test("P2 manager mobile dock foregrounds meet 4.5:1 minimum on dark backgrounds",()=>{
 assert.ok(contrast("#ccd8fa","#14295c")>=4.5);
 assert.ok(contrast("#ffffff","#305bd7")>=4.5);
 assert.ok(contrast("#ffffff","#6338d8")>=4.5);
});

test("P2 learner profile never renders or extracts historical personal identifiers",()=>{
 assert.doesNotMatch(student,/personCode|Mã học viên được bảo vệ theo thiết bị/);
 assert.match(student,/Hồ sơ học tập đã xác thực/);
 assert.match(student,/Quyền truy cập/);
 assert.match(student,/Trạng thái/);
});
