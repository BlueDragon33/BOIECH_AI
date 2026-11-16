import type {D1Database} from "@cloudflare/workers-types";
import type {TrainingBoard} from "./training-types";
import type {AdmissionSeal,InstructorAdmissionProfile,LearnerAdmissionProfile,
 ClassAdmissionProfile,AvailabilityWindow} from "./manager-ai-profile-admission-v43";

/** Profile admission is OFF until separately authorized by the data owner. */
export async function profileAdmissionEnabled():Promise<boolean>{
 try{
  const {env}=await import("cloudflare:workers");
  return (env as unknown as Record<string,unknown>).BOI_ECH_AI_PROFILE_ADMISSION==="enabled";
 }catch{return false;}
}
const validIso=(s:unknown):s is string=>typeof s==="string"&&
 /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(s)&&Number.isFinite(Date.parse(s));
const span=(v:unknown):v is AvailabilityWindow=>{
 if(!v||typeof v!=="object"||Array.isArray(v))return false;
 const w=v as Record<string,unknown>;
 return validIso(w.startsAt)&&validIso(w.endsAt)&&Date.parse(w.startsAt)<Date.parse(w.endsAt);
};
const windows=(value:unknown,max=24):value is AvailabilityWindow[]=>
 Array.isArray(value)&&value.length<=max&&value.every(span);
const code=(value:unknown)=>typeof value==="string"&&/^[A-Za-z0-9._:-]{3,64}$/.test(value);
const level=(value:unknown)=>value==="beginner"||value==="intermediate"||value==="advanced";
export function validateSubmittedTrainingProfile(role:"teacher"|"learner",raw:unknown):{
 ok:boolean;message:string;payload:Record<string,unknown>|null;
}{
 const deny=(message:string)=>({ok:false,message,payload:null});
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return deny("Hồ sơ phải là đối tượng dữ liệu.");
 const p=raw as Record<string,unknown>;
 if(role==="teacher"){
  if(!Array.isArray(p.certificates)||p.certificates.length>8||
    !p.certificates.every(cert=>cert&&typeof cert==="object"&&
      code((cert as Record<string,unknown>).code)&&validIso((cert as Record<string,unknown>).validUntil))||
    !windows(p.available)||!p.available.length||
    !windows(p.absences,24)||!Number.isInteger(p.maxActiveClasses)||
    (p.maxActiveClasses as number)<1||(p.maxActiveClasses as number)>12)
   return deny("Thiếu chứng chỉ tự khai, ca rảnh, ngày vắng hoặc giới hạn số lớp hợp lệ.");
  const payload={certificates:p.certificates.map((cert:Record<string,unknown>)=>({
    code:cert.code,validUntil:cert.validUntil})),
    available:p.available,absences:p.absences,maxActiveClasses:p.maxActiveClasses};
  return {ok:true,message:"Chỉ là hồ sơ tự khai; chưa được xác minh.",payload};
 }
 if(!level(p.declaredLevel)||!windows(p.desiredWindows)||!p.desiredWindows.length)
  return deny("Thiếu trình độ tự khai hoặc khung giờ mong muốn hợp lệ.");
 return {ok:true,message:"Hồ sơ học viên cần xác minh điều kiện ghép lớp.",payload:{
  declaredLevel:p.declaredLevel,desiredWindows:p.desiredWindows
 }};
}
export function validateClassSafetyProfile(raw:unknown){
 const invalid={ok:false,message:"Chưa đủ điều kiện an toàn hoặc lịch học xác thực.",payload:null};
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return invalid;
 const p=raw as Record<string,unknown>;
 if(!code(p.requiredCertification)||!level(p.requiredLevel)||p.poolSafetyApproved!==true||
 !Number.isInteger(p.trainerToLearnerLimit)||(p.trainerToLearnerLimit as number)<1||
 (p.trainerToLearnerLimit as number)>500||
 !windows(p.trainingWindows)||!p.trainingWindows.length)return invalid;
 return {ok:true,message:"An toàn và lịch bể do Cán bộ xác nhận; cần chứng từ nguồn.",payload:{
  requiredCertification:p.requiredCertification,requiredLevel:p.requiredLevel,
  trainingWindows:p.trainingWindows,poolSafetyApproved:true,trainerToLearnerLimit:p.trainerToLearnerLimit
 }};
}
export type TrainingProfileRow={
 device_id:string;role:"teacher"|"learner";payload_json:string;revision:number;state:string;
 consent_at:string|null;verified_revision:number|null;verified_by:string|null;
 verification_reference:string|null;verified_at:string|null;valid_until:string|null;
};
export type ClassSafetyRow={
 class_id:string;payload_json:string;revision:number;verification_reference:string;
 verified_by:string;verified_at:string;valid_until:string;
};
function seal(id:string,revision:number,by:string|null,reference:string|null,
 at:string|null,expires:string|null,consented:boolean):AdmissionSeal|null{
 if(!consented||!by||!reference||!at||!expires||!validIso(at)||!validIso(expires))return null;
 return {sourceId:id+"#"+reference,revision,approvedBy:by,
  verifiedAt:at,expiresAt:expires,purpose:"class-allocation",consented:true};
}
function readJson(input:string):Record<string,unknown>|null{
 try{const obj=JSON.parse(input);return obj&&typeof obj==="object"&&!Array.isArray(obj)?obj:null;}
 catch{return null;}
}
export function admitVerifiedTrainingProfiles(rows:TrainingProfileRow[],classes:ClassSafetyRow[],now:string){
 const teacher=new Map<string,InstructorAdmissionProfile>();
 const learner=new Map<string,LearnerAdmissionProfile>();
 const safety=new Map<string,ClassAdmissionProfile>();
 for(const row of rows){
  if(row.state!=="verified"||row.verified_revision!==row.revision||
   !validIso(row.valid_until)||Date.parse(row.valid_until)<=Date.parse(now))continue;
  const raw=readJson(row.payload_json);
  const parsed=validateSubmittedTrainingProfile(row.role,raw);
  const source=seal("profile:"+row.device_id,row.revision,row.verified_by,
   row.verification_reference,row.verified_at,row.valid_until,!!row.consent_at);
  if(!source||!parsed.ok||!parsed.payload)continue;
  if(row.role==="teacher"){
   const p=parsed.payload;
   teacher.set(row.device_id,{
    teacherId:row.device_id,seal:source,
    certificates:(p.certificates as {code:string;validUntil:string}[]).map(item=>({...item,verified:true})),
    available:p.available as AvailabilityWindow[],absences:p.absences as AvailabilityWindow[],
    maxActiveClasses:p.maxActiveClasses as number
   });
  }else{
   learner.set(row.device_id,{
    learnerId:row.device_id,seal:source,
    desiredWindows:parsed.payload.desiredWindows as AvailabilityWindow[],
    declaredLevel:parsed.payload.declaredLevel as "beginner"|"intermediate"|"advanced"
   });
  }
 }
 for(const row of classes){
  if(!validIso(row.valid_until)||Date.parse(row.valid_until)<=Date.parse(now))continue;
  const parsed=validateClassSafetyProfile(readJson(row.payload_json));
  const source=seal("class:"+row.class_id,row.revision,row.verified_by,
   row.verification_reference,row.verified_at,row.valid_until,true);
  if(!source||!parsed.ok||!parsed.payload)continue;
  const p=parsed.payload;
  safety.set(row.class_id,{
   classId:row.class_id,seal:source,
   requiredCertification:p.requiredCertification as string,
   requiredLevel:p.requiredLevel as "beginner"|"intermediate"|"advanced",
   trainingWindows:p.trainingWindows as AvailabilityWindow[],
   poolSafetyApproved:p.poolSafetyApproved as boolean,
   trainerToLearnerLimit:p.trainerToLearnerLimit as number,
  });
 }
 return {teacher,learner,safety};
}
export async function readManagerProfileAdmission(db:D1Database,board:TrainingBoard){
 const ids=new Set(board.people.map(x=>x.id));
 const classIds=new Set(board.resources.filter(x=>x.kind==="class").map(x=>x.id));
 const [a,b]=await Promise.all([
  db.prepare(`SELECT device_id,role,payload_json,revision,state,consent_at,
   verified_revision,verified_by,verification_reference,verified_at,valid_until
   FROM training_ai_profile_submissions WHERE state='verified' LIMIT 1000`).all<TrainingProfileRow>(),
  db.prepare(`SELECT class_id,payload_json,revision,verification_reference,verified_by,verified_at,valid_until
   FROM training_ai_class_safety_attestations LIMIT 500`).all<ClassSafetyRow>()
 ]);
 const profiles=(a.results??[]).filter(row=>ids.has(row.device_id));
 const classes=(b.results??[]).filter(row=>classIds.has(row.class_id));
 const admitted=admitVerifiedTrainingProfiles(profiles,classes,new Date().toISOString());
 return {
  teacher:[...admitted.teacher.values()],learner:[...admitted.learner.values()],
  safety:[...admitted.safety.values()],
  sourceMayBeTruncated:(a.results??[]).length>=1000||(b.results??[]).length>=500,
 };
}
