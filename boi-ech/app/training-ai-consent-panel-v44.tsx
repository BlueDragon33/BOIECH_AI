"use client";
import {useState,type FormEvent} from "react";

type Slot={startsAt:string;endsAt:string};
export type ConsentResponseV44={
 ok?:boolean;status?:"missing"|"pending"|"verified"|"withdrawn";
 revision?:number;profile?:Record<string,unknown>|null;message?:string;
 code?:string;error?:string;
};
export type ConsentActionV44={
 action:"own-list"|"submit"|"withdraw";expectedRevision?:number;
 consent?:boolean;profile?:Record<string,unknown>;
};
const asIso=(value:string)=>{
 const timestamp=Date.parse(value);
 if(!Number.isFinite(timestamp))throw new Error("Vui lòng chọn ngày giờ hợp lệ.");
 return new Date(timestamp).toISOString();
};
const slot=(start:string,end:string):Slot=>{
 const a=asIso(start),b=asIso(end);
 if(Date.parse(a)>=Date.parse(b))throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
 return {startsAt:a,endsAt:b};
};
/** Never store credentials, consent or private profile in localStorage. */
export default function TrainingAiConsentPanelV44({role,onRequest}:{
 role:"teacher"|"learner";
 onRequest:(request:ConsentActionV44)=>Promise<ConsentResponseV44>;
}){
 const [loaded,setLoaded]=useState(false),[disabled,setDisabled]=useState(false);
 const [status,setStatus]=useState("chưa kiểm tra");
 const [revision,setRevision]=useState(0);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false),[consent,setConsent]=useState(false);
 const [withdrawConfirm,setWithdrawConfirm]=useState(false);
 const [start,setStart]=useState(""),[end,setEnd]=useState("");
 const [absentStart,setAbsentStart]=useState(""),[absentEnd,setAbsentEnd]=useState("");
 const [cert,setCert]=useState(""),[certExpiry,setCertExpiry]=useState("");
 const [maxClasses,setMaxClasses]=useState(3);
 const [level,setLevel]=useState<"beginner"|"intermediate"|"advanced">("beginner");

 const get=async()=>{
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const r=await onRequest({action:"own-list"});
   setRevision(Number.isSafeInteger(r.revision)?Number(r.revision):0);
   setStatus(r.status??"missing");setLoaded(true);setDisabled(false);
   setNotice(r.message??"Chỉ bạn và người quản lý được xác thực mới có thể truy cập nguồn này.");
  }catch(e){
   const message=e instanceof Error?e.message:"Không thể xác minh chính sách.";
   if(message.includes("AI_PROFILE_ADMISSION_DISABLED"))setDisabled(true);
   setError(message);
  }finally{setBusy(false);}
 };
 const submit=async(event:FormEvent)=>{
  event.preventDefault();
  if(busy||!loaded||disabled)return;
  setError("");setNotice("");
  if(!consent){setError("Cần tự nguyện đồng ý với đúng mục đích ghép lớp trước khi gửi.");return;}
  try{
   const available=slot(start,end);
   const profile=role==="teacher"?{
    certificates:cert.trim()?[{code:cert.trim(),validUntil:asIso(certExpiry)}]:[],
    available:[available],absences:absentStart&&absentEnd?[slot(absentStart,absentEnd)]:[],
    maxActiveClasses:maxClasses
   }:{declaredLevel:level,desiredWindows:[available]};
   setBusy(true);
   const r=await onRequest({action:"submit",expectedRevision:revision,consent:true,profile});
   if(!r.ok||!Number.isSafeInteger(r.revision))throw new Error(r.error??"Máy chủ chưa nhận hồ sơ.");
   setRevision(Number(r.revision));setStatus(r.status??"pending");setConsent(false);
   setNotice("Đã gửi bản tự khai. Chưa được coi là xác minh chuyên môn hay an toàn bể.");
  }catch(e){setError(e instanceof Error?e.message:"Không thể gửi hồ sơ.");}
  finally{setBusy(false);}
 };
 const withdraw=async()=>{
  if(busy||!loaded||disabled||!withdrawConfirm)return;
  setBusy(true);setError("");setNotice("");
  try{
   const r=await onRequest({action:"withdraw",expectedRevision:revision});
   if(!r.ok||!Number.isSafeInteger(r.revision))
    throw new Error(r.error??"Không xác minh được việc rút đồng ý.");
   setRevision(Number(r.revision));setStatus("withdrawn");setConsent(false);
   setWithdrawConfirm(false);setCert("");setCertExpiry("");setStart("");setEnd("");
   setAbsentStart("");setAbsentEnd("");
   setNotice("Đã yêu cầu rút đồng ý và xóa dữ liệu khai báo khỏi nguồn hoạt động. Hồ sơ đã duyệt không còn hiệu lực.");
  }catch(e){setError(e instanceof Error?e.message:"Rút đồng ý chưa được xác nhận.");}
  finally{setBusy(false);}
 };
 return <section aria-label="Hồ sơ AI tự nguyện V44" data-v44-consent-form={role}>
  <header><h3>Hồ sơ điều phối có đồng ý · V44</h3>
   <p>Không nhập dữ liệu sức khỏe, số điện thoại, ảnh giấy tờ hoặc video.
    Hồ sơ chỉ hỗ trợ kiểm tra ghép lớp, không tự cấp quyền hay phân công.</p></header>
  <button type="button" disabled={busy} onClick={()=>void get()}>
   {busy?"Đang xác thực…":loaded?"Đọc lại trạng thái và phiên bản":"Kiểm tra chính sách sử dụng"}
  </button>
  {error?<p role="alert">{error}</p>:null}
  {loaded?<div>
   <p role="status">Trạng thái: <strong>{status}</strong> · phiên bản {revision}. {notice}</p>
   <form onSubmit={event=>void submit(event)}>
    <label>Bắt đầu ca có thể tham gia<input type="datetime-local" required
     value={start} onChange={event=>setStart(event.target.value)} disabled={busy||disabled}/></label>
    <label>Kết thúc ca<input type="datetime-local" required
     value={end} onChange={event=>setEnd(event.target.value)} disabled={busy||disabled}/></label>
    {role==="teacher"?<div>
      <label>Mã chứng chỉ chuyên môn tự khai (nếu có)<input
       maxLength={64} value={cert} onChange={e=>setCert(e.target.value)}
       placeholder="Ví dụ: SWIM-COACH-01" disabled={busy||disabled}/></label>
      {cert?<label>Chứng chỉ có hiệu lực đến<input type="datetime-local"
       required value={certExpiry} onChange={e=>setCertExpiry(e.target.value)}
       disabled={busy||disabled}/></label>:null}
      <label>Giới hạn lớp có thể phụ trách<input type="number" min={1} max={12}
       value={maxClasses} onChange={e=>setMaxClasses(Number(e.target.value))}
       disabled={busy||disabled}/></label>
      <label>Bắt đầu thời gian vắng (tùy chọn)<input type="datetime-local"
       value={absentStart} onChange={e=>setAbsentStart(e.target.value)}
       disabled={busy||disabled}/></label>
      <label>Kết thúc thời gian vắng (tùy chọn)<input type="datetime-local"
       value={absentEnd} onChange={e=>setAbsentEnd(e.target.value)}
       disabled={busy||disabled}/></label>
    </div>:<label>Trình độ tự khai<select value={level}
       onChange={e=>setLevel(e.target.value as typeof level)} disabled={busy||disabled}>
      <option value="beginner">Mới học</option>
      <option value="intermediate">Đang luyện</option>
      <option value="advanced">Nâng cao</option>
    </select></label>}
    <label><input type="checkbox" checked={consent} disabled={busy||disabled}
      onChange={e=>setConsent(e.target.checked)}/>
      Tôi tự nguyện đồng ý cho dùng những trường tự khai này để xét phù hợp lớp.
      Cán bộ phải xác minh nguồn và tôi có thể rút đồng ý.</label>
    <button type="submit" disabled={busy||disabled||!consent}>Gửi hồ sơ để xác minh</button>
   </form>
   {status!=="missing"&&status!=="withdrawn"?<div>
    <label><input type="checkbox" checked={withdrawConfirm} disabled={busy||disabled}
     onChange={e=>setWithdrawConfirm(e.target.checked)}/>
     Tôi xác nhận rút đồng ý và ngừng sử dụng hồ sơ bổ sung.</label>
    <button type="button" disabled={busy||disabled||!withdrawConfirm}
     onClick={()=>void withdraw()}>Rút đồng ý</button>
   </div>:null}
  </div>:<p>Hệ thống không tự thu thập dữ liệu. Chỉ khi chính sách được Owner phê duyệt và bạn chủ động gửi.</p>}
 </section>;
}
