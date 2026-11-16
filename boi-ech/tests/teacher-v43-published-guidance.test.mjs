import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import ts from "typescript";
const source=readFileSync(resolve("app/teacher-published-guidance.server.ts"),"utf8");
const api=readFileSync(resolve("app/api/teacher/overview/route.ts"),"utf8");
const details=readFileSync(resolve("app/teacher-video-result-details.tsx"),"utf8");
const drafts=readFileSync(resolve("app/teacher-video-priority-v42.ts"),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function("module","exports",js)(mod,mod.exports);
const {groundedSwimmingCorrections}=mod.exports;
const meta={id:"version-17",version_number:17,reviewed_by:"signed-professional",
 reviewed_at:"2030-02-01T00:00:00Z",published_at:"2030-02-02T00:00:00Z"};
const doc={movement:{mistakes:[
 {id:"legs-kick",name:"Sai động tác đạp chân",sign:"Đạp chân không khép",
  fix:"Thu chân gọn và đạp khép dưới sự quan sát của giảng viên.",drill:"Tập khép chân cùng bảng."},
 {id:"arms-pull",name:"Sai kéo tay",sign:"Tay kéo quá rộng",
  fix:"Thu khuỷu tay và duỗi về trước.",drill:"Luyện kéo tay chậm."}
]},foundationDetails:{"01":{mistakes:[{sign:"Cố gắng nhịn thở",cause:"Lo sợ",fix:"Tập thở đúng kỹ thuật có giám sát."}]}}};
const errors={errors:[{title:"Sai động tác chân",observed:"Đạp chân không khép"}],topErrors:["Đạp chân"]};
test("genuinely published, reviewed curriculum contributes text and exact version citation",()=>{
 const r=groundedSwimmingCorrections(doc,meta,errors,"03");
 assert.equal(r.length,1);
 assert.equal(r[0].source,"published-course-content");
 assert.equal(r[0].versionId,"version-17");assert.equal(r[0].versionNumber,17);
 assert.equal(r[0].sourceItemId,"legs-kick");
 assert.match(r[0].correction,/Thu chân gọn/);
 assert.match(r[0].practice,/Tập khép chân/);
});
test("unpublished, unreviewed, invalid published dates and unmatched signs cannot invent coaching text",()=>{
 for(const m of [null,{...meta,reviewed_by:null},{...meta,published_at:null},
  {...meta,reviewed_at:"2031-01-01T00:00:00Z"}, {...meta,version_number:0}]){
  assert.deepEqual(groundedSwimmingCorrections(doc,m,errors,"03"),[]);
 }
 assert.deepEqual(groundedSwimmingCorrections(doc,meta,{errors:[],topErrors:[]},"03"),[]);
 assert.deepEqual(groundedSwimmingCorrections(doc,meta,errors,"99"),[]);
});
test("published lesson 01 foundation mistakes are separately traceable",()=>{
 const r=groundedSwimmingCorrections(doc,meta,{
  errors:[{title:"Cố gắng nhịn thở",observed:"Lo sợ"}],topErrors:[]},"01");
 assert.equal(r.length,1);assert.equal(r[0].sourceItemId,"mistake-1");
});
test("signed teacher overview joins published D1 metadata and exact video lesson before citing content",()=>{
 assert.match(api,/FROM course_content_versions WHERE status='published'/);
 assert.match(api,/parseCourseDocument\(publishedSource\.payload_json\)/);
 assert.match(api,/const admittedSource=admittedPublishedDocument\?publishedSource:null/);
 assert.match(api,/admittedPublishedDocument\?\?document,admittedSource,analysisSource/);
 assert.match(api,/reviewed_by,reviewed_at,published_at/);
 assert.match(api,/AS last_analysis_lesson/);
 assert.match(api,/groundedSwimmingCorrections\(/);
 assert.match(api,/row\.last_analysis_lesson/);
 assert.match(api,/event\.lesson_number/);
 assert.match(details,/Đối chiếu giáo trình có kiểm duyệt/);
 assert.match(details,/analysis\.publishedGuidance/);
 assert.match(drafts,/citedGuidance/);
 assert.match(drafts,/Giảng viên kiểm tra lại kỹ thuật/);
 assert.doesNotMatch(source,/\bfetch\(|process\.env|openai|anthropic|gemini|modelProvider/);
});
