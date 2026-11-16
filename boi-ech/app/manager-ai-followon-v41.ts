/**
 * Manager AI V41 follow-on: bounded, deterministic P1 / V41.1 / V41.2 / V41.3
 * No network, model call, persisted state, auto-decision, or privilege changes.
 *
 * Input is ONLY the already-scoped, signed manager TrainingBoard. This module
 * must not receive student video, chat contents or unrelated device metadata.
 */
import {
 classKey,classNames,
 type TrainingBoard,type TrainingPerson,type TrainingResource,type TrainingSession,
} from "./training-types";
import type {ManagerAiReport,ManagerAiEvidence} from "./manager-ai-evidence-v41";

export const MANAGER_AI_FOLLOWON_VERSION="manager-ai-followon-v41.1.0";
const parsed=(v:string)=>Date.parse(v);
const interval=(s:TrainingSession)=>({start:parsed(s.startsAt),end:parsed(s.endsAt)});
const eligibleTeacher=(p:TrainingPerson)=>p.role==="teacher"&&p.registered&&p.status==="approved"&&!p.expired;
function activeSessions(board:TrainingBoard):TrainingSession[]{
 return board.sessions.filter(s=>s.status!=="cancelled"&&
  Number.isFinite(parsed(s.startsAt))&&Number.isFinite(parsed(s.endsAt))&&parsed(s.endsAt)>parsed(s.startsAt));
}
function personIds(s:TrainingSession){
 return [s.teacherId,s.assistantTeacherId].filter((id):id is string=>typeof id==="string"&&id.length>0);
}
function overlaps(a:{start:number;end:number},b:{start:number;end:number}){
 return a.start<b.end&&b.start<a.end;
}
function reasons(a:TrainingSession,b:TrainingSession):Array<"teacher"|"class"|"room">{
 const sharedTeacher=personIds(a).some(id=>personIds(b).includes(id));
 return [
  ...(sharedTeacher?["teacher" as const]:[]),
  ...(a.classId===b.classId?["class" as const]:[]),
  ...(a.roomId===b.roomId?["room" as const]:[]),
 ];
}
export type ScheduleCollision={
 firstId:string;secondId:string;reasons:Array<"teacher"|"class"|"room">;
 firstStart:string;secondStart:string;
};
export type FullConflictScan={
 observedAt:string;from:string;to:string;scannedSessions:number;
 totalPairs:number;shownPairs:ScheduleCollision[];pairDisplayTruncated:boolean;
 sourcePotentiallyTruncated:boolean;coverageNote:string;
};
/** Enumerate ALL overlapping pairs inside the loaded board; UI limits display only.
 *  This does not claim completeness outside the server's potentially capped window.
 */
export function scanAllManagerConflicts(board:TrainingBoard,maxDisplayed=80):FullConflictScan{
 const source=activeSessions(board).sort((a,b)=>parsed(a.startsAt)-parsed(b.startsAt)||a.id.localeCompare(b.id));
 const collisions:ScheduleCollision[]=[];
 const max=Math.max(1,Math.min(300,Number.isFinite(maxDisplayed)?Math.floor(maxDisplayed):80));
 let total=0;
 for(let i=0;i<source.length;i++){
  const current=source[i],span=interval(current);
  for(let j=i+1;j<source.length;j++){
   const next=source[j];
   if(parsed(next.startsAt)>=span.end)break;
   if(!overlaps(span,interval(next)))continue;
   const reason=reasons(current,next);
   if(!reason.length)continue;
   total++;
   if(collisions.length<max){
    collisions.push({firstId:current.id,secondId:next.id,
     reasons:reason,firstStart:current.startsAt,secondStart:next.startsAt});
   }
  }
 }
 const possiblyCapped=board.sessions.length>=1000;
 return {observedAt:board.observedAt,from:board.from,to:board.to,scannedSessions:source.length,
  totalPairs:total,shownPairs:collisions,pairDisplayTruncated:total>collisions.length,
  sourcePotentiallyTruncated:possiblyCapped,
  coverageNote:possiblyCapped
   ?"Nguồn phiên học có thể bị giới hạn theo trang dữ liệu: KHÔNG khẳng định đã kiểm tra hết hệ thống."
   :"Đã đếm mọi cặp xung đột trong các buổi học hợp lệ của khoảng dữ liệu đang tải; không bao phủ dữ liệu ngoài khoảng này."};
}
export type TeacherCandidateReview={
 teacherId:string;displayName:string;currentClassLoad:number;alreadyAssigned:boolean;
 overlappingExistingSessions:number;classSessionsExamined:number;
 assessment:"conflict-found"|"not-verifiable"|"requires-qualification-review";
 evidenceIds:string[];limitations:string[];
};
export function reviewTeacherCandidates(board:TrainingBoard,classId:string,limit=30):TeacherCandidateReview[]{
 const klass=board.resources.find(x=>x.kind==="class"&&x.id===classId&&x.status==="active");
 if(!klass)return [];
 const activeClasses=new Set(board.resources.filter(x=>x.kind==="class"&&x.status==="active").map(x=>classKey(x.name)));
 const targetSessions=activeSessions(board).filter(x=>x.classId===classId);
 const cap=Math.max(1,Math.min(100,Number.isFinite(limit)?Math.floor(limit):30));
 return board.people.filter(eligibleTeacher).map((teacher):TeacherCandidateReview=>{
  const load=[...new Set(classNames(teacher.className).map(classKey).filter(k=>activeClasses.has(k)))];
  const teacherLessons=activeSessions(board).filter(s=>
    s.classId!==classId&&personIds(s).includes(teacher.id));
  const conflicting=teacherLessons.filter(existing=>targetSessions.some(target=>overlaps(interval(existing),interval(target))));
  return {teacherId:teacher.id,displayName:teacher.name,currentClassLoad:load.length,
   alreadyAssigned:load.includes(classKey(klass.name)),
   overlappingExistingSessions:conflicting.length,classSessionsExamined:targetSessions.length,
   assessment:conflicting.length?"conflict-found":targetSessions.length===0?"not-verifiable":"requires-qualification-review",
   evidenceIds:[...new Set([klass.id,...conflicting.map(s=>s.id)])].slice(0,12),
   limitations:["Chưa xác minh chứng chỉ/chuyên môn, giờ nghỉ hoặc nhiệm vụ ngoài hệ thống.",
    "Không có lịch trùng trong cửa sổ tải chưa chứng minh giảng viên luôn rảnh.",
    "Dữ liệu có thể bị giới hạn khi số phiên học vượt giới hạn API."]};
 }).sort((a,b)=>a.overlappingExistingSessions-b.overlappingExistingSessions||
   a.currentClassLoad-b.currentClassLoad||a.displayName.localeCompare(b.displayName,"vi")).slice(0,cap);
}
export type TrainingQualitySnapshot={
 observedAt:string;window:{from:string;to:string};
 learnerAccounts:{total:number;active:number;inactiveOrExpired:number;withoutActiveClass:number;unmatchedClass:number};
 sessions:{scheduled:number;completed:number;cancelled:number;invalidIntervals:number;total:number};
 classCoverage:{totalActive:number;withoutTeacher:number;overCapacity:number};
 unavailableDatasets:["videoProvenance","individualTechnique","messages","learningProgress","attendance"];
 explanation:string;
};
export function summarizeManagerTrainingQuality(board:TrainingBoard):TrainingQualitySnapshot{
 const learners=board.people.filter(p=>p.role==="learner");
 const validClasses=new Set(board.resources.filter(r=>r.kind==="class"&&r.status==="active").map(r=>classKey(r.name)));
 const activeClasses=board.resources.filter(r=>r.kind==="class"&&r.status==="active");
 const invalidIntervals=board.sessions.filter(s=>s.status!=="cancelled"&&
  (!Number.isFinite(parsed(s.startsAt))||!Number.isFinite(parsed(s.endsAt))||parsed(s.endsAt)<=parsed(s.startsAt))).length;
 const active=learners.filter(p=>p.registered&&p.status==="approved"&&!p.expired);
 const withoutActiveClass=active.filter(p=>!classNames(p.className).some(n=>validClasses.has(classKey(n))));
 const unmatched=active.filter(p=>classNames(p.className).length>0&&
  classNames(p.className).some(n=>!validClasses.has(classKey(n))));
 return {observedAt:board.observedAt,window:{from:board.from,to:board.to},
  learnerAccounts:{total:learners.length,active:active.length,inactiveOrExpired:learners.length-active.length,
   withoutActiveClass:withoutActiveClass.length,unmatchedClass:unmatched.length},
  sessions:{scheduled:board.sessions.filter(s=>s.status==="scheduled").length,
   completed:board.sessions.filter(s=>s.status==="completed").length,
   cancelled:board.sessions.filter(s=>s.status==="cancelled").length,invalidIntervals,total:board.sessions.length},
  classCoverage:{totalActive:activeClasses.length,
   withoutTeacher:activeClasses.filter(c=>c.missingTeachers>0).length,
   overCapacity:activeClasses.filter(c=>c.learnerCount>c.capacity).length},
  unavailableDatasets:["videoProvenance","individualTechnique","messages","learningProgress","attendance"],
  explanation:"Chỉ thống kê trạng thái hồ sơ/lớp/buổi đã được cấp quyền. Chưa có quyền hoặc dữ liệu để kết luận tiến bộ kỹ thuật, đọc tin nhắn hay phân tích video cá nhân."};
}
export type ScheduleOptionAssessment={
 state:"conflict"|"review-required"|"no-conflict-in-loaded-window"|"invalid";
 reason:string;sessionId:string;roomId:string;proposedStart:string;proposedEnd:string|null;
 overlappingSessions:string[];evidenceIds:string[];warnings:string[];
};
export function evaluateScheduleOption(board:TrainingBoard,sessionId:string,roomId:string,startsAt:string):ScheduleOptionAssessment{
 const original=board.sessions.find(s=>s.id===sessionId);
 const room=board.resources.find(r=>r.kind==="room"&&r.id===roomId);
 const error=(reason:string):ScheduleOptionAssessment=>({
  state:"invalid",reason,sessionId,roomId,proposedStart:startsAt,proposedEnd:null,
  overlappingSessions:[],evidenceIds:[],warnings:["Không thực thi hay lưu thay đổi trong bản mô phỏng."]});
 if(!original||original.status==="cancelled")return error("Buổi học không còn hợp lệ để xem xét.");
 const duration=parsed(original.endsAt)-parsed(original.startsAt);
 const start=parsed(startsAt),from=parsed(board.from),to=parsed(board.to);
 if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(start))return error("Thời gian buổi học hoặc thời gian mới không hợp lệ.");
 const end=start+duration;
 if(!Number.isFinite(from)||!Number.isFinite(to)||start<from||end>to)
  return error("Khung giờ nằm ngoài khoảng dữ liệu đã tải; không thể chứng minh phòng trống.");
 if(!room||room.status!=="active"||(room.parentId&&
   board.resources.find(x=>x.id===room.parentId)?.status!=="active"))
  return error("Phòng/bể không thuộc danh mục đang hoạt động.");
 const klass=board.resources.find(r=>r.kind==="class"&&r.id===original.classId&&r.status==="active");
 if(!klass)return error("Lớp không còn hoạt động.");
 const collisions=activeSessions(board).filter(s=>s.id!==original.id&&overlaps(interval(s),{start,end})&&(
   s.roomId===roomId||s.classId===original.classId||personIds(s).some(id=>personIds(original).includes(id))
 ));
 const risks:string[]=[];
 if(klass.learnerCount>room.capacity)
  risks.push("Sĩ số lớp lớn hơn sức chứa cấu hình của phòng; không biết số người thực tế tham dự.");
 if(board.sessions.length>=1000)
  risks.push("Nguồn lịch có thể bị giới hạn ở 1.000 bản ghi; còn xung đột chưa kiểm tra.");
 risks.push("Chưa xác minh khả năng sử dụng bể, thiết bị, sức khỏe, chuyên môn hoặc ngoại lệ vận hành.");
 const state=collisions.length?"conflict":risks.length>1?"review-required":"no-conflict-in-loaded-window";
 return {state,reason:collisions.length?"Có các buổi học trùng nguồn lực trong khoảng đề xuất.":
   state==="review-required"?"Không phát hiện xung đột lịch trong dữ liệu đã tải, nhưng còn điều kiện phải kiểm tra.":
   "Không phát hiện xung đột lịch trong khoảng dữ liệu đang tải; cần cán bộ xác minh trước quyết định.",
  sessionId,roomId,proposedStart:new Date(start).toISOString(),proposedEnd:new Date(end).toISOString(),
  overlappingSessions:collisions.map(s=>s.id).sort(),evidenceIds:[original.id,room.id,klass.id,...collisions.map(s=>s.id)],
  warnings:risks};
}
export function compareRoomOptions(board:TrainingBoard,sessionId:string,startsAt:string,max=8):ScheduleOptionAssessment[]{
 const maxSize=Math.max(1,Math.min(20,Number.isFinite(max)?Math.floor(max):8));
 return board.resources.filter(r=>r.kind==="room"&&r.status==="active")
  .map(r=>evaluateScheduleOption(board,sessionId,r.id,startsAt))
  .sort((a,b)=>({["no-conflict-in-loaded-window"]:0,["review-required"]:1,conflict:2,invalid:3}[a.state]-
    {["no-conflict-in-loaded-window"]:0,["review-required"]:1,conflict:2,invalid:3}[b.state])||a.roomId.localeCompare(b.roomId))
  .slice(0,maxSize);
}
export type EvidenceHealth={
 findingCount:number;withReferences:number;resolvableReferences:number;totalReferences:number;
 missingEvidenceIds:string[];duplicateFindingIds:string[];
 referenceCoveragePercent:number|null;resolvableReferencePercent:number|null;
 sourcePotentiallyTruncated:boolean;notAnAccuracyScore:true;
};
export function auditManagerEvidence(board:TrainingBoard,report:ManagerAiReport):EvidenceHealth{
 const ids=new Set<string>(),dups:string[]=[];
 const resources=new Set(board.resources.map(r=>r.id));
 const people=new Set(board.people.map(p=>p.id));
 const sessions=new Set(board.sessions.map(s=>s.id));
 const terms=new Set(board.teacherClassTerms.map(t=>t.teacherDeviceId+":"+t.classId));
 const map:{[K in ManagerAiEvidence["source"]]:Set<string>}={resources,people,sessions,teacherClassTerms:terms};
 let withReferences=0,totalReferences=0,resolvableReferences=0;
 const missing:string[]=[];
 for(const finding of report.findings){
  if(ids.has(finding.id))dups.push(finding.id);ids.add(finding.id);
  if(finding.evidence.length)withReferences++;
  for(const citation of finding.evidence){
   totalReferences++;
   if(map[citation.source].has(citation.recordId)&&citation.observedAt===board.observedAt)
    resolvableReferences++;
   else missing.push(finding.id+":"+citation.source+":"+citation.recordId);
  }
 }
 return {findingCount:report.findings.length,withReferences,resolvableReferences,totalReferences,
  missingEvidenceIds:missing.slice(0,30),duplicateFindingIds:dups,
  referenceCoveragePercent:report.findings.length?Math.round(100*withReferences/report.findings.length):null,
  resolvableReferencePercent:totalReferences?Math.round(100*resolvableReferences/totalReferences):null,
  sourcePotentiallyTruncated:board.sessions.length>=1000||report.truncated,notAnAccuracyScore:true};
}
export type CapabilityStatus={name:string;status:"implemented"|"unavailable"|"approval-required";reason:string};
export const MANAGER_AI_FUTURE_CAPABILITIES:readonly CapabilityStatus[]=[
 {name:"Phân tích video và tiến bộ cá nhân",status:"unavailable",reason:"Không có luồng video và kết quả kỹ thuật được cấp quyền cho cán bộ trong TrainingBoard."},
 {name:"Tóm tắt nội dung hội thoại",status:"unavailable",reason:"Không đọc tin nhắn cá nhân; cần kiểm toán phạm vi và quyền riêng tư."},
 {name:"Tối ưu phân công theo chứng chỉ",status:"unavailable",reason:"Chưa có dữ liệu chuyên môn/chứng chỉ và lịch ngoài hệ thống."},
 {name:"AI tạo sinh hoặc mô hình dự báo",status:"approval-required",reason:"Chưa có model provider, ngân sách, giới hạn dữ liệu, tiêu chí đánh giá và quyền Owner."},
 {name:"Knowledge Base tài liệu nội bộ",status:"approval-required",reason:"Chưa có bộ tài liệu đã được phê duyệt, phiên bản nguồn và quyền tra cứu."},
 {name:"Thực thi sau phê duyệt",status:"approval-required",reason:"Phải qua kiểm tra quyền hiện hành, CAS, nhật ký và rollback trên máy chủ; phiên này chỉ đọc."},
];
