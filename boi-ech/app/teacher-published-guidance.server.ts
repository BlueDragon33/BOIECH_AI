import type {CourseDocument} from "./course-content.server";
import type {TeacherVideoAnalysis,TeacherPublishedGuidance} from "./teacher-video-result-details";

export type PublishedCurriculumSource={
 id:string;version_number:number;reviewed_by:string|null;
 reviewed_at:string|null;published_at:string|null;
};
export type PublishedTechniqueGuidance=TeacherPublishedGuidance;
/**
 * Only match against content ACTUALLY PUBLISHED and HUMAN REVIEWED in D1.
 * A static fallback lesson (or an unreviewed draft) is not an admitted KB.
 * This function neither invents exercises nor calls a model.
 */
export function groundedSwimmingCorrections(
 document:CourseDocument,meta:PublishedCurriculumSource|null|undefined,
 analysis:Pick<TeacherVideoAnalysis,"errors"|"topErrors">,
 lessonNumber:string,
):PublishedTechniqueGuidance[]{
 if(!meta||!meta.id||!Number.isSafeInteger(meta.version_number)||meta.version_number<1||
  !meta.reviewed_by||!meta.published_at||!Number.isFinite(Date.parse(meta.published_at))||
  !meta.reviewed_at||!Number.isFinite(Date.parse(meta.reviewed_at))||
  Date.parse(meta.reviewed_at)>Date.parse(meta.published_at)||!/^0[1-8]$/.test(lessonNumber))
  return [];
 const rows: {id:string;title:string;sign:string;fix:string;drill:string}[]=
  lessonNumber==="03"
   ?document.movement.mistakes.map(x=>({id:x.id,title:x.name,sign:x.sign,fix:x.fix,drill:x.drill}))
   :((document.foundationDetails as Record<string,CourseDocument["foundationDetails"]["01"]>)[lessonNumber]
      ?.mistakes??[]).map((x,i)=>({id:"mistake-"+(i+1),title:x.sign,sign:x.sign,fix:x.fix,drill:""}));
 const observations=[
  ...analysis.errors.map(x=>x.title+" "+x.observed),
  ...analysis.topErrors,
 ].join(" ").toLocaleLowerCase("vi");
 const generic=new Set(["sai","lỗi","động","tác","theo","trong","được","không",
   "những","video","phân","tích","cần","vấn","đề","phát","hiện","luyện","tập"]);
 const tokens=(value:string)=>value.toLocaleLowerCase("vi")
   .split(/[^\p{L}\p{N}]+/u).filter(token=>token.length>=3&&!generic.has(token));
 const words=new Set(tokens(observations));
 if(!words.size)return [];
 const scored=rows.map(x=>{
  const terms=new Set(tokens(x.title+" "+x.sign));
  const matching=[...terms].filter(t=>words.has(t)).length;
  return {x,matching};
 }).filter(row=>row.matching>0&&row.x.fix.trim().length>0)
  .sort((a,b)=>b.matching-a.matching||a.x.id.localeCompare(b.x.id))
  .slice(0,2);
 return scored.map(({x})=>({
  source:"published-course-content",versionId:meta.id,versionNumber:meta.version_number,
  reviewedBy:meta.reviewed_by!,publishedAt:meta.published_at!,
  lessonNumber,sourceItemId:x.id,title:x.title.slice(0,140),
  correction:x.fix.slice(0,300),practice:x.drill.slice(0,220)
 }));
}
