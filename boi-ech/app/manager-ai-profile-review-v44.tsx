"use client";
import {useState} from "react";
import type {TrainingBoard} from "./training-types";
import type {TrainingProof} from "./training-client";

type PendingV44={
 deviceId:string;role:string;revision:number;submittedAt:string;
 profile:Record<string,unknown>;
};
type ManagerReplyV44={
 ok?:boolean;state?:string;revision?:number;
 pending?:PendingV44[];
 safetyRevisions?:{class_id:string;revision:number}[];
 sourcePossiblyTruncated?:boolean;
 error?:string;code?:string;
};
const iso=(raw:string)=>{const n=Date.parse(raw);if(!Number.isFinite(n))throw new Error("Ngày giờ không hợp lệ.");return new Date(n).toISOString();};

/** Human verification, never automatic allocation. Management role verified on server. */
export default function ManagerAiProfileReviewV44({board,getProof}:{
 board:TrainingBoard;getProof:(signal?:AbortSignal)=>Promise<TrainingProof>;
}){
 const [loaded,setLoaded]=useState(false),[pending,setPending]=useState<PendingV44[]>([]);
 const [safety,setSafety]=useState<{class_id:string;revision:number}[]>([]);
 const [partial,setPartial]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [reference,setReference]=useState(""),[validUntil,setValidUntil]=useState("");
 const [classId,setClassId]=useState(""),[cert,setCert]=useState("");
 const [level,setLevel]=useState("beginner"),[ratio,setRatio]=useState(15);
 const [start,setStart]=useState(""),[end,setEnd]=useState("");
 const [safetyConfirmed,setSafetyConfirmed]=useState(false);
 const request=async(payload:Record<string,unknown>)=>{
  const proof=await getProof();
  const response=await fetch("/api/training-ai-profiles",{
   method:"POST",credentials:"same-origin",cache:"no-store",
   headers:{"content-type":"application/json"},
   body:JSON.stringify({...proof,from:board.from,to:board.to,...payload})
  });
  const result=await response.json() as ManagerReplyV44;
  if(!response.ok)throw new Error(result.code==="AI_PROFILE_ADMISSION_DISABLED"?
   "AI_PROFILE_ADMISSION_DISABLED — Chưa có phê duyệt của Owner để nhận dữ liệu hồ sơ.":
   result.error??"Cổng hồ sơ chưa được xác thực.");
  return result;
 };
 const load=async()=>{
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const data=await request({action:"manager-list"});
   setPending(Array.isArray(data.pending)?data.pending:[]);
   setSafety(Array.isArray(data.safetyRevisions)?data.safetyRevisions:[]);
   setPartial(Boolean(data.sourcePossiblyTruncated));
   setLoaded(true);
   setNotice("Chỉ hồ sơ của đúng danh sách quản lý hiện tại. Không có dữ liệu nào tự động được duyệt.");
  }catch(e){setError(e instanceof Error?e.message:"Không thể tải hồ sơ.");}
  finally{setBusy(false);}
 };
 const verify=async(record:PendingV44)=>{
  if(busy)return;
  try{
   if(!/^[A-Za-z0-9._:-]{8,120}$/.test(reference))throw new Error("Cần mã chứng từ nguồn hợp lệ ít nhất 8 ký tự.");
   const expiry=iso(validUntil);
   setBusy(true);setError("");
   await request({action:"verify",deviceId:record.deviceId,
    expectedRevision:record.revision,verificationReference:reference,validUntil:expiry});
   setPending(rows=>rows.filter(row=>row.deviceId!==record.deviceId));
   setNotice("Đã xác minh hồ sơ theo chứng từ và phiên bản. Chưa tự phân lớp.");
  }catch(e){setError(e instanceof Error?e.message:"Không xác minh được hồ sơ.");}
  finally{setBusy(false);}
 };
 const attest=async()=>{
  if(busy)return;
  try{
   if(!safetyConfirmed)throw new Error("Cán bộ phải xác nhận trực tiếp điều kiện an toàn bể.");
   if(!/^[A-Za-z0-9._:-]{8,120}$/.test(reference)||
    !/^[A-Za-z0-9._:-]{3,64}$/.test(cert))throw new Error("Chưa có mã chứng từ hoặc mã chứng chỉ hợp lệ.");
   const klass=board.resources.find(r=>r.id===classId&&r.kind==="class"&&r.status==="active");
   if(!klass)throw new Error("Chưa chọn lớp đang hoạt động.");
   const window={startsAt:iso(start),endsAt:iso(end)};
   if(Date.parse(window.startsAt)>=Date.parse(window.endsAt))throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
   const payload={requiredCertification:cert,requiredLevel:level,
    poolSafetyApproved:true,trainerToLearnerLimit:ratio,trainingWindows:[window]};
   setBusy(true);setError("");
   const expectedRevision=safety.find(x=>x.class_id===classId)?.revision??0;
   const result=await request({action:"attest-class",classId,expectedRevision,
    verificationReference:reference,validUntil:iso(validUntil),profile:payload});
   setSafety(rows=>[...rows.filter(x=>x.class_id!==classId),{class_id:classId,revision:Number(result.revision??expectedRevision+1)}]);
   setNotice("Đã lưu xác nhận an toàn bể có phiên bản và chứng từ. Không tự phân công.");
   setSafetyConfirmed(false);
  }catch(e){setError(e instanceof Error?e.message:"Không xác minh được an toàn lớp.");}
  finally{setBusy(false);}
 };
 return <section aria-label="Nguồn hồ sơ đồng ý và chứng từ V44" data-manager-ai-consent-review-v44>
  <header><h3>Hồ sơ năng lực và an toàn · V44</h3>
   <p>Chỉ đọc, xác minh có chứng từ và CAS. Chưa tự động phân công.</p></header>
  <button type="button" disabled={busy} onClick={()=>void load()}>
   {busy?"Đang xác minh…":loaded?"Làm mới hồ sơ":"Kiểm tra quyền tiếp nhận hồ sơ"}</button>
  {error?<p role="alert">{error}</p>:null}
  {notice?<p role="status">{notice}</p>:null}
  {loaded?<div>
   <p>{pending.length} hồ sơ chờ xác minh.
    {partial?" Nguồn có thể giới hạn bản ghi; không kết luận đã duyệt hết.":""}</p>
   <label>Mã chứng từ nguồn (bắt buộc)<input value={reference} maxLength={120}
    onChange={e=>setReference(e.target.value)} disabled={busy} placeholder="Mã nghiệp vụ đã kiểm tra ngoài hệ thống"/></label>
   <label>Hiệu lực xác minh (không quá 90 ngày)<input type="datetime-local"
    value={validUntil} onChange={e=>setValidUntil(e.target.value)} disabled={busy}/></label>
   <ul>{pending.map(record=><li key={record.deviceId}>
    <strong>{board.people.find(p=>p.id===record.deviceId)?.name??"Hồ sơ không rõ tên"}</strong>
    <small> · {record.role} · phiên bản {record.revision} · {record.submittedAt}</small>
    <button type="button" disabled={busy} onClick={()=>void verify(record)}>
     Đã đối chiếu chứng từ — Xác minh</button>
   </li>)}</ul>
   <fieldset><legend>Xác nhận điều kiện an toàn lớp/bể</legend>
    <label>Lớp<select value={classId} onChange={e=>setClassId(e.target.value)} disabled={busy}>
     <option value="">Chọn lớp đang hoạt động</option>
     {board.resources.filter(r=>r.kind==="class"&&r.status==="active")
      .map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select></label>
    <label>Mã chứng chỉ yêu cầu<input value={cert} onChange={e=>setCert(e.target.value)}
     maxLength={64} disabled={busy}/></label>
    <label>Trình độ tối thiểu<select value={level} onChange={e=>setLevel(e.target.value)} disabled={busy}>
     <option value="beginner">Mới học</option><option value="intermediate">Đang luyện</option>
     <option value="advanced">Nâng cao</option></select></label>
    <label>Sĩ số tối đa theo người phụ trách<input type="number" min={1} max={500}
     value={ratio} onChange={e=>setRatio(Number(e.target.value))} disabled={busy}/></label>
    <label>Bắt đầu buổi học<input type="datetime-local" value={start}
     onChange={e=>setStart(e.target.value)} disabled={busy}/></label>
    <label>Kết thúc buổi học<input type="datetime-local" value={end}
     onChange={e=>setEnd(e.target.value)} disabled={busy}/></label>
    <label><input type="checkbox" checked={safetyConfirmed}
     onChange={e=>setSafetyConfirmed(e.target.checked)} disabled={busy}/>
     Tôi đã trực tiếp kiểm tra nguồn, điều kiện an toàn bể và phạm vi lớp.</label>
    <button type="button" disabled={busy||!safetyConfirmed} onClick={()=>void attest()}>
     Lưu xác minh an toàn lớp</button>
   </fieldset>
  </div>:<p>Không truy cập dữ liệu hồ sơ nếu chưa được chủ dữ liệu cho phép.</p>}
 </section>;
}
