"use client";
import TrainingAiConsentPanelV44,{type ConsentActionV44,type ConsentResponseV44}
 from "./training-ai-consent-panel-v44";
import {readLearnerCredential,signedLearnerProof} from "./student-teacher-inbox";

/** Learner identity and request proof always come from the currently active signed device. */
export default function StudentAiConsentV44({deviceId}:{deviceId:string}){
 const call=async(request:ConsentActionV44):Promise<ConsentResponseV44>=>{
  if(!deviceId)throw new Error("Không xác định được thiết bị Học viên.");
  const credential=await readLearnerCredential();
  if(!credential)throw new Error("Chưa có khóa ký thiết bị.");
  const proof=await signedLearnerProof(credential,deviceId);
  const response=await fetch("/api/training-ai-profiles",{
   method:"POST",credentials:"same-origin",cache:"no-store",
   headers:{"content-type":"application/json"},
   body:JSON.stringify({...proof,...request})
  });
  const result=await response.json() as ConsentResponseV44;
  if(!response.ok)throw new Error(result.code==="AI_PROFILE_ADMISSION_DISABLED"?
   "AI_PROFILE_ADMISSION_DISABLED — Chủ dữ liệu chưa mở nhận hồ sơ tự nguyện.":
   result.error??"Không thể kiểm tra hồ sơ của học viên.");
  return result;
 };
 return <TrainingAiConsentPanelV44 role="learner" onRequest={call}/>;
}
