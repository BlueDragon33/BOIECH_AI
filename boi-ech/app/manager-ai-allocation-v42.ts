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
 suggestedRole:"primary"|"alternative"|"teacher-primary"|"teacher-alternative";
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
 const sourceMayBeTruncated=(board.sessions??[]).length>=1000||people.length>=1000;
 const teacherShortlist:AllocationProposal[]=[];
 const learnerShortlist:AllocationProposal[]=[];
 const staffWarnings=[
  "Chưa xác minh chuyên môn, chứng chỉ, lịch rảnh chính thức và thời gian di chuyển.",
  "Chỉ xét buổi học thuộc khoảng dữ liệu đã tải; không có trùng giờ không đồng nghĩa sẵn sàng nhận lớp."
 ];
 const sessionLoad=(personId:string)=>board.sessions.filter(session=>
   session.status!=="cancelled"&&
   (session.teacherId===personId||session.assistantTeacherId===personId)).length;
 const projectedTeacherWindows=new Map<string,{classId:string;start:number;end:number}[]>();
 const recordedWindows=(classId:string)=>board.sessions.filter(session=>
   session.classId===classId&&session.status!=="cancelled")
   .map(session=>({classId,start:Date.parse(session.startsAt),end:Date.parse(session.endsAt)}))
   .filter(s=>Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.end>s.start);
 for(const klass of shortage.sort((a,b)=>b.missingTeachers-a.missingTeachers||a.name.localeCompare(b.name,"vi"))){
  const classWindows=recordedWindows(klass.id);
  let primaryCount=0;
  const candidates=reviewTeacherCandidates(board,klass.id,100)
   .filter(c=>!c.alreadyAssigned&&c.overlappingExistingSessions===0)
   .sort((a,b)=>a.currentClassLoad-b.currentClassLoad||
     sessionLoad(a.teacherId)-sessionLoad(b.teacherId)||
     a.displayName.localeCompare(b.displayName,"vi")||a.teacherId.localeCompare(b.teacherId))
   .slice(0,12);
  let candidatesShown=0;
  for(const c of candidates){
   if(candidatesShown>=3)break;
   const person=teachers.find(t=>t.id===c.teacherId);
   if(!person)continue;
   const assignedWindows=projectedTeacherWindows.get(person.id)??[];
   const proposedConflict=classWindows.some(next=>assignedWindows.some(previous=>
     next.start<previous.end&&next.end>previous.start));
   const projectedClassLoad=c.currentClassLoad+new Set(assignedWindows.map(s=>s.classId)).size;
   const timetableVerified=c.classSessionsExamined>0&&classWindows.length===c.classSessionsExamined;
   const primary=timetableVerified&&!proposedConflict&&projectedClassLoad<12&&primaryCount<klass.missingTeachers;
   if(primary){
    primaryCount++;
    projectedTeacherWindows.set(person.id,[...assignedWindows,...classWindows]);
   }
   candidatesShown++;
   teacherShortlist.push({
    id:"teacher:"+klass.id+":"+person.id,kind:"teacher",personId:person.id,personName:person.name,
    classId:klass.id,className:klass.name,priority:primary?"high":"medium",
    reason:"Lớp thiếu "+klass.missingTeachers+" giảng viên; ứng viên đang phụ trách "+c.currentClassLoad+
     (!timetableVerified
      ?" lớp hoạt động. Lịch buổi học thiếu hoặc không hợp lệ; chưa thể xác nhận không trùng lịch."
      :proposedConflict
       ?" lớp hoạt động, nhưng TRÙNG GIỜ với một phân công ưu tiên đã mô phỏng. Chỉ là phương án thay thế."
       :projectedClassLoad>=12
        ?" lớp hoạt động, đạt giới hạn 12 lớp khi tính phương án đang mô phỏng."
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
     ...(projectedClassLoad>=12?["Tải lớp mô phỏng đã đạt giới hạn 12 lớp."]:[]),
     "Phân công ưu tiên chỉ là mô phỏng; không khóa giờ, lớp hay giảng viên trên D1.",
     ...staffWarnings
    ],
    evidenceStatus:timetableVerified?"checked-window":"no-class-sessions",
    suggestedRole:primary?"teacher-primary":"teacher-alternative",decision:"human-review-required"
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
