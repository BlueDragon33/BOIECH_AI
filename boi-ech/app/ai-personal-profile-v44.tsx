"use client";

import {useEffect,useState} from "react";
import {signedConversationProof} from "./teacher-learner-conversation-client";
import styles from "./ai-personal-profile-v44.module.css";

type Role="teacher"|"learner";
type Credential={version:2;privateKey:CryptoKey|null;publicKey:JsonWebKey};
async function ownProof(explicitDeviceId?:string){
 const name=document.documentElement.dataset.accountLocalDatabase||"boi-ech-doc-lap";
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open(name,4);
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
 const credential=await new Promise<Credential|null>((resolve,reject)=>{
  const request=db.transaction("thiet-bi","readonly").objectStore("thiet-bi").get("chinh");
  request.onsuccess=()=>resolve((request.result as Credential|undefined)??null);
  request.onerror=()=>reject(request.error);
 });
 db.close();
 if(!credential?.publicKey||!credential.privateKey)throw new Error("Chưa có khóa ký riêng hợp lệ trên thiết bị này.");
 const canonical=JSON.stringify({kty:credential.publicKey.kty,crv:credential.publicKey.crv,
  x:credential.publicKey.x,y:credential.publicKey.y});
 const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonical));
 const derived=[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,"0")).join("");
 const shell=document.querySelector<HTMLElement>(".app-shell");
 const advertised=shell?.dataset.deviceId??"";
 // Never trust a user-entered or arbitrary account ID; only canonical key binding.
 if(explicitDeviceId&&explicitDeviceId!==derived)throw new Error("Khóa thiết bị và danh tính hồ sơ không trùng.");
 if(advertised&&advertised!==derived)throw new Error("Phiên đăng nhập và khóa thiết bị chưa đồng bộ.");
 return signedConversationProof(derived,undefined,credential);
}
const iso=(value:string)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():"";

export default function AiPersonalProfileV44({role,deviceId}:{role:Role;deviceId?:string}){
 const [status,setStatus]=useState<"unknown"|"disabled"|"missing"|"pending"|"verified"|"withdrawn">("unknown");
 const [revision,setRevision]=useState(0);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [consent,setConsent]=useState(false);
 const [level,setLevel]=useState("beginner");
 const [starts,setStarts]=useState("");
 const [ends,setEnds]=useState("");
 const [certificate,setCertificate]=useState("");
 const [certExpiry,setCertExpiry]=useState("");
 const [maxClasses,setMaxClasses]=useState(3);
 async function refresh(){
  const proof=await ownProof(deviceId);
  const response=await fetch("/api/training-ai-profiles",{
   method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",
   cache:"no-store",body:JSON.stringify({...proof,action:"own-list"})
  });
  const data=await response.json() as {status?:string;revision?:number;error?:string;code?:string;
   profile?:Record<string,unknown>};
  if(response.status===409&&data.code==="AI_PROFILE_ADMISSION_DISABLED"){
   setStatus("disabled");setError("Hồ sơ tự nguyện chưa được phép kích hoạt lưu trữ.");return;
  }
  if(!response.ok)throw new Error(data.error??"Không thể kiểm tra hồ sơ.");
  const next=(data.status??"missing");
  setRevision(data.revision??0);
  setStatus(["pending","verified","withdrawn"].includes(next)?next as typeof status:"missing");
  setConsent(false);
  setError("");
 }
 useEffect(()=>{
  // A visible, authenticated profile area reads its own metadata; it does
  // not submit consent or personal details without a separate user action.
  let alive=true;
  void Promise.resolve().then(()=>refresh()).catch(e=>{
   if(alive)setError(e instanceof Error?e.message:"Không thể tải hồ sơ.");
  });
  return()=>{alive=false};
 // Role/identity changes remount the parent shell, no hidden polling.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[role,deviceId]);
 async function save(action:"submit"|"withdraw"){
  if(busy||status==="disabled")return;
  if(action==="submit"&&!consent){setError("Cần đánh dấu tự nguyện đồng ý trước khi gửi.");return;}
  if(action==="withdraw"&&!window.confirm("Rút đồng ý sẽ ngừng sử dụng hồ sơ bổ sung để gợi ý phân công. Tiếp tục?"))return;
  const available=iso(starts),until=iso(ends);
  if(action==="submit"&&(!available||!until||Date.parse(available)>=Date.parse(until)||
    (role==="teacher"&&(!/^[A-Za-z0-9._:-]{3,64}$/.test(certificate)||!iso(certExpiry)))))
   {setError("Điền chứng chỉ hoặc khung giờ hợp lệ trước khi gửi.");return;}
  const profile=role==="teacher"?{
   certificates:[{code:certificate,validUntil:iso(certExpiry)}],
   available:[{startsAt:available,endsAt:until}],absences:[],maxActiveClasses:maxClasses
  }:{
   declaredLevel:level,desiredWindows:[{startsAt:available,endsAt:until}]
  };
  setBusy(true);setError("");
  try{
   const proof=await ownProof(deviceId);
   const response=await fetch("/api/training-ai-profiles",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({...proof,action,expectedRevision:revision,
     ...(action==="submit"?{consent:true,profile}:{})})
   });
   const data=await response.json() as {ok?:boolean;error?:string};
   if(!response.ok||!data.ok)throw new Error(data.error??"Không thể cập nhật hồ sơ.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Yêu cầu thất bại.");}
  finally{setBusy(false);}
 }
 return <section className={styles.root} aria-label="Hồ sơ AI bổ sung tự nguyện"
   data-ai-own-profile="v44" data-role={role}>
  <header><span>HỒ SƠ AI TỰ NGUYỆN</span>
   <h3>{role==="teacher"?"Chứng chỉ và thời gian sẵn sàng":"Trình độ và giờ học mong muốn"}</h3>
   <p>Chỉ dùng để đối chiếu phân lớp. Thông tin tự khai không tự trở thành chứng chỉ; cán bộ phải xác minh. Có thể rút đồng ý bất cứ lúc nào.</p>
  </header>
  <p role="status" aria-live="polite" className={styles.status}>
   {status==="unknown"?"Đang kiểm tra hồ sơ…":status==="disabled"?"Chưa kích hoạt lưu trữ dữ liệu bổ sung.":
    status==="verified"?"Đã được cán bộ xác minh (có hiệu lực theo chứng từ).":
    status==="pending"?"Đã gửi, đang chờ cán bộ đối chiếu.":status==="withdrawn"?"Đã rút đồng ý.":"Chưa có hồ sơ bổ sung."}
  </p>
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  {status!=="unknown"&&status!=="disabled"?<>
   <div className={styles.grid}>
    {role==="teacher"?<>
     <label>Mã chứng chỉ (không nhập giấy tờ định danh)
      <input value={certificate} onChange={e=>setCertificate(e.target.value)} maxLength={64} placeholder="SWIM-COACH-01"/></label>
     <label>Hết hạn chứng chỉ
      <input type="datetime-local" value={certExpiry} onChange={e=>setCertExpiry(e.target.value)}/></label>
     <label>Giới hạn số lớp có thể phụ trách
      <input type="number" min={1} max={12} value={maxClasses}
       onChange={e=>setMaxClasses(Number(e.target.value))}/></label>
    </>:<label>Trình độ tự đánh giá
     <select value={level} onChange={e=>setLevel(e.target.value)}>
      <option value="beginner">Cơ bản</option><option value="intermediate">Trung cấp</option>
      <option value="advanced">Nâng cao</option>
     </select></label>}
    <label>Khung giờ bắt đầu
     <input type="datetime-local" value={starts} onChange={e=>setStarts(e.target.value)}/></label>
    <label>Khung giờ kết thúc
     <input type="datetime-local" value={ends} onChange={e=>setEnds(e.target.value)}/></label>
   </div>
   <label className={styles.consent}>
    <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
    Tôi tự nguyện gửi dữ liệu này để cán bộ xác minh phục vụ phân lớp; không đồng ý sử dụng cho mục đích khác.
   </label>
   <div className={styles.actions}>
    <button type="button" disabled={busy||!consent} onClick={()=>void save("submit")}>
     {busy?"Đang lưu…":"Gửi / cập nhật hồ sơ"}</button>
    {status!=="missing"&&status!=="withdrawn"?
     <button type="button" disabled={busy} onClick={()=>void save("withdraw")}>Rút đồng ý</button>:null}
   </div>
  </>:null}
 </section>;
}
