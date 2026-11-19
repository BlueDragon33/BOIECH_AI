import {
 DeviceAccessError,getCourseDatabase,verifyDeviceRequest
} from "../../../device-auth.server";
import {loadPublishedSwimKnowledge} from "../../../teacher-approved-knowledge.server";
import {retrieveApprovedKnowledge} from "../../../teacher-knowledge-retrieval-v43";

export const dynamic="force-dynamic";
const approvedHosts=new Set([
 "boi-ech.boiech-ai.workers.dev","boi-ech-preview.boiech-ai.workers.dev",
 "localhost","terminal.local"
]);
function json(data:unknown,status=200){
 return Response.json(data,{status,headers:{"cache-control":"no-store, private",
  "x-content-type-options":"nosniff"}});
}
export async function POST(request:Request){
 try{
  const url=new URL(request.url);
  if(!approvedHosts.has(url.hostname)||!(url.protocol==="https:"||url.hostname==="localhost"||url.hostname==="terminal.local"))
   return json({error:"Nguồn ứng dụng không được phép tra cứu."},403);
  const payload=await request.json() as Record<string,unknown>;
  const preview=url.hostname==="localhost"||url.hostname==="terminal.local";
  const teacher=await verifyDeviceRequest(payload,preview);
  if(teacher.personRole!=="teacher"){
   throw new DeviceAccessError("Chỉ Giảng viên đã được xác thực mới xem nội dung chuyên môn.",403,"TEACHER_ROLE_REQUIRED",teacher);
  }
  if(!teacher.className?.trim()||teacher.className.trim()==="Chưa phân công")
   return json({error:"Giảng viên chưa được gán lớp phụ trách.",code:"TEACHER_CLASS_REQUIRED"},403);
  const lessonNumber=typeof payload.lessonNumber==="string"?payload.lessonNumber.trim():"";
  const query=typeof payload.query==="string"?payload.query.trim().replace(/[\u0000-\u001f\u007f]/g," ").slice(0,160):"";
  if(!/^0[1-8]$/.test(lessonNumber)||query.length<3)return json({error:"Cần bài học và từ khóa kỹ thuật hợp lệ."},400);
  const db=await getCourseDatabase();
  const now=new Date().toISOString();
  const published=await loadPublishedSwimKnowledge(db,lessonNumber,url.origin,now);
  const result=retrieveApprovedKnowledge({
   documents:published.entries,role:"teacher",curriculumCode:"BREASTSTROKE-8",
   lessonNumber,query,now,limit:3
  });
  // No personal data, raw video, secrets, paid model request or writes.
  return json({...result,sourceVersion:published.version,sourceReason:published.reason,
   personalDataReturned:false,mediaStored:false});
 }catch(error){
  if(error instanceof DeviceAccessError)
   return json({error:error.message,code:error.code},error.status);
  return json({error:"Chưa thể truy xuất giáo trình đã duyệt. Thử lại sau."},500);
 }
}
