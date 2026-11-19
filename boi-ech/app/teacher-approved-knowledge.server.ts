import type {D1Database} from "@cloudflare/workers-types";
import {parseCourseDocument} from "./course-content.server";
import type {KnowledgeEntry} from "./teacher-knowledge-retrieval-v43";

/**
 * Uses ONLY an actual human-reviewed, published D1 curriculum. Never promote
 * the static fallback/draft to approved source. The requested URL is the
 * current application's verified origin, not a fabricated external article.
 */
type Published={id:string;version_number:number;payload_json:string;
 reviewed_by:string|null;reviewed_at:string|null;published_at:string|null};
export async function loadPublishedSwimKnowledge(
 db:D1Database,lessonNumber:string,origin:string,now=new Date().toISOString(),
):Promise<{entries:KnowledgeEntry[];version:{id:string;number:number;reviewedBy:string}|null;reason:string}>{
 const none=(reason:string)=>({entries:[],version:null,reason});
 if(!/^0[1-8]$/.test(lessonNumber))return none("Bài học không hợp lệ.");
 let sourceUri:string;
 try{const url=new URL(origin);if(url.protocol!=="https:"&&url.hostname!=="localhost")return none("Nguồn ứng dụng chưa xác minh HTTPS.");
  sourceUri=new URL("/",url).toString();
 }catch{return none("Địa chỉ nguồn ứng dụng không hợp lệ.");}
 const row=await db.prepare(`SELECT id,version_number,payload_json,reviewed_by,reviewed_at,published_at
  FROM course_content_versions
  WHERE status='published' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
  AND published_at IS NOT NULL ORDER BY version_number DESC LIMIT 1`).first<Published>();
 if(!row||!row.reviewed_by?.trim()||!row.reviewed_at||!row.published_at||
   !Number.isSafeInteger(row.version_number)||row.version_number<1||
   !Number.isFinite(Date.parse(row.reviewed_at))||!Number.isFinite(Date.parse(row.published_at))||
   Date.parse(row.reviewed_at)>Date.parse(row.published_at)||
   Date.parse(row.published_at)>Date.parse(now))
  return none("Không có giáo trình đã được người có thẩm quyền duyệt và xuất bản.");
 const document=parseCourseDocument(row.payload_json);
 if(!document)return none("Phiên bản xuất bản không qua kiểm tra dữ liệu nội dung.");
 const items:{section:string;title:string;text:string}[]=[];
 function add(section:string,title:string,text:string){
  if(typeof title==="string"&&typeof text==="string"&&title.trim()&&text.trim()){
   items.push({section,title:title.trim().slice(0,150),text:text.trim().slice(0,1500)});
  }
 }
 const outline=document.lessonOutlines[lessonNumber as keyof typeof document.lessonOutlines];
 if(outline){
  for(const [i,x] of outline.core.entries())add("core-"+i,x.title,x.body);
  for(const [i,x] of outline.practice.entries())add("practice-"+i,"Thực hành "+(i+1),x);
  for(const [i,x] of outline.objectives.entries())add("objective-"+i,"Mục tiêu "+(i+1),x);
 }
 if(lessonNumber==="03"){
  for(const [i,x] of document.movement.mistakes.entries())
   add("mistake-"+i,x.name,x.sign+"; Nguyên nhân: "+x.cause+"; Sửa: "+x.fix+"; Bài tập: "+x.drill);
  for(const [i,x] of document.movement.practice.entries())
   add("drill-"+i,x.name,x.goal+"; Khối lượng: "+x.volume);
  for(const [i,x] of document.movement.phases.entries())
   add("phase-"+i,x.title,x.action+"; Mục tiêu: "+x.purpose+"; Tránh: "+x.avoid);
 }else{
  const detail=document.foundationDetails[lessonNumber as keyof typeof document.foundationDetails];
  if(detail){
   add("safety",detail.safety.title,detail.safety.body);
   for(const [i,x] of detail.knowledge.entries())
    add("knowledge-"+i,x.title,x.body+"; Thực hiện: "+x.steps.join("; ")+"; Tránh: "+x.avoid);
   for(const [i,x] of detail.mistakes.entries())
    add("mistake-"+i,"Lỗi kỹ thuật "+(i+1),x.sign+"; Nguyên nhân: "+x.cause+"; Sửa: "+x.fix);
   for(const [i,x] of detail.drills.entries())
    add("drill-"+i,x.title,x.goal+"; Thực hiện: "+x.steps.join("; ")+"; An toàn: "+x.safety);
  }
 }
 // Short-lived retrieval lease (not claimed curriculum approval expiry).
 const lease=new Date(Date.parse(now)+120000).toISOString();
 const entries:KnowledgeEntry[]=items.slice(0,100).flatMap((item,i)=>
  (["teacher","manager"] as const).map(role=>({
   id:row.id+":"+lessonNumber+":"+item.section+":"+i,revision:row.version_number,
   approvedBy:row.reviewed_by!,approvedAt:row.reviewed_at!,expiresAt:lease,
   access:role,curriculumCode:"BREASTSTROKE-8",lessonNumber,
   citationLabel:"Giáo trình đã xuất bản · phiên bản "+row.version_number+
    " · Bài "+lessonNumber+" · "+item.section,
   // Link is only the current app entry; exact source is version+section above.
   sourceUri,title:item.title,text:item.text,active:true
  })));
 return {entries,version:{id:row.id,number:row.version_number,reviewedBy:row.reviewed_by},
  reason:"Giáo trình đã duyệt; đường dẫn mở ứng dụng, tham chiếu chính xác bằng ID phiên bản và mục."};
}
