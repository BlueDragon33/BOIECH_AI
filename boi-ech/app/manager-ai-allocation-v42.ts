/**
 * V42 decision-support: accountable placement shortlist on an existing signed TrainingBoard.
 * No writes, guessed personnel credentials or unknown learner preferences.
 */
import {classKey,classNames,type TrainingBoard,type TrainingPerson,type TrainingResource} from "./training-types";
import {reviewTeacherCandidates} from "./manager-ai-followon-v41";

export type AllocationProposal={
 id:string;kind:"teacher"|"learner";personId:string;personName:string;
 classId:string;className:string;priority:"high"|"medium";
 reason:string;currentClassLoad:number|null;currentSessionLoad:number|null;currentLearnerCount:number;
 classCapacity:number;teacherCoverage:string;
 observedAt:string;sourceRecords:{source:"people"|"resources"|"sessions";id:string}[];
 warnings:string[];decision:"human-review-required";
 evidenceStatus:"checked-window"|"no-class-sessions"|"profile-missing";
 suggestedRole:"primary"|"alternative"|"teacher-candidate";
};
export type AllocationReview={observedAt:string;from:string;to:string;
 teacherShortlist:AllocationProposal[];learnerShortlist:AllocationProposal[];
 unassignedTeachers:number;unassignedLearners:number;classesNeedingTeachers:number;
 sourceMayBeTruncated:boolean;rulesVersion:"v42-rules-only";};

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
 const sourceMayBeTruncated=(board.sessions??[]).length>=1000||people.length>=1000||board.resources.length>=1000||
  board.sessions.some(s=>s.status!=="cancelled"&&
   (!Number.isFinite(Date.parse(s.startsAt))||!Number.isFinite(Date.parse(s.endsAt))||
    Date.parse(s.endsAt)<=Date.parse(s.startsAt)));
 const teacherShortlist:AllocationProposal[]=[];
 const learnerShortlist:AllocationProposal[]=[];
 const staffWarnings=[
  "Chưa xác minh chuyên môn, chứng chỉ, lịch rảnh chính thức và thời gian di chuyển.",
  "Chỉ xét buổi học thuộc khoảng dữ liệu đã tải; không có trùng giờ không đồng nghĩa sẵn sàng nhận lớp."
 ];
 const sessionLoad=(personId:string)=>board.sessions.filter(session=>
   session.status!=="cancelled"&&
   (session.teacherId===personId||session.assistantTeacherId===personId)).length;
 for(const klass of shortage.sort((a,b)=>b.missingTeachers-a.missingTeachers||a.name.localeCompare(b.name,"vi"))){
  const candidates=reviewTeacherCandidates(board,klass.id,100)
   .filter(c=>!c.alreadyAssigned&&c.overlappingExistingSessions===0)
   .sort((a,b)=>a.currentClassLoad-b.currentClassLoad||
     sessionLoad(a.teacherId)-sessionLoad(b.teacherId)||
     a.displayName.localeCompare(b.displayName,"vi")||a.teacherId.localeCompare(b.teacherId))
   .slice(0,3);
  for(const c of candidates){
   const person=teachers.find(t=>t.id===c.teacherId);
   if(!person)continue;
   teacherShortlist.push({
    id:"teacher:"+klass.id+":"+person.id,kind:"teacher",personId:person.id,personName:person.name,
    classId:klass.id,className:klass.name,priority:c.classSessionsExamined===0?"medium":"high",
    reason:"Lớp thiếu "+klass.missingTeachers+" giảng viên; ứng viên đang phụ trách "+c.currentClassLoad+
     (c.classSessionsExamined===0
      ?" lớp hoạt động. Không có buổi học để đối chiếu thời gian, chưa thể xác nhận không trùng lịch."
      :" lớp hoạt động, có "+sessionLoad(person.id)+" buổi đã xếp trong cửa sổ tải và không phát hiện trùng giờ trong "+c.classSessionsExamined+" buổi của lớp đã tải."),
    currentClassLoad:c.currentClassLoad,currentSessionLoad:sessionLoad(person.id),
    currentLearnerCount:klass.learnerCount,
    classCapacity:klass.capacity,teacherCoverage:klass.teacherCount+"/"+klass.requiredTeachers,
    observedAt:board.observedAt,
    sourceRecords:[{source:"resources",id:klass.id},{source:"people",id:person.id}],
    warnings:c.classSessionsExamined===0?
     ["Không có lịch buổi của lớp trong khoảng tải nên chưa kiểm tra được xung đột.",...staffWarnings]:staffWarnings,
    evidenceStatus:c.classSessionsExamined===0?"no-class-sessions":"checked-window",
    suggestedRole:"teacher-candidate",decision:"human-review-required"
   });
  }
 }
 // Learner proposals remain alternatives; no DB seats are held in this preview.
 // Reserve *only primary simulated preferences* so the ranked shortlist does not
 // offer 40 first-choice placements into a class with 1 remaining seat.
 const rooms=classes.filter(c=>c.capacity>0&&c.learnerCount<c.capacity&&
   c.teacherCount>=c.requiredTeachers&&c.requiredTeachers>0);
 const projectedPrimary=new Map<string,number>();
 const projectedRatio=(c:TrainingResource)=>
   (c.learnerCount+(projectedPrimary.get(c.id)??0))/Math.max(1,c.capacity);
 for(const learner of unassignedLearners.slice()
  .sort((a,b)=>a.name.localeCompare(b.name,"vi")||a.id.localeCompare(b.id)).slice(0,40)){
  const choices=rooms.filter(c=>c.learnerCount+(projectedPrimary.get(c.id)??0)<c.capacity)
   .sort((a,b)=>projectedRatio(a)-projectedRatio(b)||
    a.name.localeCompare(b.name,"vi")||a.id.localeCompare(b.id))
   .slice(0,2);
  if(!choices.length)continue;
  const preferred=choices[0];
  projectedPrimary.set(preferred.id,(projectedPrimary.get(preferred.id)??0)+1);
  for(const [index,klass] of choices.entries()){
   learnerShortlist.push({
    id:"learner:"+learner.id+":"+klass.id,kind:"learner",personId:learner.id,
    personName:learner.name,classId:klass.id,className:klass.name,priority:"medium",
    reason:"Lớp đang còn "+(klass.capacity-klass.learnerCount)+" chỗ theo dữ liệu đã tải; "+
     klass.teacherCount+"/"+klass.requiredTeachers+" giảng viên được ghi nhận. "+
     (index===0?"Lựa chọn mô phỏng ưu tiên để cân bằng sĩ số.":"Lựa chọn thay thế, không giữ chỗ."),
    currentClassLoad:null,currentSessionLoad:null,currentLearnerCount:klass.learnerCount,
    classCapacity:klass.capacity,teacherCoverage:klass.teacherCount+"/"+klass.requiredTeachers,
    observedAt:board.observedAt,
    sourceRecords:[{source:"people",id:learner.id},{source:"resources",id:klass.id}],
    warnings:[
     "Các đề xuất không giữ chỗ thật; sĩ số và quyền được kiểm tra lại trên máy chủ lúc lưu.",
     "Chưa có dữ liệu ca giờ mong muốn, trình độ bơi, nhóm tuổi, nhu cầu hỗ trợ hoặc xác nhận phù hợp thực tế.",
     "Chỉ dùng sức chứa và phân công cấu hình; chưa xác minh an toàn thực hành, bể hoặc tỷ lệ huấn luyện thực tế."
    ],
    evidenceStatus:"profile-missing",suggestedRole:index===0?"primary":"alternative",
    decision:"human-review-required"
   });
  }
 }
 return {observedAt:board.observedAt,from:board.from,to:board.to,
  teacherShortlist,learnerShortlist,
  unassignedTeachers:freeTeachers.length,unassignedLearners:unassignedLearners.length,
  classesNeedingTeachers:shortage.length,sourceMayBeTruncated,
  rulesVersion:"v42-rules-only"};
}
