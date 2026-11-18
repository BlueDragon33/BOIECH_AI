/**
 * Manager AI V41.0-P0 — deterministic, evidence-backed operational intelligence.
 *
 * This is NOT a generative model. It is a bounded, explainable reasoning layer
 * over the already authenticated training-management board. It has no network,
 * secrets, persistence, pricing, privilege escalation or mutation capability.
 * Any future model adapter must be separately approved, scoped and audited.
 */
import {classKey,classNames,type TrainingBoard,type TrainingPerson,type TrainingSession,type TrainingResource} from "./training-types";

export const MANAGER_AI_ENGINE_VERSION="manager-ai-evidence-v41.0.0";
export type ManagerAiArea="staff"|"class"|"schedule"|"rooms"|"quality";
export type ManagerAiPriority="critical"|"high"|"medium"|"info";
export type ManagerAiDestination="people"|"class"|"schedule"|"room";
export type ManagerAiEvidence={source:"resources"|"people"|"sessions"|"teacherClassTerms";recordId:string;fields:string;observedAt:string};
export type ManagerAiFinding={
 id:string;area:ManagerAiArea;priority:ManagerAiPriority;title:string;details:string;
 recommendedAction:string;target:ManagerAiDestination;evidence:ManagerAiEvidence[];
 limitations:string[];
};
export type ManagerAiReport={
 engineVersion:typeof MANAGER_AI_ENGINE_VERSION;engineMode:"rules-only";generativeAiActive:false;
 observedAt:string;window:{from:string;to:string};coverage:{classes:number;teachers:number;rooms:number;sessions:number};
 findings:ManagerAiFinding[];totalFindings:number;truncated:boolean;conflictExamplesLimited:boolean;
 counts:{critical:number;high:number;medium:number;info:number};
};
const weights:Record<ManagerAiPriority,number>={critical:0,high:1,medium:2,info:3};
const activeTeacher=(p:TrainingPerson)=>p.role==="teacher"&&p.registered&&p.status==="approved"&&!p.expired;
const validSessionTime=(s:TrainingSession)=>Number.isFinite(Date.parse(s.startsAt))&&
 Number.isFinite(Date.parse(s.endsAt))&&Date.parse(s.endsAt)>Date.parse(s.startsAt);
const activeSessions=(b:TrainingBoard)=>(b.sessions??[]).filter(s=>s.status!=="cancelled"&&validSessionTime(s));
function teacherClassMap(board:TrainingBoard){
 const classes=(board.resources??[]).filter(r=>r.kind==="class"&&r.status==="active");
 const keyed=new Set(classes.map(r=>classKey(r.name)));
 const map=new Map<string,string[]>();
 for(const teacher of (board.people??[]).filter(p=>p.role==="teacher")){
  map.set(teacher.id,[...new Set(classNames(teacher.className).map(classKey).filter(n=>keyed.has(n)))]);
 }
 return map;
}
function citation(source:ManagerAiEvidence["source"],recordId:string,fields:string,board:TrainingBoard):ManagerAiEvidence{
 return {source,recordId,fields,observedAt:board.observedAt};
}
function sessionConflicts(board:TrainingBoard){
 // A bounded sweep detects conflict *examples*. It does not claim to count
 // every colliding pair in a dense schedule.
 const index=new Map<string,TrainingSession[]>();
 for(const s of activeSessions(board)){
  for(const [kind,id] of [["teacher",s.teacherId],["assistant",s.assistantTeacherId],["room",s.roomId],["class",s.classId]]){
   if(!id)continue;
   const key=(kind==="teacher"||kind==="assistant"?"teacher":kind)+":"+id;
   const values=index.get(key)??[];values.push(s);index.set(key,values);
  }
 }
 const results=new Map<string,{a:TrainingSession;b:TrainingSession;reasons:Set<string>}>();
 for(const [key,list] of index){
  const ordered=[...list].sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)||a.id.localeCompare(b.id));
  let latest:TrainingSession|undefined;
  for(const item of ordered){
   if(latest&&latest.id!==item.id&&Date.parse(latest.endsAt)>Date.parse(item.startsAt)){
    const id=[latest.id,item.id].sort().join("|");
    const row=results.get(id)??{a:latest,b:item,reasons:new Set<string>()};
    row.reasons.add(key.split(":")[0]);results.set(id,row);
   }
   if(!latest||Date.parse(latest.endsAt)<Date.parse(item.endsAt))latest=item;
  }
 }
 return [...results.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([id,row])=>({id,...row,reasons:[...row.reasons].sort()}));
}
function added(list:ManagerAiFinding[],finding:ManagerAiFinding){list.push(finding);}
export function analyzeManagerBoard(board:TrainingBoard,limit=40):ManagerAiReport{
 const sources=board.resources??[],persons=board.people??[],sessions=activeSessions(board);
 const classes=sources.filter(r=>r.kind==="class"&&r.status==="active");
 const teachers=persons.filter(p=>p.role==="teacher");
 const rooms=sources.filter(r=>r.kind==="room");
 const byId=new Map(sources.map(r=>[r.id,r]));
 const teacherLoads=teacherClassMap(board);
 const out:ManagerAiFinding[]=[];
 const available=teachers.filter(activeTeacher).filter(p=>(teacherLoads.get(p.id)?.length??0)===0);
 const unassigned=available.length;
 for(const c of classes){
  if(c.learnerCount>c.capacity){
   added(out,{id:"capacity:"+c.id,area:"class",priority:"critical",
    title:"Lớp "+c.name+" vượt sĩ số",
    details:"Đang ghi nhận "+c.learnerCount+" học viên, sức chứa "+c.capacity+"; vượt "+(c.learnerCount-c.capacity)+".",
    recommendedAction:"Kiểm tra danh sách học viên và khả năng điều chỉnh sĩ số trước khi tiếp tục bố trí.",
    target:"class",evidence:[citation("resources",c.id,"learnerCount,capacity,status",board)],
    limitations:["Sức chứa là cấu hình quản lý; chưa chứng minh sức chứa an toàn thực tế của bể."]});
  }
  if(c.missingTeachers>0){
   added(out,{id:"staff-shortage:"+c.id,area:"staff",priority:"high",
    title:"Lớp "+c.name+" thiếu "+c.missingTeachers+" giảng viên",
    details:"Đang phân công "+c.teacherCount+"/"+c.requiredTeachers+" giảng viên hợp lệ. "+
      (unassigned?("Có "+unassigned+" giảng viên đủ điều kiện tài khoản nhưng hiện chưa có lớp hoạt động."):"Chưa tìm thấy giảng viên chưa có lớp hoạt động trong dữ liệu hiện tại."),
    recommendedAction:"Đối chiếu chuyên môn, thời gian và quyết định phân công. Không tự điều chuyển.",
    target:"people",evidence:[citation("resources",c.id,"teacherCount,requiredTeachers,missingTeachers",board)],
    limitations:["Chưa có ma trận năng lực/chứng chỉ; không thể xác nhận người thay thế phù hợp."]});
  }
 }
 if(unassigned>0)added(out,{id:"unassigned-teachers",area:"staff",priority:"medium",
  title:unassigned+" giảng viên chưa có lớp hoạt động",
  details:"Các tài khoản đã đăng ký, được duyệt và còn hạn nhưng chưa khớp lớp hoạt động.",
  recommendedAction:"Kiểm tra nguồn nhân lực và lịch trước khi phân công các lớp đang thiếu.",
  target:"people",evidence:available.slice(0,4).map(p=>citation("people",p.id,"role,status,registered,expired,className",board)),
  limitations:["Không có lớp hoạt động không có nghĩa là nhân sự rảnh hoàn toàn; có thể có nhiệm vụ ngoài hệ thống."]});
 // Historical account identity does not prove current teaching authorization.
 const teacherSet=new Set(teachers.filter(activeTeacher).map(t=>t.id));
 for(const s of (board.sessions??[]).filter(item=>item.status!=="cancelled"&&!validSessionTime(item))){
  added(out,{id:"invalid-schedule-time:"+s.id,area:"quality",priority:"high",
   title:"Buổi học "+(s.title||s.id)+" có mốc thời gian cần sửa",
   details:"Thời điểm bắt đầu/kết thúc không xác minh được hoặc thứ tự giờ sai. Buổi này không được đưa vào kiểm tra trùng lịch.",
   recommendedAction:"Mở Lịch học, kiểm tra giờ bắt đầu/kết thúc và tải lại trước khi xác nhận lịch.",
   target:"schedule",evidence:[citation("sessions",s.id,"startsAt,endsAt,status",board)],
   limitations:["Không có đủ mốc thời gian hợp lệ để kết luận buổi này không trùng lịch với các buổi khác."]});
 }
 const flaggedRoomCapacity=new Set<string>();
 for(const s of sessions){
  const klass=byId.get(s.classId),room=byId.get(s.roomId);
  if(!room||room.kind!=="room"||room.status!=="active"||
     room.parentId && byId.get(room.parentId)?.status!=="active"){
   added(out,{id:"room-unavailable:"+s.id,area:"rooms",priority:"high",
    title:"Phòng/bể của buổi "+(s.title||s.id)+" cần xác minh",
    details:"Lịch đã xếp đang dùng phòng không có trong danh mục đang hoạt động, hoặc tòa chứa phòng không còn hoạt động.",
    recommendedAction:"Mở Phòng học để xác minh tài nguyên và sắp xếp lại nếu cần.",
    target:"room",evidence:[citation("sessions",s.id,"roomId,classId,startsAt,endsAt,status",board),
      ...(room?[citation("resources",room.id,"kind,status,parentId",board)]:[])],
    limitations:["Phòng bị ghi không hoạt động không tự hủy buổi học hoặc chứng minh việc học đã diễn ra."]});
  }else if(klass?.kind==="class"&&klass.status==="active"&&klass.learnerCount>room.capacity){
   const pair=klass.id+":"+room.id;
   if(!flaggedRoomCapacity.has(pair)){
    flaggedRoomCapacity.add(pair);
    added(out,{id:"room-capacity:"+pair,area:"rooms",priority:"medium",
     title:"Cần đối chiếu sức chứa phòng "+room.name,
     details:"Lớp "+klass.name+" ghi nhận "+klass.learnerCount+" học viên; cấu hình phòng là "+room.capacity+" chỗ.",
     recommendedAction:"Đối chiếu số học viên thực tế tham gia buổi và giới hạn an toàn của phòng/bể.",
     target:"room",evidence:[citation("resources",klass.id,"learnerCount,status",board),
       citation("resources",room.id,"capacity,status",board)],
     limitations:["Sĩ số lớp không chứng minh tất cả học viên có mặt cùng một buổi; sức chứa cấu hình không thay cho kiểm định an toàn."]});
   }
  }
  if(!klass||klass.kind!=="class"||klass.status!=="active"||
     !room||room.kind!=="room"||room.status!=="active"||
     !teacherSet.has(s.teacherId)){
    added(out,{id:"broken-session:"+s.id,area:"schedule",priority:"high",
     title:"Buổi học "+(s.title||s.id)+" cần đối chiếu dữ liệu",
     details:"Có lớp, phòng hoặc giảng viên không còn khớp danh mục hoạt động.",
     recommendedAction:"Kiểm tra lớp, phòng và người phụ trách trước khi xác nhận lịch.",
     target:"schedule",evidence:[citation("sessions",s.id,"classId,roomId,teacherId,status",board)],
     limitations:["Không tự kết luận buổi học bị hủy hoặc sai về mặt nghiệp vụ."]});
  }
 }
 const allConflictExamples=sessionConflicts(board);
 for(const conflict of allConflictExamples.slice(0,30)){
  added(out,{id:"conflict:"+conflict.id,area:"schedule",priority:"critical",
   title:"Hai buổi học có dấu hiệu trùng lịch",
   details:"Các buổi “"+conflict.a.title+"” và “"+conflict.b.title+
    "” giao nhau theo "+conflict.reasons.map(r=>r==="teacher"?"giảng viên":r==="room"?"phòng học":"lớp").join(", ")+".",
   recommendedAction:"Mở lịch để xác minh ca thực tế và chọn phương án đổi phòng hoặc thời gian.",
   target:"schedule",
   evidence:[citation("sessions",conflict.a.id,"startsAt,endsAt,teacherId,assistantTeacherId,classId,roomId,status",board),
     citation("sessions",conflict.b.id,"startsAt,endsAt,teacherId,assistantTeacherId,classId,roomId,status",board)],
   limitations:["Đây là đối chiếu giao nhau theo mốc thời gian; không tự giải quyết, chưa xét quy chế ngoại lệ."]});
 }
 const now=Date.parse(board.observedAt);
 if(Number.isFinite(now)){
  for(const term of board.teacherClassTerms??[]){
   if(term.endedAt||!term.plannedEndAt||!Number.isFinite(Date.parse(term.plannedEndAt))||Date.parse(term.plannedEndAt)>now)continue;
   const teacher=teachers.find(p=>p.id===term.teacherDeviceId),klass=classes.find(c=>c.id===term.classId);
   if(!teacher||!klass||!(teacherLoads.get(teacher.id)||[]).includes(classKey(klass.name)))continue;
   added(out,{id:"term-ended:"+teacher.id+":"+klass.id,area:"staff",priority:"medium",
    title:"Cần rà soát thời hạn phân công lớp "+klass.name,
    details:"Mốc kết thúc dự kiến đã qua theo dữ liệu được ghi nhận; chưa có xác nhận kết thúc phân công.",
    recommendedAction:"Kiểm tra quyết định và gia hạn/điều chỉnh mốc qua hồ sơ Nhân sự.",
    target:"people",evidence:[citation("teacherClassTerms",term.teacherDeviceId+":"+term.classId,"plannedEndAt,endedAt,version",board)],
    limitations:["Ngày dự kiến không đồng nghĩa phân công tự hết hiệu lực."]});
  }
 }
 const sorted=out.sort((a,b)=>weights[a.priority]-weights[b.priority]||a.id.localeCompare(b.id));
 const capped=Math.max(1,Math.min(100,Math.floor(Number.isFinite(limit)?limit:40)));
 const counts={critical:0,high:0,medium:0,info:0};
 for(const f of sorted)counts[f.priority]++;
 return {engineVersion:MANAGER_AI_ENGINE_VERSION,engineMode:"rules-only",generativeAiActive:false,
  observedAt:board.observedAt,window:{from:board.from,to:board.to},
  coverage:{classes:classes.length,teachers:teachers.length,rooms:rooms.length,sessions:sessions.length},
  findings:sorted.slice(0,capped),totalFindings:sorted.length,
  truncated:sorted.length>capped||allConflictExamples.length>30,
  conflictExamplesLimited:allConflictExamples.length>30,counts};
}
function normalize(text:string){return text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").toLowerCase().replace(/\s+/g," ").trim();}
export type ManagerAiAnswer={kind:"evidence-answer"|"unsupported";title:string;answer:string;references:ManagerAiEvidence[];disclaimer:string};
export function answerManagerQuestion(question:string,report:ManagerAiReport):ManagerAiAnswer{
 const q=normalize(question.slice(0,350));
 // Manager questions never authorize a mutation. Refuse imperative requests
 // before intent matching (e.g. "hãy đổi lớp" must not become a class report).
 if(/\b(xoa|sua|chuyen|doi|cap quyen|tu dong|thuc hien|khoa tai khoan)\b/.test(q)){
  return {kind:"unsupported",title:"Chỉ phân tích, không thực thi lệnh quản trị",
   answer:"Không tự suy đoán hoặc thực hiện thay đổi dữ liệu. Nếu muốn phân công, đổi lịch hay cập nhật tài khoản, hãy mở phân hệ phù hợp để cán bộ xem xét và phê duyệt.",
   references:[],disclaimer:"V41.0 không có quyền tự thực thi hoặc cấp quyền quản trị."};
 }
 const groups:[string,ManagerAiArea[]][]=[
  ["nhan su",["staff"]],["giang vien",["staff"]],["thieu nguoi",["staff"]],
  ["lop",["class","staff"]],["si so",["class"]],["qua tai",["class"]],
  ["lich",["schedule"]],["trung",["schedule"]],["phong",["rooms","schedule"]],
  ["can xu ly",["staff","class","schedule","rooms","quality"]],
  ["hom nay",["staff","class","schedule","rooms","quality"]],
  ["tong quan",["staff","class","schedule","rooms","quality"]]
 ];
 const matched=groups.find(([key])=>q.includes(key));
 const disclaimer="Kết quả chỉ dựa trên snapshot có phân quyền; không phải quyết định quản trị hoặc dự báo của mô hình AI tạo sinh.";
 if(!q||!matched)return {kind:"unsupported",title:"Câu hỏi chưa thuộc phạm vi V41.0",
  answer:"V41.0 hỗ trợ câu hỏi về thiếu giảng viên, sĩ số, lịch trùng và công việc cần xử lý. Không tự suy đoán về dữ liệu khác; chọn câu gợi ý để xem bằng chứng.",
  references:[],disclaimer};
 const related=report.findings.filter(f=>matched[1].includes(f.area)).slice(0,5);
 if(!related.length&&report.truncated)return {kind:"unsupported",
  title:"Chưa đủ dữ liệu đang hiển thị để kết luận",
  answer:"Danh sách AI chỉ hiển thị "+report.findings.length+"/"+report.totalFindings+
   " tín hiệu tổng hợp. "+(report.conflictExamplesLimited?"Mẫu trùng lịch bị giới hạn ở 30 trường hợp; ":"")+
   "Cảnh báo của chủ đề này có thể nằm ngoài giới hạn hiển thị. Hãy thu hẹp khoảng xem và tải lại trước khi kết luận.",
  references:[],disclaimer};
 const partialNote=report.truncated?
  "\nLưu ý: báo cáo đang giới hạn ở "+report.findings.length+"/"+report.totalFindings+
  " tín hiệu tổng hợp."+(report.conflictExamplesLimited?" Bộ phát hiện chỉ trình bày tối đa 30 mẫu trùng lịch.":"")+
  " Câu trả lời chưa bao phủ toàn bộ cảnh báo.":"";
 return {kind:"evidence-answer",title:related.length?"Phân tích từ dữ liệu điều hành":"Chưa phát hiện vấn đề theo bộ quy tắc hiện tại",
  answer:(related.length?related.map((f,i)=>(i+1)+". "+f.title+". "+f.details+" Đề xuất: "+f.recommendedAction).join("\n"):
   "Không phát hiện cảnh báo thuộc chủ đề này trong khoảng dữ liệu đã tải. Điều đó không chứng minh không có rủi ro ngoài hệ thống.")+partialNote,
  references:related.flatMap(f=>f.evidence).slice(0,12),disclaimer};
}
export function simulateTeacherAllocation(board:TrainingBoard,classId:string,teacherId:string){
 const klass=board.resources.find(c=>c.id===classId&&c.kind==="class"&&c.status==="active");
 const teacher=board.people.find(p=>p.id===teacherId&&p.role==="teacher");
 if(!klass||!teacher)return {valid:false,reason:"Không tìm thấy lớp hoặc giảng viên hoạt động trong dữ liệu đã xác thực.",proposedClassLoad:null,limitations:[] as string[]};
 if(!activeTeacher(teacher))return {valid:false,reason:"Giảng viên chưa đủ điều kiện tài khoản. Không thể đề xuất phân công.",proposedClassLoad:null,limitations:[] as string[]};
 const loads=teacherClassMap(board),assigned=loads.get(teacherId)??[];
 const alreadyAssigned=assigned.includes(classKey(klass.name));
 const scheduledSessions=activeSessions(board).filter(s=>s.teacherId===teacherId||s.assistantTeacherId===teacherId);
 return {valid:true,reason:alreadyAssigned?"Giảng viên đã có tên trong lớp này. Không tạo phân công trùng.":"Phương án xem trước; chưa áp dụng vào hệ thống.",
  proposedClassLoad:assigned.length+(alreadyAssigned?0:1),currentClassLoad:assigned.length,alreadyAssigned,
  scheduledSessions:scheduledSessions.length,
  limitations:["Chưa có lịch buổi học mới nên không thể khẳng định không trùng giờ.","Chưa có ma trận chứng chỉ, năng lực và nhiệm vụ ngoài hệ thống.","Chỉ cán bộ quản lý mới được quyết định phân công thực tế."]};
}
