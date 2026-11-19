/**
 * V43 offline / pure profile admission. No profile is fetched, inferred, stored,
 * forwarded to an AI provider or activated by this module.
 *
 * Hard constraints for future Owner-approved, consented, signed profile snapshots.
 * The current TrainingBoard does not contain these fields; caller MUST surface
 * "missing" rather than claiming a learner/instructor is qualified or available.
 */
export type AdmissionSeal={
 sourceId:string;revision:number;verifiedAt:string;expiresAt:string;
 approvedBy:string;purpose:"class-allocation";consented:boolean;
};
export type AvailabilityWindow={startsAt:string;endsAt:string};
export type InstructorAdmissionProfile={
 teacherId:string;seal:AdmissionSeal;certificates:{
  code:string;validUntil:string;verified:boolean;
 }[];available:AvailabilityWindow[];
 maxActiveClasses:number;absences:AvailabilityWindow[];
};
export type LearnerAdmissionProfile={
 learnerId:string;seal:AdmissionSeal;
 desiredWindows:AvailabilityWindow[];declaredLevel:"beginner"|"intermediate"|"advanced";
};
export type ClassAdmissionProfile={
 classId:string;seal:AdmissionSeal;
 requiredCertification:string;requiredLevel:"beginner"|"intermediate"|"advanced";
 trainingWindows:AvailabilityWindow[];
 poolSafetyApproved:boolean;trainerToLearnerLimit:number;
};
export type AdmissionResult={
 status:"eligible"|"insufficient-source"|"hard-veto";
 reasons:string[];checkedSourceIds:string[];profileRevisionIds:string[];
};
const isIso=(value:unknown):value is string=>
 typeof value==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value));
const range=(v:AvailabilityWindow)=>isIso(v.startsAt)&&isIso(v.endsAt)&&Date.parse(v.startsAt)<Date.parse(v.endsAt);
const contains=(outer:AvailabilityWindow,inner:AvailabilityWindow)=>
 range(outer)&&range(inner)&&Date.parse(outer.startsAt)<=Date.parse(inner.startsAt)&&Date.parse(outer.endsAt)>=Date.parse(inner.endsAt);
const overlaps=(a:AvailabilityWindow,b:AvailabilityWindow)=>
 range(a)&&range(b)&&Date.parse(a.startsAt)<Date.parse(b.endsAt)&&Date.parse(b.startsAt)<Date.parse(a.endsAt);
function validSeal(seal:AdmissionSeal|undefined,at:string){
 if(!seal)return false;
 return Boolean(seal.sourceId&&seal.approvedBy&&seal.purpose==="class-allocation"&&
  seal.consented&&Number.isSafeInteger(seal.revision)&&seal.revision>0&&
  isIso(seal.verifiedAt)&&isIso(seal.expiresAt)&&isIso(at)&&
  Date.parse(seal.verifiedAt)<=Date.parse(at)&&Date.parse(seal.expiresAt)>Date.parse(at)&&
  Date.parse(at)-Date.parse(seal.verifiedAt)<=90*86400000);
}
export function assessProfilePlacement(input:{
 teacherId:string;learnerId:string;classId:string;now:string;
 teacher?:InstructorAdmissionProfile|null;
 learner?:LearnerAdmissionProfile|null;
 klass?:ClassAdmissionProfile|null;
 existingTeacherClasses:number;registeredLearners:number;
}):AdmissionResult{
 const {teacher,learner,klass,now}=input;
 const listed=[teacher?.seal,learner?.seal,klass?.seal].filter((v):v is AdmissionSeal=>Boolean(v));
 const trace={checkedSourceIds:listed.map(v=>v.sourceId),
  profileRevisionIds:listed.map(v=>v.sourceId+"@"+v.revision)};
 const missing=(...reasons:string[]):AdmissionResult=>({status:"insufficient-source",reasons,...trace});
 const veto=(...reasons:string[]):AdmissionResult=>({status:"hard-veto",reasons,...trace});
 if(!isIso(now))return missing("Mốc thời gian kiểm tra không hợp lệ.");
 if(!teacher||!learner||!klass)return missing("Thiếu hồ sơ bổ sung được phép đọc của giảng viên, học viên hoặc lớp/bể.");
 if(teacher.teacherId!==input.teacherId||learner.learnerId!==input.learnerId||
   klass.classId!==input.classId)return veto("Sai định danh giữa hồ sơ đã ký và đề xuất phân lớp.");
 if(!validSeal(teacher.seal,now)||!validSeal(learner.seal,now)||!validSeal(klass.seal,now))
  return missing("Thiếu đồng ý/phê duyệt, nguồn quá 90 ngày hoặc hồ sơ đã hết hiệu lực.");
 if(!klass.poolSafetyApproved||!Number.isInteger(klass.trainerToLearnerLimit)||
   klass.trainerToLearnerLimit<1)return veto("Chưa đạt giới hạn an toàn bể được phê duyệt.");
 if(!Number.isInteger(input.registeredLearners)||input.registeredLearners<0||
   input.registeredLearners+1>klass.trainerToLearnerLimit)
  return veto("Sĩ số dự kiến vượt giới hạn an toàn theo giảng viên phụ trách.");
 if(!Number.isInteger(teacher.maxActiveClasses)||teacher.maxActiveClasses<1||
   !Number.isInteger(input.existingTeacherClasses)||input.existingTeacherClasses<0||
   input.existingTeacherClasses>=teacher.maxActiveClasses)
  return veto("Giảng viên không còn hạn mức lớp được xác minh.");
 if(!teacher.certificates.some(c=>c.verified&&c.code===klass.requiredCertification&&
    isIso(c.validUntil)&&Date.parse(c.validUntil)>Date.parse(now)))
  return veto("Chứng chỉ chuyên môn bắt buộc không có hoặc đã hết hiệu lực.");
 if(learner.declaredLevel!==klass.requiredLevel)
  return veto("Trình độ tự khai chưa khớp yêu cầu đầu vào của lớp.");
 if(!klass.trainingWindows.length||!klass.trainingWindows.every(range)||
   !teacher.available.length||!teacher.available.every(range)||
   !learner.desiredWindows.length||!learner.desiredWindows.every(range)||
   !teacher.absences.every(range))
  return missing("Chưa có khung giờ đầy đủ và hợp lệ từ hồ sơ chính thức.");
 for(const session of klass.trainingWindows){
  if(!teacher.available.some(window=>contains(window,session)))
   return veto("Giảng viên không có lịch rảnh xác thực phủ toàn bộ buổi học.");
  if(!learner.desiredWindows.some(window=>contains(window,session)))
   return veto("Buổi học không thuộc khung giờ đã đăng ký của học viên.");
  if(teacher.absences.some(window=>overlaps(window,session)))
   return veto("Giảng viên vắng hoặc có nhiệm vụ được ghi nhận trong thời gian buổi học.");
 }
 return {status:"eligible",reasons:[
  "Chỉ xác minh ràng buộc từ ba hồ sơ có nguồn, đồng ý và thời hạn.",
  "Còn phải kiểm tra phiên bản và sức chứa thực tế tại thời điểm ghi vào D1; không tự phân lớp."
 ],...trace};
}

/**
 * Instructor-only hard gates for understaffed classes. Deliberately does NOT
 * infer learner skill compatibility; this checks coach/calendar/capacity only.
 */
export function assessInstructorForClass(input:{
 teacherId:string;classId:string;now:string;
 teacher?:InstructorAdmissionProfile|null;klass?:ClassAdmissionProfile|null;
 existingTeacherClasses:number;registeredLearners:number;
}):AdmissionResult{
 const {teacher,klass,now}=input;
 const seals=[teacher?.seal,klass?.seal].filter((v):v is AdmissionSeal=>Boolean(v));
 const checkedSourceIds=seals.map(s=>s.sourceId);
 const profileRevisionIds=seals.map(s=>s.sourceId+"@"+s.revision);
 const result=(status:AdmissionResult["status"],reason:string):AdmissionResult=>({
  status,reasons:[reason],checkedSourceIds,profileRevisionIds
 });
 if(!validSeal(teacher?.seal,now)||!validSeal(klass?.seal,now)||!teacher||!klass)
  return result("insufficient-source","Thiếu xác nhận chuyên môn, lịch hoặc an toàn bể có nguồn và đồng ý.");
 if(teacher.teacherId!==input.teacherId||klass.classId!==input.classId)
  return result("hard-veto","Chứng cứ không thuộc giảng viên hoặc lớp đang xét.");
 if(!klass.poolSafetyApproved||!Number.isInteger(klass.trainerToLearnerLimit)||
  klass.trainerToLearnerLimit<1||!Number.isInteger(input.registeredLearners)||
  input.registeredLearners>klass.trainerToLearnerLimit)
  return result("hard-veto","Chưa đạt điều kiện an toàn hoặc sĩ số tối đa bể.");
 if(!Number.isInteger(teacher.maxActiveClasses)||teacher.maxActiveClasses<1||
  !Number.isInteger(input.existingTeacherClasses)||
  input.existingTeacherClasses>=teacher.maxActiveClasses)
  return result("hard-veto","Giảng viên đã đạt giới hạn lớp được xác minh.");
 if(!teacher.certificates.some(c=>c.verified&&c.code===klass.requiredCertification&&
  isIso(c.validUntil)&&Date.parse(c.validUntil)>Date.parse(now)))
  return result("hard-veto","Chứng chỉ phù hợp thiếu hoặc đã hết hạn.");
 if(!klass.trainingWindows.length||!klass.trainingWindows.every(range)||
  !teacher.available.length||!teacher.available.every(range)||!teacher.absences.every(range))
  return result("insufficient-source","Thiếu lịch lớp hoặc giờ làm việc được xác minh.");
 for(const lesson of klass.trainingWindows){
  if(!teacher.available.some(slot=>contains(slot,lesson))||
     teacher.absences.some(absence=>overlaps(absence,lesson)))
   return result("hard-veto","Giảng viên không rảnh hoặc có lịch vắng trùng giờ.");
 }
 return result("eligible","Giảng viên đủ điều kiện chuyên môn, lịch và an toàn theo hai hồ sơ đã xác minh; chưa thay thế rà soát học viên.");
}
