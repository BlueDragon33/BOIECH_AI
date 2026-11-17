/**
 * V42 decision-support: accountable placement shortlist on an existing signed TrainingBoard.
 * No writes, guessed personnel credentials or unknown learner preferences.
 */
import {classKey,classNames,type TrainingBoard,type TrainingPerson,type TrainingResource} from "./training-types";
import {reviewTeacherCandidates} from "./manager-ai-followon-v41";
import {assessProfilePlacement,assessInstructorForClass,type AdmissionResult} from "./manager-ai-profile-admission-v43";
import {planTeacherCoverage,type TeacherPlanClass,type TeacherPlan} from "./manager-ai-teacher-plan";

export type AllocationProposal={
 id:string;kind:"teacher"|"learner";personId:string;personName:string;
 classId:string;className:string;priority:"high"|"medium";
 reason:string;currentClassLoad:number|null;currentSessionLoad:number|null;currentLearnerCount:number;
 classCapacity:number;teacherCoverage:string;
 observedAt:string;sourceRecords:{source:"people"|"resources"|"sessions";id:string}[];
 warnings:string[];decision:"human-review-required";
 evidenceStatus:"checked-window"|"no-class-sessions"|"profile-missing";
 suggestedRole:"primary"|"alternative"|"teacher-primary"|"teacher-alternative";
 admissionStatus?:"verified"|"insufficient-source"|"hard-veto";
 admissionSources?:string[];admissible?:boolean;
};
export type AllocationReview={observedAt:string;from:string;to:string;
 teacherShortlist:AllocationProposal[];learnerShortlist:AllocationProposal[];
 unassignedTeachers:number;unassignedLearners:number;classesNeedingTeachers:number;
 sourceMayBeTruncated:boolean;rulesVersion:"v45-rules-only";teacherPlan:TeacherPlan;};

const eligible=(p:TrainingPerson)=>p.registered&&p.status==="approved"&&!p.expired;
const activeClasses=(b:TrainingBoard)=>b.resources.filter(r=>r.kind==="class"&&r.status==="active");
const assignedToActive=(p:TrainingPerson,classes:TrainingResource[])=>
 classNames(p.className).some(name=>classes.some(c=>classKey(c.name)===classKey(name)));

export function buildAllocationReview(board:TrainingBoard):AllocationReview {
 const classes=activeClasses(board),people=board.people??[];
 const teachers=people.filter(p=>p.role==="teacher"&&eligible(p));
 const learners=people.filter(p=>p.role==="learner"&&eligible(p));
 const freeTeachers=teachers.filter(t=>!assignedToActive(t,classes));
 const unassignedLearners=learners.filter(p=>!assignedToActive(p,classes));
 const shortage=classes.filter(c=>c.missingTeachers>0&&c.requiredTeachers>0);
 const admission=board.admissionProfiles;
 const sourceMayBeTruncated=(board.sessions??[]).length>=1000||people.length>=1000||
  Boolean(admission?.sourceMayBeTruncated);
 const sourceTime=board.observedAt;
 const teacherShortlist:AllocationProposal[]=[];
 const learnerShortlist:AllocationProposal[]=[];
 const staffWarnings=[
  "Chưa xác minh chuyên môn, chứng chỉ, lịch rảnh chính thức và thời gian di chuyển.",
  "Chỉ xét buổi học thuộc khoảng dữ liệu đã tải; không có trùng giờ không đồng nghĩa sẵn sàng nhận lớp."
 ];
 const sessionLoad=(personId:string)=>board.sessions.filter(session=>
   session.status!=="cancelled"&&
   (session.teacherId===personId||session.assistantTeacherId===personId)).length;
 const recordedWindows=(classId:string)=>board.sessions.filter(session=>
   session.classId===classId&&session.status!=="cancelled")
   .map(session=>({classId,start:Date.parse(session.startsAt),end:Date.parse(session.endsAt)}))
   .filter(s=>Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.end>s.start);
 const candidateGroups=shortage.map(klass=>{
  const classWindows=recordedWindows(klass.id);
  const candidates=reviewTeacherCandidates(board,klass.id,100)
   .filter(c=>!c.alreadyAssigned&&c.overlappingExistingSessions===0)
   .sort((a,b)=>a.currentClassLoad-b.currentClassLoad||
     sessionLoad(a.teacherId)-sessionLoad(b.teacherId)||
     a.displayName.localeCompare(b.displayName,"vi")||a.teacherId.localeCompare(b.teacherId))
   .slice(0,12).flatMap(c=>{
   const person=teachers.find(t=>t.id===c.teacherId);
   if(!person)return [];
   const professional=admission?assessInstructorForClass({
    teacherId:person.id,classId:klass.id,now:sourceTime,
    teacher:admission.teacher.find(profile=>profile.teacherId===person.id),
    klass:admission.safety.find(profile=>profile.classId===klass.id),
    existingTeacherClasses:c.currentClassLoad,registeredLearners:klass.learnerCount,
   }):null;
   if(professional?.status==="hard-veto")return [];
   const timetableVerified=c.classSessionsExamined>0&&classWindows.length===c.classSessionsExamined;
   const maxLoad=Math.min(12,admission?.teacher.find(profile=>profile.teacherId===person.id)?.maxActiveClasses??12);
   return [{candidate:c,person,professional,timetableVerified,maxLoad}];
  });
  return {klass,classWindows,candidates};
 });
 const planClasses:TeacherPlanClass[]=candidateGroups.map(({klass,classWindows,candidates})=>({
  classId:klass.id,missing:klass.missingTeachers,windows:classWindows,
  candidates:candidates.filter(row=>row.timetableVerified&&(!admission||row.professional?.status==="eligible"))
   .map(row=>({teacherId:row.person.id,currentLoad:row.candidate.currentClassLoad,maxLoad:row.maxLoad}))
 }));
 const teacherPlan=planTeacherCoverage(planClasses);
 const selected=new Set(teacherPlan.assignments.map(item=>item.classId+":"+item.teacherId));
 for(const {klass,classWindows,candidates} of candidateGroups){
  const ordered=candidates.slice().sort((a,b)=>Number(selected.has(klass.id+":"+b.person.id))-Number(selected.has(klass.id+":"+a.person.id)));
  const primaryCount=ordered.filter(row=>selected.has(klass.id+":"+row.person.id)).length;
  for(const {candidate:c,person,professional,timetableVerified,maxLoad} of ordered.slice(0,Math.max(3,primaryCount))){
   const otherAssignments=teacherPlan.assignments.filter(item=>item.teacherId===person.id&&item.classId!==klass.id);
   const assignedWindows=otherAssignments.flatMap(item=>recordedWindows(item.classId));
   const proposedConflict=classWindows.some(next=>assignedWindows.some(previous=>
     next.start<previous.end&&next.end>previous.start));
   const projectedClassLoad=c.currentClassLoad+otherAssignments.length;
   const primary=selected.has(klass.id+":"+person.id);
   teacherShortlist.push({
    id:"teacher:"+klass.id+":"+person.id,kind:"teacher",personId:person.id,personName:person.name,
    classId:klass.id,className:klass.name,priority:primary?"high":"medium",
    reason:"Lớp thiếu "+klass.missingTeachers+" giảng viên; ứng viên đang phụ trách "+c.currentClassLoad+
     (!timetableVerified
      ?" lớp hoạt động. Lịch buổi học thiếu hoặc không hợp lệ; chưa thể xác nhận không trùng lịch."
      :proposedConflict
       ?" lớp hoạt động, nhưng TRÙNG GIỜ với một phân công ưu tiên đã mô phỏng. Chỉ là phương án thay thế."
       :projectedClassLoad>=maxLoad
        ?" lớp hoạt động, đạt giới hạn "+maxLoad+" lớp khi tính phương án đang mô phỏng."
        :" lớp hoạt động, có "+sessionLoad(person.id)+" buổi đã xếp trong cửa sổ tải; đã đối chiếu "+c.classSessionsExamined+" buổi với lịch thực tế và các phương án ưu tiên."),
    currentClassLoad:c.currentClassLoad,currentSessionLoad:sessionLoad(person.id),
    currentLearnerCount:klass.learnerCount,
    classCapacity:klass.capacity,teacherCoverage:klass.teacherCount+"/"+klass.requiredTeachers,
    observedAt:board.observedAt,
    sourceRecords:[{source:"resources",id:klass.id},{source:"people",id:person.id},
     ...board.sessions.filter(s=>s.classId===klass.id&&s.status!=="cancelled").slice(0,4)
       .map(s=>({source:"sessions" as const,id:s.id}))],
    warnings:[
     ...(!timetableVerified?["Lịch buổi học thiếu/không hợp lệ; không được coi là sẵn sàng."]:[]),
     ...(proposedConflict?["Mô phỏng cho thấy trùng giờ với lớp đã được ưu tiên ở danh sách này."]:[]),
     ...(projectedClassLoad>=maxLoad?["Tải lớp mô phỏng đã đạt giới hạn "+maxLoad+" lớp."]:[]),
     ...(professional?.reasons??[]),
     "Phân công ưu tiên chỉ là mô phỏng; không khóa giờ, lớp hay giảng viên trên D1.",
     ...staffWarnings
    ],
    evidenceStatus:timetableVerified?"checked-window":"no-class-sessions",
    admissionStatus:admission?(professional?.status==="eligible"?"verified":
     professional?.status??"insufficient-source"):undefined,
    admissionSources:professional?.checkedSourceIds,
    admissible:!admission||professional?.status==="eligible",
    suggestedRole:primary?"teacher-primary":"teacher-alternative",decision:"human-review-required"
   });
  }
 }
 // Learner proposals remain alternatives; no DB seats are held in this preview.
 // Reserve *only primary simulated preferences* so the ranked shortlist does not
 // offer 40 first-choice placements into a class with 1 remaining seat.
 const rooms=classes.filter(c=>c.capacity>0&&c.learnerCount<c.capacity&&
   c.teacherCount>=c.requiredTeachers&&c.requiredTeachers>0);
 const learnerAdmission=(learner:TrainingPerson,klass:TrainingResource):AdmissionResult|null=>{
  if(!admission)return null;
  const classSafety=admission.safety.find(profile=>profile.classId===klass.id);
  const learnerProfile=admission.learner.find(profile=>profile.learnerId===learner.id);
  const assigned=teachers.filter(t=>classNames(t.className).some(n=>classKey(n)===classKey(klass.name)));
  const reviewed=assigned.map(t=>assessProfilePlacement({
    teacherId:t.id,learnerId:learner.id,classId:klass.id,now:sourceTime,
    teacher:admission.teacher.find(p=>p.teacherId===t.id),
    learner:learnerProfile,klass:classSafety,
    existingTeacherClasses:Math.max(0,classNames(t.className).length-1),
    registeredLearners:klass.learnerCount,
  }));
  return reviewed.find(x=>x.status==="eligible")??reviewed.find(x=>x.status==="insufficient-source")
   ??reviewed[0]??{status:"insufficient-source",reasons:["Chưa xác minh giảng viên phù hợp trong lớp."],
    checkedSourceIds:[],profileRevisionIds:[]};
 };
 const projectedPrimary=new Map<string,number>();
 const projectedRatio=(c:TrainingResource)=>
   (c.learnerCount+(projectedPrimary.get(c.id)??0))/Math.max(1,c.capacity);
 for(const learner of unassignedLearners.slice()
  .sort((a,b)=>a.name.localeCompare(b.name,"vi")||a.id.localeCompare(b.id)).slice(0,40)){
  const choices=rooms.filter(c=>c.learnerCount+(projectedPrimary.get(c.id)??0)<c.capacity)
   .filter(c=>learnerAdmission(learner,c)?.status!=="hard-veto")
   .sort((a,b)=>{
    const ar=learnerAdmission(learner,a)?.status==="eligible"?0:1;
    const br=learnerAdmission(learner,b)?.status==="eligible"?0:1;
    return ar-br||projectedRatio(a)-projectedRatio(b)||
      a.name.localeCompare(b.name,"vi")||a.id.localeCompare(b.id);
   }).slice(0,2);
  if(!choices.length)continue;
  const preferred=choices[0];
  projectedPrimary.set(preferred.id,(projectedPrimary.get(preferred.id)??0)+1);
  for(const [index,klass] of choices.entries()){
   const matched=learnerAdmission(learner,klass);
   learnerShortlist.push({
    id:"learner:"+learner.id+":"+klass.id,kind:"learner",personId:learner.id,
    personName:learner.name,classId:klass.id,className:klass.name,
    priority:matched?.status==="eligible"?"high":"medium",
    reason:"Lớp đang còn "+(klass.capacity-klass.learnerCount)+" chỗ theo dữ liệu đã tải; "+
     klass.teacherCount+"/"+klass.requiredTeachers+" giảng viên được ghi nhận. "+
     (index===0?"Lựa chọn mô phỏng ưu tiên để cân bằng sĩ số.":"Lựa chọn thay thế, không giữ chỗ."),
    currentClassLoad:null,currentSessionLoad:null,currentLearnerCount:klass.learnerCount,
    classCapacity:klass.capacity,teacherCoverage:klass.teacherCount+"/"+klass.requiredTeachers,
    observedAt:board.observedAt,
    sourceRecords:[{source:"people",id:learner.id},{source:"resources",id:klass.id}],
    warnings:[
     "Các đề xuất không giữ chỗ thật; sĩ số và quyền được kiểm tra lại trên máy chủ lúc lưu.",
     ...(matched?.reasons??["Chưa có dữ liệu ca giờ mong muốn, trình độ bơi, nhu cầu hỗ trợ hoặc xác nhận phù hợp thực tế."]),
     "Chỉ dùng sức chứa và phân công cấu hình; chưa xác minh an toàn thực hành, bể hoặc tỷ lệ huấn luyện thực tế."
    ],
    evidenceStatus:"profile-missing",
    admissionStatus:admission?(matched?.status==="eligible"?"verified":
      matched?.status??"insufficient-source"):undefined,
    admissionSources:matched?.checkedSourceIds,
    admissible:!admission||matched?.status==="eligible",
    suggestedRole:index===0?"primary":"alternative",
    decision:"human-review-required"
   });
  }
 }
 return {observedAt:board.observedAt,from:board.from,to:board.to,teacherPlan,
  teacherShortlist,learnerShortlist,
  unassignedTeachers:freeTeachers.length,unassignedLearners:unassignedLearners.length,
  classesNeedingTeachers:shortage.length,sourceMayBeTruncated,
  rulesVersion:"v45-rules-only"};
}
