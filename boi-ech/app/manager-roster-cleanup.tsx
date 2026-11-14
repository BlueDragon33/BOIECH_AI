"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import type {TrainingProof} from "./training-client";
import {ManagerSheet} from "./manager-details";
import styles from "./manager-workspace.module.css";

type RecordRow={deviceId:string;name:string;role:string;status:string;category:string;
 className:string|null;createdAt:string;lastSeenAt:string|null;inactiveDays:number;
 eligible:boolean;blockers:string[];snapshot:string};
type Preview={verified:true;contract:"boi-manager-roster-cleanup.v1";action:"preview";
 days:7|14|30;records:RecordRow[];scanned:number;eligible:number;protected:number;
 hasMore:boolean;nextCursor:string|null};
const MAX=10;
const label=(v:string)=>v==="teacher"?"Giảng viên":"Học viên";
export default function ManagerRosterCleanup({target,onClose,getProof,onChanged}:{
 target:string|null;onClose:()=>void;getProof:(signal?:AbortSignal)=>Promise<TrainingProof>;
 onChanged:()=>void;
}){
 const [days,setDays]=useState<7|14|30>(7);
 const [preview,setPreview]=useState<Preview|null>(null);
 const [selected,setSelected]=useState<string[]>([]);
 const [reason,setReason]=useState("Cán bộ xác nhận hồ sơ cũ không sử dụng và không có dữ liệu học tập");
 const [confirmation,setConfirmation]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const lock=useRef(false);
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;}},[]);
 const matching=useMemo(()=>preview?.records.filter(r=>selected.includes(r.deviceId)&&r.eligible)??[],[preview,selected]);
 async function call(body:Record<string,unknown>){
  const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),15000);
  try {
   const proof=await getProof(controller.signal);
   controller.signal.throwIfAborted();
   const response=await fetch("/api/manager/roster-cleanup",{method:"POST",credentials:"same-origin",
     cache:"no-store",signal:controller.signal,headers:{"content-type":"application/json"},
     body:JSON.stringify({...body,...proof})});
   const data=await response.json().catch(()=>null) as Record<string,unknown>|null;
   if(!response.ok||data?.verified!==true||data.contract!=="boi-manager-roster-cleanup.v1")
     throw new Error(typeof data?.error==="string"?data.error:"Chưa xác minh được kết quả từ D1.");
   return data;
  } finally {window.clearTimeout(timer);}
 }
 async function scan(nextDays=days,cursor?:string){
  if(lock.current)return;
  lock.current=true;setBusy(true);setError("");setMessage("");
  try {
   const data=await call({action:"preview",days:nextDays,...(cursor?{cursor}:{})});
   if(data.action!=="preview"||!Array.isArray(data.records))throw new Error("Danh sách D1 không hợp lệ.");
   if(alive.current){setPreview(data as Preview);setSelected([]);setConfirmation("");}
  }catch(e){if(alive.current){setPreview(null);setSelected([]);setError(e instanceof Error?e.message:"Không quét được.");}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 useEffect(()=>{
  if(!target)return;
  const run=window.setTimeout(()=>{void scan();},0);
  return()=>window.clearTimeout(run);
 // A new target reopens the review, but a revised days filter loads explicitly.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[target]);
 async function purge(){
  if(lock.current||!matching.length||matching.length>MAX)return;
  if(confirmation!=="XOA HO SO CU"||reason.trim().length<10){
   setError("Nhập XOA HO SO CU và lý do tối thiểu 10 ký tự.");return;
  }
  if(!window.confirm("Xóa vĩnh viễn "+matching.length+
    " hồ sơ cũ đã quét an toàn khỏi D1? Không hoàn tác. Hồ sơ có tài khoản, tiến độ hoặc lịch sử bị bảo vệ."))return;
  lock.current=true;setBusy(true);setError("");setMessage("");
  let done=0;
  try{
   for(const r of matching){
    const result=await call({action:"purge",days,deviceId:r.deviceId,
      snapshot:r.snapshot,reason:reason.trim(),confirmation:"XOA HO SO CU"});
    if(result.deleted!==true)throw new Error("Chưa có xác nhận đã xóa từ D1.");
    done++;
   }
   if(alive.current){setMessage("Đã xóa và xác minh "+done+"/"+matching.length+
     " hồ sơ cũ. Nhật ký kiểm toán được giữ.");setSelected([]);setPreview(null);setConfirmation("");}
  }catch(e){if(alive.current){setError("Đã xác minh "+done+"/"+matching.length+
    ". Đã dừng tại lỗi tiếp theo, không gửi lại tự động: "+(e instanceof Error?e.message:"Chưa xác minh."));setPreview(null);setSelected([]);}}
  finally{lock.current=false;if(alive.current)setBusy(false);if(done>0)onChanged();}
 }
 if(!target)return null;
 const visible=preview?.records.filter(r=>target==="all"||r.deviceId===target)??[];
 const eligible=visible.filter(r=>r.eligible);
 const toggle=(id:string,checked:boolean)=>setSelected(ids=>checked?
   [...ids.filter(x=>x!==id),id].slice(0,MAX):ids.filter(x=>x!==id));
 return <ManagerSheet title="Thanh lọc nhân sự cũ · Xác minh D1" busy={busy} onClose={onClose} error={error}>
  <section className={styles.rosterClean} aria-label="Thanh lọc có điều kiện">
   <p>Danh sách Nhân sự gồm cả bản ghi thiết bị cũ và tài khoản Account-first.
     <strong> Chỉ xóa được hồ sơ cũ chưa từng duyệt, chưa liên kết tài khoản và không có dữ liệu.</strong>
     Hồ sơ đang hoạt động, hết hạn nhưng có lịch sử, tài khoản mới và chứng nhận đều được bảo vệ.</p>
   <div className={styles.rosterCleanControls}>
    <label>Không hoạt động tối thiểu
     <select value={days} disabled={busy} onChange={e=>{const n=Number(e.target.value) as 7|14|30;
       setDays(n);setPreview(null);setSelected([]);setConfirmation("");}}>
      <option value={7}>7 ngày</option><option value={14}>14 ngày</option><option value={30}>30 ngày</option>
     </select></label>
    <button type="button" disabled={busy} onClick={()=>void scan()}>{busy?"Đang xác minh…":"Quét D1 · Không xóa"}</button>
   </div>
   {preview?<div className={styles.rosterCleanSummary} role="status">
    <span>Đã quét: <strong>{preview.scanned}</strong></span>
    <span>Đủ điều kiện trong trang: <strong>{preview.eligible}</strong></span>
    <span>Được bảo vệ: <strong>{preview.protected}</strong></span>
   </div>:null}
   {message?<p role="status" className={styles.rosterCleanSuccess}>{message}</p>:null}
   {preview?<><div className={styles.rosterCleanChoices}>
    <button type="button" disabled={busy||!eligible.length}
      onClick={()=>setSelected(eligible.slice(0,MAX).map(r=>r.deviceId))}>Chọn tối đa {MAX} hồ sơ đủ điều kiện</button>
    <button type="button" disabled={busy||!selected.length} onClick={()=>setSelected([])}>Bỏ chọn</button>
   </div>
   <div className={styles.rosterCleanList}>
    {visible.map(r=><label key={r.deviceId} className={styles.rosterCleanItem}>
      <input type="checkbox" checked={selected.includes(r.deviceId)} disabled={busy||!r.eligible||
        (!selected.includes(r.deviceId)&&selected.length>=MAX)}
        onChange={e=>toggle(r.deviceId,e.target.checked)}/>
      <span><strong>{r.name}</strong><small>{label(r.role)} · {r.category==="account-first"?"Account-first":"Hồ sơ cũ"}
        {" · "}{r.status} · {r.inactiveDays} ngày không hoạt động</small>
        <small>Lớp/đơn vị: {r.className||"Chưa phân lớp"}</small>
        <code title={r.deviceId}>{r.deviceId.slice(0,16)}…</code>
        <small>{r.eligible?"Đủ điều kiện xóa, phải xác nhận thủ công":
          "Không được xóa: "+r.blockers.join("; ")}</small>
      </span></label>)}
    {!visible.length?<p role="status">Không thấy hồ sơ phù hợp trong trang quét. Đổi bộ lọc hoặc liên hệ Owner để kiểm tra.</p>:null}
   </div>
   {preview.hasMore?<button type="button" disabled={busy}
     onClick={()=>void scan(days,preview.nextCursor||undefined)}>Xem trang kế tiếp (100 bản ghi/trang)</button>:null}
   </>:null}
   {matching.length>0?<fieldset className={styles.rosterCleanDanger} disabled={busy}>
     <legend>Xóa có điều kiện · {matching.length} hồ sơ</legend>
     <p>Xóa vĩnh viễn dữ liệu chưa sử dụng; đối chiếu lại D1 từng hồ sơ trước khi xóa.
        Nhật ký kiểm toán không bị xóa.</p>
     <label>Lý do (ít nhất 10 ký tự)<textarea rows={2} maxLength={300} value={reason}
       onChange={e=>setReason(e.target.value)}/></label>
     <label>Nhập chính xác XOA HO SO CU<input autoComplete="off" value={confirmation}
       onChange={e=>setConfirmation(e.target.value.toUpperCase())}/></label>
     <button type="button" className={styles.rosterCleanDelete}
       disabled={confirmation!=="XOA HO SO CU"||reason.trim().length<10}
       onClick={()=>void purge()}>Xóa {matching.length} hồ sơ · Xác minh lại D1</button>
   </fieldset>:null}
   <p className={styles.rosterCleanFootnote}>Tài khoản Account-first và hồ sơ từng duyệt chỉ có Owner
     mới được đánh giá bằng công cụ Thanh lọc tài khoản trong Application-Management.
     Số hồ sơ đủ điều kiện không mặc định bằng tổng Nhân sự trừ tổng tài khoản Gia hạn.</p>
  </section>
 </ManagerSheet>;
}
