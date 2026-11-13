"use client";
import {useEffect,useRef,useState} from "react";
import styles from "./manager-renewal-panel.module.css";
type Row={accountId:string;name:string;role:"learner"|"teacher";expiresAt:string;revision:number};
const getError=(value:unknown)=>value instanceof Error?value.message:"Máy chủ chưa xác nhận.";
async function post(payload:Record<string,unknown>){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const res=await fetch("/api/accounts",{
   method:"POST",credentials:"same-origin",cache:"no-store",signal:controller.signal,
   headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  const data=await res.json() as {verified?:boolean;contract?:string;accounts?:Row[];
   ok?:boolean;accountId?:string;entitlement?:{expiresAt:string;revision:number};error?:string};
  if(!res.ok)throw new Error(data.error||"Không xác minh được yêu cầu.");
  return data;
 }catch(e){
  if(controller.signal.aborted)throw new Error("Quá 15 giây. Không tự gửi lại lệnh gia hạn, hãy đọc lại danh sách.");
  throw e;
 }finally{clearTimeout(timeout);}
}
export default function ManagerRenewalPanel(){
 const [rows,setRows]=useState<Row[]|null>(null);
 const [search,setSearch]=useState(""),[role,setRole]=useState<"all"|"teacher"|"learner">("all");
 const [days,setDays]=useState<Record<string,string>>({});
 const [reason,setReason]=useState("Cán bộ xác nhận gia hạn quyền sử dụng");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const lock=useRef(false);
 async function refresh(){
  if(lock.current)return;setBusy(true);setError("");
  try{
   const data=await post({action:"manager-renew-list"});
   if(data.verified!==true||data.contract!=="boi-manager-renew.v1"
    ||!Array.isArray(data.accounts)||data.accounts.some(x=>!/^acc_[a-f0-9]{64}$/.test(x.accountId)))
    throw new Error("Máy chủ không xác minh danh sách tài khoản.");
   setRows(data.accounts);
  }catch(e){setRows(null);setError(getError(e));}finally{setBusy(false);}
 }
 async function renew(record:Row){
  const n=Number(days[record.accountId]??8);
  if(lock.current||!Number.isSafeInteger(n)||n<1||n>365||reason.trim().length<10)return;
  if(!window.confirm("Gia hạn "+n+" ngày cho "+record.name+" ("+record.role+")?"))return;
  lock.current=true;setBusy(true);setError("");setNotice("");
  try{
   const result=await post({action:"manager-renew",accountId:record.accountId,
    expectedRevision:record.revision,days:n,reason:reason.trim()});
   if(result.verified!==true||result.contract!=="boi-manager-renew.v1"||
    result.accountId!==record.accountId||!result.entitlement?.expiresAt||
    result.entitlement.revision!==record.revision+1)
    throw new Error("Máy chủ chưa đọc lại được gia hạn.");
   setNotice("Đã gia hạn "+n+" ngày cho "+record.name+".");
   const data=await post({action:"manager-renew-list"});
   if(data.verified!==true||data.contract!=="boi-manager-renew.v1"||
      !Array.isArray(data.accounts))throw new Error("Gia hạn đã lưu, nhưng cần tải lại danh sách.");
   setRows(data.accounts);
  }catch(e){setError(getError(e));}finally{lock.current=false;setBusy(false);}
 }
 useEffect(()=>{queueMicrotask(()=>{void refresh();});},[]);
 const filtered=(rows??[]).filter(x=>(role==="all"||x.role===role)
  &&(x.name+" "+x.accountId).toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));
 return <section className={styles.panel} aria-label="Gia hạn tài khoản giảng viên và học viên">
  <header><div><small>MANAGER · GIA HẠN TÀI KHOẢN</small><h2>Quản lý thời gian sử dụng</h2>
   <p>Cán bộ có thể gia hạn học viên và giảng viên theo quyền đã được Owner cấp.
     Không thể gia hạn cán bộ quản lý, tài khoản bị khóa hoặc hồ sơ chưa kích hoạt.</p></div>
   <button disabled={busy} onClick={()=>void refresh()}>Đồng bộ LIVE</button></header>
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  {notice?<p role="status" className={styles.notice}>{notice}</p>:null}
  <div className={styles.tools}>
   <label>Tìm tài khoản<input value={search} onChange={e=>setSearch(e.target.value)}
    placeholder="Tên học viên / giảng viên…"/></label>
   <label>Vai trò<select value={role} onChange={e=>setRole(e.target.value as typeof role)}>
     <option value="all">Tất cả</option><option value="learner">Học viên</option><option value="teacher">Giảng viên</option></select></label>
  </div>
  <label className={styles.reason}>Lý do gia hạn (bắt buộc)
   <textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={300} rows={2}/></label>
  <div className={styles.list}>{filtered.map(x=><article key={x.accountId}>
    <div><strong>{x.name||"Chưa khai báo"}</strong><small>{x.role==="teacher"?"Giảng viên":"Học viên"}</small>
      <small>Hết hạn {new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(new Date(x.expiresAt))}</small>
      <code>{x.accountId.slice(0,19)}…</code></div>
    <label>Số ngày gia hạn<input type="number" min={1} max={365} step={1}
      value={days[x.accountId]??"8"}
      disabled={busy} onChange={e=>setDays(v=>({...v,[x.accountId]:e.target.value}))}/></label>
    <button type="button" disabled={busy||reason.trim().length<10||!Number.isSafeInteger(Number(days[x.accountId]??8))
      ||Number(days[x.accountId]??8)<1||Number(days[x.accountId]??8)>365}
      onClick={()=>void renew(x)}>Gia hạn · Xác minh D1</button>
   </article>)}
   {!rows?<p role="status">{busy?"Đang kiểm tra quyền và dữ liệu D1…":"Chưa có dữ liệu được xác minh."}</p>:
     !filtered.length?<p>Không có tài khoản phù hợp.</p>:null}
  </div>
  <footer>Gia hạn được ghi nhật ký; máy chủ tự khóa quyền khi hết hạn nếu không được gia hạn.</footer>
 </section>;
}
