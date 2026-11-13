"use client";
import {useEffect,useState} from "react";
import styles from "./manager-renewal-panel.module.css";
type Entry={accountId:string;name:string|null;role:string;status:string;stage:string;
 entitlementState:string;expiresAt:string;entitlementRevision:number;remainingMs:number};
type Payload={verified?:boolean;records?:Entry[];entitlement?:{expiresAt:string;revision:number};error?:string;code?:string};
async function call(input:Record<string,unknown>):Promise<Payload>{
 const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),16000);
 try{
  const r=await fetch("/api/accounts",{method:"POST",credentials:"same-origin",cache:"no-store",
   headers:{"content-type":"application/json"},signal:ctl.signal,body:JSON.stringify(input)});
  const d=await r.json().catch(()=>({})) as Payload;
  if(!r.ok)throw new Error(d.error||"Không thể xác minh thời hạn tài khoản từ máy chủ.");
  return d;
 }finally{clearTimeout(timeout);}
}
export default function ManagerRenewalPanel(){
 const [rows,setRows]=useState<Entry[]|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [reason,setReason]=useState("Cán bộ quản lý gia hạn quyền sử dụng theo yêu cầu");
 const [filter,setFilter]=useState<"all"|"learner"|"teacher">("all");
 async function refresh(){
  if(busy)return;
  setBusy(true);setError("");
  try{
   const d=await call({action:"renewable-accounts"});
   if(d.verified!==true||!Array.isArray(d.records))throw Error("Danh sách chưa được xác minh.");
   setRows(d.records);
  }catch(e){setRows(null);setError(e instanceof Error?e.message:"Không thể kết nối D1");}
  finally{setBusy(false);}
 }
 useEffect(()=>{queueMicrotask(()=>{void refresh();});/* initial read only */},[]);
 async function renew(r:Entry){
  if(busy||reason.trim().length<5)return;
  if(!window.confirm("Gia hạn tài khoản "+(r.name||r.accountId)+" theo thời hạn cấu hình của hệ thống?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const result=await call({action:"renew-account",accountId:r.accountId,
    expectedRevision:r.entitlementRevision,reason:reason.trim()});
   if(result.verified!==true||!result.entitlement?.expiresAt)throw Error("Chưa xác minh được kết quả gia hạn.");
   setNotice("Đã gia hạn "+(r.name||r.accountId)+" đến "+
     new Intl.DateTimeFormat("vi-VN",{dateStyle:"medium",timeStyle:"short"}).format(new Date(result.entitlement.expiresAt)));
   // Refresh from canonical D1 after mutation; never optimistic local update.
   const updated=await call({action:"renewable-accounts"});
   if(updated.verified!==true||!Array.isArray(updated.records))throw Error("Gia hạn đã gửi nhưng đọc lại chưa được; không gửi lại.");
   setRows(updated.records);
  }catch(e){setError(e instanceof Error?e.message:"Không xác minh được gia hạn.");}
  finally{setBusy(false);}
 }
 return <section className={styles.panel} aria-label="Gia hạn học viên và giảng viên">
  <header><div><h2>Gia hạn tài khoản</h2>
   <p>Cán bộ quản lý gia hạn Học viên hoặc Giảng viên theo số ngày do Quản trị Bơi Ếch thiết lập.
    Không thể tự gia hạn tài khoản Cán bộ quản lý.</p></div>
   <button type="button" disabled={busy} onClick={()=>void refresh()}>↻ Đồng bộ D1</button></header>
  <div className={styles.options}><label>Nhóm tài khoản
    <select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}>
     <option value="all">Tất cả</option><option value="learner">Học viên</option><option value="teacher">Giảng viên</option>
    </select></label>
   <label>Lý do gia hạn<input value={reason} maxLength={300} onChange={e=>setReason(e.target.value)}/></label>
  </div>
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  {notice?<p role="status" className={styles.success}>{notice}</p>:null}
  {!rows?<p>{busy?"Đang tải dữ liệu…":"Chưa có danh sách xác minh."}</p>:
   <div className={styles.list}>{rows.filter(r=>filter==="all"||r.role===filter).map(r=><article key={r.accountId}>
    <div><strong>{r.name||"Chưa khai báo"}</strong>
     <small>{r.role==="teacher"?"Giảng viên":"Học viên"} · {r.status==="approved"?"Đang được cấp quyền":"Tạm dừng"}</small>
     <small>Thời hạn: {new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(new Date(r.expiresAt))}</small>
     <small>{r.remainingMs>0?"Còn "+Math.ceil(r.remainingMs/86400000)+" ngày":"Đã hết hạn"}</small></div>
    <button type="button" disabled={busy||r.entitlementState!=="active"||r.stage!=="active"||
     r.status!=="approved"||reason.trim().length<5} onClick={()=>void renew(r)}>
     Gia hạn</button>
   </article>)}</div>}
 </section>;
}
