"use client";
import {useCallback,useEffect,useState} from "react";
import type { FormEvent } from "react";
import {flushVerifiedSync,readPendingSync} from "./verified-sync-client";
type Scope="learning-progress"|"study-preferences";
type Consent={scope:string;enabled:number;revision:number;confirmed_at:string|null};
async function call(accountId:string,data:Record<string,unknown>){
 const response=await fetch("/api/accounts/sync",{method:"POST",cache:"no-store",credentials:"same-origin",
  headers:{"content-type":"application/json"},body:JSON.stringify({...data,accountId})});
 const json=await response.json() as {ok?:boolean;result?:unknown;error?:string};
 if(!response.ok||json.ok!==true)throw new Error(json.error??"Không kiểm tra được đồng bộ.");
 return json.result;
}
export default function VerifiedSyncSettings({accountId}:{accountId:string}){
 const [grants,setGrants]=useState<Consent[]>([]),[pending,setPending]=useState(0),[conflicts,setConflicts]=useState(0);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
 const refresh=useCallback(async()=>{
  const [result,local]=await Promise.all([
   call(accountId,{action:"status"}) as Promise<{grants:Consent[]}>,readPendingSync(accountId)]);
  setGrants(result.grants);setPending(local.pending);setConflicts(local.conflicts);
 },[accountId]);
 useEffect(()=>{let alive=true;void refresh().catch(e=>{if(alive)setError(e instanceof Error?e.message:"Không đọc được trạng thái.");});
  return()=>{alive=false};},[refresh]);
 async function toggle(event:FormEvent<HTMLFormElement>,scope:Scope,enabled:boolean){
  event.preventDefault();
  if(busy)return;
  const form=event.currentTarget;const password=String(new FormData(form).get("password")||"");form.reset();
  setBusy(true);setError("");setNotice("");
  try{await call(accountId,{action:"consent",scope,enabled,password});await refresh();
   setNotice(enabled?"Đã xác nhận phạm vi đồng bộ cho thiết bị này.":"Đã thu hồi quyền đồng bộ của thiết bị này.");}
  catch(e){setError(e instanceof Error?e.message:"Đồng bộ chưa được xác nhận.");}
  finally{setBusy(false);}
 }
 async function flush(){
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{const result=await flushVerifiedSync(accountId);await refresh();
   setNotice(`Máy chủ đã xác nhận ${result.sent} bản cập nhật; còn ${result.remaining} chờ, ${result.conflicts} xung đột.`);
   if(result.error)setError(result.error);}
  catch(e){setError(e instanceof Error?e.message:"Không gửi được đồng bộ.");}
  finally{setBusy(false);}
 }
 return <details style={{marginBlock:"1rem"}}><summary><strong>Đồng bộ có xác nhận</strong> · Chưa gửi: {pending} · Xung đột: {conflicts}</summary>
  <p>Đồng bộ chỉ áp dụng cho tiến độ học và tùy chọn học tập. Video, mật khẩu, hồ sơ cá nhân không được sao chép tự động.</p>
  {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
  {(["learning-progress","study-preferences"] as const).map(scope=>{
    const enabled=grants.some(g=>g.scope===scope&&g.enabled===1);
    return <form key={scope} onSubmit={e=>void toggle(e,scope,!enabled)} style={{marginBlock:10}}>
      <strong>{scope==="learning-progress"?"Tiến độ bài học":"Tùy chọn học tập"}</strong>
      <p>{enabled?"Thiết bị này đã được phép đồng bộ.":"Chưa cấp quyền đồng bộ cho thiết bị này."}</p>
      <label>Nhập lại mật khẩu để thay đổi quyền<input name="password" type="password" required autoComplete="current-password" disabled={busy}/></label>
      <button type="submit" disabled={busy}>{enabled?"Tắt đồng bộ":"Xác nhận bật đồng bộ"}</button>
    </form>;
  })}
  <button type="button" disabled={busy||pending===0} onClick={()=>void flush()}>Đồng bộ ngay dữ liệu đang chờ</button>
  <p>Dữ liệu ngoại tuyến chưa được máy chủ xác nhận vẫn giữ trên thiết bị. Khi xung đột, không tự ghi đè.</p>
 </details>;
}
