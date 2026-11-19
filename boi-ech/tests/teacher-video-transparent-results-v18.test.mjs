import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const ts=require("typescript");
const React=require("react");
const {renderToStaticMarkup}=require("react-dom/server");
const read=(file)=>fs.readFileSync(new URL("../app/"+file,import.meta.url),"utf8");
const source=read("teacher-video-result-details.tsx");
const transpiled=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
});
const loaded={exports:{}};
new Function("module","exports","require",transpiled.outputText)(loaded,loaded.exports,require);
const mod=loaded.exports;
const normal={
 score:95,confidence:99,captureQuality:"good",poseCoverage:90,averageVisibility:91,
 sampledFrames:40,detectedFrames:36,durationSec:12,cameraView:"rear",
 categories:{legs:45,arms:94,coordination:77,bodyLine:85},
 errorCount:1,topErrors:["Hai gối mở rộng kéo dài khi thu chân"],
 errors:[{title:"Hai gối mở rộng kéo dài khi thu chân",severity:"critical",timeSec:3.2,
  observed:"Góc mở gối lớn",expected:"Thu chân gọn trước khi đạp",
  recommendation:"Luyện thu chân gọn, sau đó đạp và khép.",confidence:90}],
 analyzedAt:"2026-11-15T08:00:00.000Z"
};
const html=(analysis=normal,review=null)=>renderToStaticMarkup(React.createElement(mod.default,{analysis,review}));

test("AI grade reference bands use explicit score boundaries and preserve /10 scale",()=>{
 assert.equal(mod.technicalLevel(49).id,"needs-practice");
 assert.equal(mod.technicalLevel(50).id,"developing");
 assert.equal(mod.technicalLevel(69).id,"developing");
 assert.equal(mod.technicalLevel(70).id,"fair");
 assert.equal(mod.technicalLevel(84).id,"fair");
 assert.equal(mod.technicalLevel(85).id,"strong");
 assert.equal(mod.scoreToTen(95),"9,5");
 assert.equal(mod.scoreToTen(49),"4,9");
});
test("confidence is evidence-quality signal, never correctness %",()=>{
 assert.equal(mod.reliableVideoEvidence(normal),true);
 assert.equal(mod.reliableVideoEvidence({...normal,confidence:69}),false);
 assert.equal(mod.reliableVideoEvidence({...normal,captureQuality:"review"}),false);
 assert.equal(mod.qualityStatement({...normal,captureQuality:"review"}).id,"limited");
 assert.match(mod.qualityStatement(normal).detail,/không có nghĩa động tác đã đúng/);
 const rendered=html();
 assert.match(rendered,/Độ tin cậy nhận diện/);
 assert.match(rendered,/không phải % đúng kỹ thuật/);
 assert.match(rendered,/Đủ điều kiện đối chiếu/);
});
test("report renders all actual category scores, error specifics and critical disclosure despite high total",()=>{
 const rendered=html();
 for(const label of ["Động tác chân","Động tác tay","Phối hợp","Tư thế thân",
 "45 / 100","94 / 100","77 / 100","85 / 100","AI quan sát:","Động tác tham chiếu:","Nên luyện:","khoảng 3,2 giây"])
 assert.ok(rendered.includes(label),label);
 assert.match(rendered,/Điểm cao vẫn có lỗi/);
 assert.match(rendered,/Ưu tiên luyện tập/);
 assert.match(rendered,/không phải điểm Giảng viên/);
 assert.match(rendered,/4 nhóm kỹ thuật/);
 assert.match(rendered,/Khung hình nhận diện/);
 assert.match(rendered,/lượt phân tích này/);
 assert.doesNotMatch(rendered,/data:image\//);
});
test("missing legacy category/evidence values are unknown, not invented zero or made-up ratios",()=>{
 const old={...normal,categories:{legs:null,arms:null,coordination:null,bodyLine:null},
 sampledFrames:null,detectedFrames:null,durationSec:null,poseCoverage:null,averageVisibility:null,
 errors:[],errorCount:0,topErrors:[]};
 const rendered=html(old);
 assert.match(rendered,/Chưa có dữ liệu/);
 assert.match(rendered,/Chưa đủ dữ liệu điểm nhóm/);
 assert.match(rendered,/Chưa có dữ liệu để xác định|Chưa đủ dữ liệu điểm nhóm/);
 assert.doesNotMatch(rendered,/0 \/ 100/);
});
test("review must be associated with THIS analysis, not any later teacher action",()=>{
 const latest={action:"review",reviewStatus:"reviewed",analysisAt:normal.analyzedAt,
  teacherName:"Giảng viên A",note:"Đã xem lỗi thu chân."};
 assert.equal(mod.teacherReviewForAnalysis(latest,normal),latest);
 assert.equal(mod.teacherReviewForAnalysis({...latest,analysisAt:"2026-10-01T00:00:00Z"},normal),null);
 assert.equal(mod.teacherReviewForAnalysis({...latest,action:"feedback"},normal),null);
 const rendered=html(normal,latest);
 assert.match(rendered,/Đã ghi nhận review/);
 assert.match(rendered,/Đã xem lỗi thu chân/);
 assert.match(html(),/Chưa tìm thấy review liên kết/);
});
test("true teacher result expansion is reachable and no longer merely sets existing analysis tab",()=>{
 const shell=read("teacher-role-shell.tsx");
 assert.match(shell,/function AnalysisQueue\(/);
 assert.match(shell,/aria-expanded=\{isOpen\}/);
 assert.match(shell,/setExpanded\(isOpen\?null:id\)/);
 assert.ok(shell.includes("<TeacherVideoResultDetails analysis={analysis} review={learner.latestVideoReview ?? learner.latestTeacherAction}"));
 assert.match(shell,/data-server-review/);
 assert.match(shell,/data-server-feedback/);
 assert.doesNotMatch(shell,/<button type="button" onClick=\{\(\) => setTab\("analysis"\)\}>Mở tóm tắt<\/button>/);
 assert.match(shell,/video gốc/);
});
test("teacher endpoint reads normalized media-free technical evidence, not raw video or snapshots",()=>{
 const route=read("api/teacher/overview/route.ts");
 assert.match(route,/source.categories/);
 assert.match(route,/detailErrors/);
 assert.match(route,/timeSec: measuredSeconds\(row.timeSec\)/);
 assert.match(route,/recommendation: typeof row.recommendation/);
 assert.match(route,/poseCoverage: measured\(quality.poseCoverage\)/);
 assert.match(route,/sampledFrames: measured\(source.sampledFrames, 240\)/);
 assert.match(route,/return \[\{/);
 assert.doesNotMatch(route,/canvas\.toDataURL|videoBlob|rawVideo:|snapshot:/);
});
test("report CSS is loaded last, overrides clipped queue and remains keyboard/mobile readable",()=>{
 const layout=read("layout.tsx"),style=read("teacher-video-results-transparency.css");
 assert.ok(layout.indexOf('import "./teacher-video-results-transparency.css";')>
   layout.indexOf('import "./teacher-contrast-content-first.css";'));
 assert.match(style,/max-height:none!important/);
 assert.match(style,/overflow:visible!important/);
 assert.match(style,/teacher-video-expanded/);
 assert.match(style,/teacher-analysis-actions :is\(button,a\):focus-visible/);
 assert.match(style,/@media\(max-width:630px\)/);
 assert.match(style,/prefers-reduced-motion:reduce/);
});
