"use client";

import {useCallback,useEffect,useState} from "react";
import type {TrainingBoard} from "./training-types";
import type {TrainingProof} from "./training-client";
import styles from "./manager-ai-allocation-v42.module.css";

type PendingProfile={deviceId:string;role:"teacher"|"learner";revision:number;submittedAt:string;profile:Record<string,unknown>};
type Seal={sourceId:string;revision:number;expiresAt:string};
type ProfileList={
 pending:PendingProfile[];
 verified:{teacher:{teacherId:string;seal:Seal}[];learner:{learnerId:string;seal:Seal}[];
  safety:{classId:string;seal:Seal}[];sourceMayBeTruncated:boolean};
 safetyRevisions:{class_id:string;revision:number}[];
 sourcePossiblyTruncated:boolean;
};
type Props={board:TrainingBoard;getProof: (signal?:AbortSignal)=>Promise<TrainingProof>};
const blank:ProfileList={pending:[],verified:{teacher:[],learner:[],safety:[],sourceMayBeTruncated:false},
 safetyRevisions:[],sourcePossiblyTruncated:false};
const iso=(value:string)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():"";
function proofWindowValid(reference:string,until:string){
 const now=Date.now();
 return /^[A-Za-z0-9._:-]{8,120}$/.test(reference)&&Boolean(until)&&
  Date.parse(until)>now&&Date.parse(until)<=now+90*86400000;
}
function summary(profile:PendingProfile){
 if(profile.role==="teacher"){
  const codes=Array.isArray(profile.profile.certificates)?profile.profile.certificates
   .map(c=>c&&typeof c==="object"?(c as {code?:unknown}).code:"").filter(x=>typeof x==="string"):[];
  const available=Array.isArray(profile.profile.available)?profile.profile.available.length:0;
  return `Chứng chỉ tự khai: ${codes.join(", ")||"không có"} · ${available} ca rảnh · giới hạn ${String(profile.profile.maxActiveClasses??"—")} lớp`;
 }
 const windows=Array.isArray(profile.profile.desiredWindows)?profile.profile.desiredWindows.length:0;
 return `Trình độ tự khai: ${String(profile.profile.declaredLevel??"—")} · ${windows} ca mong muốn`;
}

export default function ManagerAiProfilesV44({board,getProof}:Props){
 const [data,setData]=useState<ProfileList>(blank);
 const [state,setState]=useState<"loading"|"ready"|"disabled"|"error">("loading");
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [reference,setReference]=useState("");
 const [validUntil,setValidUntil]=useState("");
 const [targetClass,setTargetClass]=useState("");
 const [requiredCertification,setRequiredCertification]=useState("");
 const [requiredLevel,setRequiredLevel]=useState("beginner");
 const [learnerLimit,setLearnerLimit]=useState(12);
 const [startsAt,setStartsAt]=useState("");
 const [endsAt,setEndsAt]=useState("");
 const [safetyConfirmed,setSafetyConfirmed]=useState(false);
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  const proof=await getProof(signal);
  const response=await fetch("/api/training-ai-profiles",{
   method:"POST",headers:{"content-type":"application/json"},cache:"no-store",
   credentials:"same-origin",signal,
   body:JSON.stringify({...proof,action:"manager-list",from:board.from,to:board.to})
  });
  const json=await response.json() as ProfileList&{error?:string;code?:string};
  if(!response.ok&&json.code==="AI_PROFILE_ADMISSION_DISABLED"){
   setState("disabled");setMessage("Dữ liệu cá nhân bổ sung chưa được kích hoạt theo chính sách lưu trữ/đồng ý.");return;
  }
  if(!response.ok)throw new Error(json.error??"Không thể đọc hồ sơ xác minh.");
  setData(json);setState("ready");setMessage("");
 },[getProof,board.from,board.to]);
 useEffect(()=>{
  const controller=new AbortController();
  void Promise.resolve().then(()=>refresh(controller.signal)).catch(error=>{
   if(controller.signal.aborted)return;
   setState("error");setMessage(error instanceof Error?error.message:"Không thể đồng bộ.");
  });
  return ()=>controller.abort();
 },[refresh,board.observedAt]);
 async function submit(action:"verify"|"attest-class",deviceId="",revision=0){
  if(busy)return;
  const until=iso(validUntil);
  if(!proofWindowValid(reference,until)){
   setMessage("Cần mã chứng từ tối thiểu 8 ký tự và hạn kiểm chứng trong 90 ngày tới.");return;
  }
  if(action==="attest-class"&&(!targetClass||!safetyConfirmed||!requiredCertification||
    !iso(startsAt)||!iso(endsAt)||Date.parse(startsAt)>=Date.parse(endsAt))){
   setMessage("Chọn lớp, xác nhận an toàn, mã chứng chỉ và giờ học hợp lệ.");return;
  }
  setBusy(true);
  try{
   const proof=await getProof();
   const profile={requiredCertification,requiredLevel,poolSafetyApproved:safetyConfirmed,
    trainerToLearnerLimit:learnerLimit,trainingWindows:[{startsAt:iso(startsAt),endsAt:iso(endsAt)}]};
   const expectedRevision=action==="verify"?revision:
    data.safetyRevisions.find(x=>x.class_id===targetClass)?.revision??0;
   const response=await fetch("/api/training-ai-profiles",{
    method:"POST",cache:"no-store",credentials:"same-origin",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({...proof,from:board.from,to:board.to,action,
     verificationReference:reference,validUntil:until,expectedRevision,
     ...(action==="verify"?{deviceId}:{classId:targetClass,profile})})
   });
   const result=await response.json() as {ok?:boolean;error?:string;code?:string};
   if(!response.ok||!result.ok)throw new Error(result.error??"Chưa lưu được chứng từ.");
   await refresh();
   setMessage(action==="verify"?"Đã xác minh hồ sơ theo chứng từ.":"Đã đối chiếu an toàn và lịch của lớp.");
  }catch(error){setMessage(error instanceof Error?error.message:"Không xác minh được.");}
  finally{setBusy(false);}
 }
 return <section className={styles.root} data-manager-ai-profiles="v44" aria-label="Hồ sơ bổ sung đã đồng ý">
  <header className={styles.hero}><div><small>V44 · CHỨNG TỪ & AN TOÀN</small>
   <h3>Hồ sơ năng lực và lịch rảnh</h3>
   <p>Chỉ xem hồ sơ cá nhân tự nguyện gửi; cán bộ phải đối chiếu chứng từ, lịch bể và điều kiện an toàn trước khi ghi xác minh. Không dùng dữ liệu thiếu căn cứ làm chứng chỉ.</p>
  </div><span>{state==="ready"?"Đối chiếu thủ công":state==="disabled"?"Chưa kích hoạt dữ liệu":"Đang kiểm tra"}</span></header>
  <p className={styles.qualification} role="status" aria-live="polite">{message||
   (state==="loading"?"Đang xác minh quyền truy cập…":state==="ready"?
    "Mã chứng từ và hạn xác minh không được suy đoán; lưu lại bản gốc theo quy định của đơn vị.":"")}</p>
  {state==="ready"?<>
   {data.sourcePossiblyTruncated?<p role="alert">Danh sách có thể vượt giới hạn nguồn; chưa phê duyệt dựa trên bảng thiếu.</p>:null}
   <div className={styles.stats}>
    <div><strong>{data.pending.length}</strong><span>Hồ sơ chờ xác minh</span></div>
    <div><strong>{data.verified.teacher.length}</strong><span>Giảng viên đủ chứng từ</span></div>
    <div><strong>{data.verified.learner.length}</strong><span>Học viên xác minh</span></div>
    <div><strong>{data.verified.safety.length}</strong><span>Lớp được xác nhận an toàn</span></div>
   </div>
   <div className={styles.records}>
    <p>Chỉ xác minh khi đã đối chiếu tài liệu gốc và có cơ sở lưu trữ phù hợp.</p>
    <label>Mã chứng từ nguồn (không nhập giấy tờ tùy thân)
     <input value={reference} onChange={e=>setReference(e.target.value)} maxLength={120} autoComplete="off" placeholder="DOC-VERIFIED-001"/></label>
    <label>Hết hạn xác minh (tối đa 90 ngày)
     <input type="datetime-local" value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></label>
    {data.pending.length?data.pending.map(p=><article key={p.deviceId} className={styles.record}>
     <strong>{p.role==="teacher"?"Giảng viên":"Học viên"} · {p.deviceId}</strong>
     <p>{summary(p)}</p>
     <small>Phiên bản {p.revision} · nguồn chưa xác minh</small>
     <div className={styles.actions}><button type="button" disabled={busy||data.sourcePossiblyTruncated}
       onClick={()=>void submit("verify",p.deviceId,p.revision)}>Xác minh chứng từ</button></div>
    </article>):<p>Hiện không có hồ sơ tự nguyện đang chờ.</p>}
    <section aria-label="Xác nhận an toàn và lịch lớp">
     <h4>Chứng thực điều kiện lớp/bể</h4>
     <label>Lớp
      <select value={targetClass} onChange={e=>setTargetClass(e.target.value)}>
       <option value="">Chọn lớp cần xác minh</option>
       {board.resources.filter(r=>r.kind==="class"&&r.status==="active").map(r=>
        <option key={r.id} value={r.id}>{r.name}</option>)}
      </select></label>
     <label>Chứng chỉ bắt buộc
      <input value={requiredCertification} onChange={e=>setRequiredCertification(e.target.value)} placeholder="SWIM-COACH-01"/></label>
     <label>Trình độ được phép
      <select value={requiredLevel} onChange={e=>setRequiredLevel(e.target.value)}>
       <option value="beginner">Cơ bản</option><option value="intermediate">Trung cấp</option>
       <option value="advanced">Nâng cao</option>
      </select></label>
     <label>Số học viên/giảng viên tối đa được xác minh
      <input type="number" min={1} max={500} value={learnerLimit}
       onChange={e=>setLearnerLimit(Number(e.target.value))}/></label>
     <label>Ca bắt đầu <input type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)}/></label>
     <label>Ca kết thúc <input type="datetime-local" value={endsAt} onChange={e=>setEndsAt(e.target.value)}/></label>
     <label><input type="checkbox" checked={safetyConfirmed} onChange={e=>setSafetyConfirmed(e.target.checked)}/>
      Tôi đã đối chiếu an toàn bể, chứng chỉ và lịch thực tế</label>
     <div className={styles.actions}><button disabled={busy||data.sourcePossiblyTruncated||!safetyConfirmed}
       type="button" onClick={()=>void submit("attest-class")}>Lưu xác nhận điều kiện lớp</button></div>
    </section>
   </div>
  </>:null}
 </section>;
}
