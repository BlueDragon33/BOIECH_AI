import {DeviceAccessError,deviceErrorResponse,getCourseDatabase,verifyDeviceRequest} from "../../device-auth.server";
import {requireManager} from "../../training-management.server";
import {loadPublishedSwimKnowledge} from "../../teacher-approved-knowledge.server";
import {retrieveApprovedKnowledge} from "../../teacher-knowledge-retrieval-v43";
import {sanitizeCoachingQuestion,readModelPolicy,generateCitedSwimmingDraft} from "../../teacher-llm-budget-v44.server";

export const dynamic="force-dynamic";
const respond=(data:unknown,status=200)=>Response.json(data,{status,
 headers:{"cache-control":"no-store, private","x-content-type-options":"nosniff"}});
/**
 * Signed, no-media, human-reviewed lesson drafting. The only permitted remote
 * data is an explicitly approved short NON-PII question and cited published
 * curriculum extracts; disabled by default, no autonomous student messaging.
 */
export async function POST(request:Request){
 try{
  const raw=await request.text();
  if(raw.length>4096)return respond({error:"Vượt giới hạn yêu cầu AI."},413);
  const payload=JSON.parse(raw) as Record<string,unknown>;
  if(!payload||typeof payload!=="object"||Array.isArray(payload))
   return respond({error:"Yêu cầu không hợp lệ."},400);
  const identity=await verifyDeviceRequest(payload,false);
  if(identity.personRole!=="teacher"&&identity.personRole!=="manager")
   throw new DeviceAccessError("Chỉ giảng viên/cán bộ được soạn tài liệu chuyên môn.",403,"COACH_ROLE_REQUIRED",identity);
  if(identity.personRole==="manager")requireManager(identity);
  if(payload.action!=="search"&&payload.action!=="draft")
   return respond({error:"Thao tác AI không hợp lệ."},400);
  if(typeof payload.lessonNumber!=="string"||!/^0[1-8]$/.test(payload.lessonNumber))
   return respond({error:"Chọn Bài 01–08 hợp lệ."},400);
  const query=sanitizeCoachingQuestion(payload.query);
  if(!query)return respond({error:"Chỉ nhập câu hỏi kỹ thuật ngắn, không chứa danh tính, hộ chiếu, email, số liên lạc hoặc bí mật."},400);
  const db=await getCourseDatabase();
  const corpus=await loadPublishedSwimKnowledge(db,payload.lessonNumber,new URL(request.url).origin);
  const retrieval=retrieveApprovedKnowledge({documents:corpus.entries,
   role:identity.personRole,curriculumCode:"BREASTSTROKE-8",lessonNumber:payload.lessonNumber,
   query,now:new Date().toISOString(),limit:4});
  if(retrieval.mode==="unavailable")
   return respond({mode:"unavailable",publishedVersion:null,sourceNote:corpus.reason,
    hits:[],draft:null,limitations:retrieval.limitations,requiresTeacherApproval:true,sent:false});
  if(payload.action==="search")
   return respond({mode:"approved-retrieval-only",publishedVersion:corpus.version,sourceNote:corpus.reason,
    hits:retrieval.hits,draft:null,limitations:retrieval.limitations,
    requiresTeacherApproval:true,sent:false});
  const policy=await readModelPolicy();
  const result=await generateCitedSwimmingDraft(db,policy,query,retrieval.hits);
  return respond({mode:result.status==="draft"?"model-draft":"approved-retrieval-only",
   providerStatus:result.status,publishedVersion:corpus.version,sourceNote:corpus.reason,
   hits:retrieval.hits,draft:result.text,limitations:retrieval.limitations,
   requiresTeacherApproval:true,sent:false});
 }catch(error){
  if(error instanceof SyntaxError)return respond({error:"Dữ liệu JSON không hợp lệ."},400);
  if(error instanceof DeviceAccessError)return deviceErrorResponse(error);
  return respond({error:"Không xác minh được giáo trình hoặc chính sách AI; không sinh nội dung tự động.",
   code:"COACH_UNAVAILABLE"},503);
 }
}
