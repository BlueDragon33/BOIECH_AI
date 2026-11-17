import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import ts from "typescript";
const code=readFileSync(resolve("app/teacher-knowledge-retrieval-v43.ts"),"utf8");
const output=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const textCode=readFileSync(resolve("app/ai-search-text.ts"),"utf8");
const textOutput=ts.transpileModule(textCode,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const textModule={exports:{}};new Function("module","exports",textOutput)(textModule,textModule.exports);
const mod={exports:{}};new Function("require","module","exports",output)(name=>{
 assert.equal(name,"./ai-search-text");return textModule.exports;
},mod,mod.exports);
const {retrieveApprovedKnowledge}=mod.exports;
const doc={id:"stroke01",revision:2,approvedBy:"curriculum-reviewer",
 approvedAt:"2030-01-01T00:00:00Z",expiresAt:"2031-01-01T00:00:00Z",
 access:"teacher",curriculumCode:"boi-ech",lessonNumber:"03",
 citationLabel:"Kỹ thuật thu chân",sourceUri:"https://example.org/approved/curriculum",
 title:"Thu chân bơi ếch",text:"Hướng dẫn thu chân gọn và giữ ổn định tư thế.",
 active:true};
const options={documents:[doc],role:"teacher",curriculumCode:"boi-ech",lessonNumber:"03",
 query:"thu chân",now:"2030-06-06T00:00:00Z"};
test("no approved source means no made-up training guide and no model provider",()=>{
 assert.equal(retrieveApprovedKnowledge({...options,documents:[]}).mode,"unavailable");
 assert.deepEqual(retrieveApprovedKnowledge({...options,documents:[]}).hits,[]);
 assert.doesNotMatch(code,/\bfetch\(|\.prepare\(|process\.env|apiKey|modelProvider/);
});
test("approved teacher sees exact cited excerpt with revision and provenance",()=>{
 const r=retrieveApprovedKnowledge(options);
 assert.equal(r.mode,"approved-retrieval-only");
 assert.equal(r.hits.length,1);
 assert.equal(r.hits[0].revision,2);
 assert.equal(r.hits[0].approvedBy,"curriculum-reviewer");
 assert.equal(r.hits[0].sourceUri,doc.sourceUri);
 assert.match(r.hits[0].excerpt,/thu chân gọn/);
});
test("wrong role, wrong scope, expired or unapproved data never yield a hit",()=>{
 const variants=[
  {...options,role:"learner"},
  {...options,role:"manager"},
  {...options,lessonNumber:"01"},
  {...options,curriculumCode:"other"},
  {...options,documents:[{...doc,active:false}]},
  {...options,documents:[{...doc,expiresAt:"2029-01-01T00:00:00Z"}]},
  {...options,documents:[{...doc,approvedBy:""}]},
  {...options,documents:[{...doc,sourceUri:"javascript:alert(1)"}]}
 ];
 for(const v of variants)assert.deepEqual(retrieveApprovedKnowledge(v).hits,[]);
});
test("unrelated question produces zero sources; ordering is deterministic and capped",()=>{
 assert.deepEqual(retrieveApprovedKnowledge({...options,query:"sóng biển"}).hits,[]);
 const versions=Array.from({length:8},(_,i)=>({...doc,id:"e"+i,revision:i+1}));
 const r=retrieveApprovedKnowledge({...options,documents:versions,limit:3});
 assert.deepEqual(r.hits.map(x=>x.revision),[8,7,6]);
});

test("Vietnamese accents, decomposed Unicode and case retrieve the same original citation",()=>{
 const variants=["thu chân","THU CHAN","thu cha\u0302n"];
 const original=JSON.stringify(doc);
 for(const query of variants){
  const hit=retrieveApprovedKnowledge({...options,query}).hits[0];
  assert.equal(hit?.id,doc.id);
  assert.equal(hit.excerpt,doc.text);
  assert.equal(hit.citationLabel,doc.citationLabel);
 }
 assert.equal(JSON.stringify(doc),original);
 const kick={...doc,title:"Đạp chân",text:"Đạp rồi khép chân."};
 assert.equal(retrieveApprovedKnowledge({...options,documents:[kick],query:"DAP CHAN"}).hits[0]?.id,kick.id);
});

test("word boundaries do not turn an unrelated word into a matching technique",()=>{
 assert.deepEqual(retrieveApprovedKnowledge({...options,query:"chance"}).hits,[]);
 assert.deepEqual(retrieveApprovedKnowledge({...options,query:"thu chan",role:"manager"}).hits,[]);
});
