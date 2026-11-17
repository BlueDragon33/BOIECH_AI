/**
 * Pure, OFF-by-default grounding for future human-approved swim curriculum.
 * No model provider, network traffic, retrieved private data, autonomous coaching,
 * or publication of unapproved knowledge.
 */
import {normalizeAiSearchText} from "./ai-search-text";

export type KnowledgeEntry={
 id:string;revision:number;approvedBy:string;approvedAt:string;expiresAt:string;
 access:"teacher"|"manager";curriculumCode:string;lessonNumber:string;
 citationLabel:string;sourceUri:string;title:string;text:string;active:boolean;
};
export type KnowledgeHit={id:string;revision:number;title:string;excerpt:string;
 citationLabel:string;sourceUri:string;approvedBy:string;approvedAt:string;};
export type KnowledgeResult={
 mode:"unavailable"|"approved-retrieval-only";
 hits:KnowledgeHit[];limitations:string[];
};
const safe=(value:unknown,max:number)=>typeof value==="string"
 ?value.replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max):"";
const validDate=(value:string)=>typeof value==="string"&&Number.isFinite(Date.parse(value));
const words=(text:string)=>[...new Set(normalizeAiSearchText(text).split(/[^a-z0-9]+/).filter(x=>x.length>=3))];
export function retrieveApprovedKnowledge(input:{
 documents:readonly KnowledgeEntry[]|null;
 role:"teacher"|"manager"|"learner";curriculumCode:string;
 lessonNumber:string;query:string;now:string;limit?:number;
}):KnowledgeResult{
 const unavailable=(reason:string):KnowledgeResult=>({mode:"unavailable",hits:[],limitations:[reason]});
 if(!input.documents?.length)return unavailable("Chưa có tài liệu giáo trình được duyệt và cấp quyền.");
 if(!validDate(input.now)||!input.curriculumCode||!/^0[1-8]$/.test(input.lessonNumber))
  return unavailable("Không đủ căn cứ lớp học, bài học hoặc thời gian.");
 if(input.role!=="teacher"&&input.role!=="manager")return unavailable("Tài khoản không được phép đọc tài liệu chuyên môn.");
 const keywords=words(safe(input.query,320)).slice(0,12);
 if(!keywords.length)return unavailable("Chưa có từ khóa kỹ thuật đủ cụ thể để đối chiếu.");
 const eligible=input.documents.filter(doc=>doc.active&&doc.access===input.role&&
  doc.curriculumCode===input.curriculumCode&&doc.lessonNumber===input.lessonNumber&&
  Number.isSafeInteger(doc.revision)&&doc.revision>0&&
  Boolean(safe(doc.approvedBy,100)&&safe(doc.citationLabel,120)&&safe(doc.sourceUri,240))&&
  /^https:\/\//.test(doc.sourceUri)&&validDate(doc.approvedAt)&&validDate(doc.expiresAt)&&
  Date.parse(doc.approvedAt)<=Date.parse(input.now)&&Date.parse(doc.expiresAt)>Date.parse(input.now));
 const ranked=eligible.map(doc=>{
  const text=new Set(words(safe(doc.title+" "+doc.text,2000)));
  return {doc,score:keywords.filter(word=>text.has(word)).length};
 }).filter(item=>item.score>0)
  .sort((a,b)=>b.score-a.score||b.doc.revision-a.doc.revision||a.doc.id.localeCompare(b.doc.id))
  .slice(0,Math.max(1,Math.min(5,Math.floor(input.limit??3))));
 return {mode:ranked.length?"approved-retrieval-only":"unavailable",
  hits:ranked.map(({doc})=>({id:doc.id,revision:doc.revision,title:safe(doc.title,150),
   excerpt:safe(doc.text,420),citationLabel:safe(doc.citationLabel,120),
   sourceUri:doc.sourceUri,approvedBy:safe(doc.approvedBy,100),approvedAt:doc.approvedAt})),
  limitations:[
   "Chỉ trích xuất nguyên văn từ mục giáo trình đã duyệt, không suy luận kiến thức thiếu.",
   "Giảng viên cần xem bản gốc và xác nhận bài tập phù hợp tại bể; không có lời khuyên tự động.",
   "Kết quả không thay thế đánh giá trực tiếp về an toàn bơi."
  ]};
}
