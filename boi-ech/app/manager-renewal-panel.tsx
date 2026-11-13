"use client";
import {useEffect,useRef,useState} from "react";
import styles from "./manager-renewal-panel.module.css";

type AccountTerm="7d"|"30d"|"6m"|"1y"|"4y"|"forever";
const FOREVER_EXPIRES_AT="9999-12-31T23:59:59.000Z";
function replaceExpiryFromNow(term:AccountTerm,now:number):string{
 if(!Number.isFinite(now))throw new Error("TIME_INVALID");
 if(term==="forever")return FOREVER_EXPIRES_AT;
 const date=new Date(now);
 if(term==="7d"||term==="30d")date.setTime(now+(term==="7d"?7:30)*86400000);
 else if(term==="6m"||term==="1y"||term==="4y"){
  const months=term==="6m"?6:term==="1y"?12:48,day=date.getUTCDate();
  date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+months);
  date.setUTCDate(Math.min(day,new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()));
 }else throw new Error("TERM_INVALID");
 return date.toISOString();
}

const accountTerms=[{value:"7d",label:"7 ngày"},{value:"30d",label:"30 ngày"},
 {value:"6m",label:"6 tháng"},{value:"1y",label:"1 năm"},
 {value:"4y",label:"4 năm"},{value:"forever",label:"Vĩnh viễn"}] as const;
type Row={accountId:string;name:string;role:"learner"|"teacher";expiresAt:string;revision:number;progress?:{completed:number;total:number}|null};
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
 const [terms,setTerms]=useState<Record<string,AccountTerm>>({});
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),60000);return()=>window.clearInterval(id);},[]);
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
  const term=terms[record.accountId]??"30d";
  if(lock.current||reason.trim().length<10)return;
  const label=accountTerms.find(x=>x.value===term)?.label??term;
  const expiry=replaceExpiryFromNow(term,now);
  if(!window.confirm("ĐẶT LẠI thời hạn "+label+" cho "+record.name+
    " tính từ hôm nay, không cộng dồn hạn cũ. Hạn mới: "+(term==="forever"?"Vĩnh viễn":new Date(expiry).toLocaleDateString("vi-VN"))+"?"))return;
  lock.current=true;setBusy(true);setError("");setNotice("");
  try{
   const result=await post({action:"manager-renew",accountId:record.accountId,
    expectedRevision:record.revision,term,reason:reason.trim()});
   if(result.verified!==true||result.contract!=="boi-manager-renew.v1"||
    result.accountId!==record.accountId||!result.entitlement?.expiresAt||
    result.entitlement.revision!==record.revision+1)
    throw new Error("Máy chủ chưa đọc lại được gia hạn.");
   setNotice("Đã thay thế hạn bằng "+label+" cho "+record.name+" và đọc lại D1.");
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
     Chọn thời hạn chính xác và đặt lại từ thời điểm cấp. Không cộng dồn vào hạn cũ; tài khoản khóa không được cấp lại.</p></div>
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
      <small>{x.expiresAt===FOREVER_EXPIRES_AT?"Vĩnh viễn":
        "Hết hạn "+new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(new Date(x.expiresAt))}</small>
      <small>{x.expiresAt===FOREVER_EXPIRES_AT?"Thời hạn không giới hạn":
        (()=>{const ms=Math.max(0,Date.parse(x.expiresAt)-now);const years=Math.floor(ms/(365.2425*86400000));
         return years>0?`Còn ${years} năm ${Math.floor((ms-years*365.2425*86400000)/86400000)} ngày`:`Còn ${Math.floor(ms/86400000)} ngày`;})()}</small>
      {x.role==="learner"?<div className={styles.lessonProgress}>
        <strong>Tiến độ học tập</strong>
        {x.progress?<><span>{x.progress.completed}/{x.progress.total} bài đã hoàn thành</span>
         <progress max={x.progress.total} value={x.progress.completed} aria-label={`Tiến độ của ${x.name}`}/></>
         :<span>Chưa có tiến độ được xác minh trên D1</span>}
       </div>:null}
      <code>{x.accountId.slice(0,19)}…</code></div>
    <label>Đặt lại thời hạn
      <select value={terms[x.accountId]??"30d"} disabled={busy}
       onChange={e=>setTerms(v=>({...v,[x.accountId]:e.target.value as AccountTerm}))}>
        {accountTerms.map(t=><option value={t.value} key={t.value}>{t.label}</option>)}
      </select>
      <small>Hạn mới tính từ ngày cấp, không cộng dồn.</small>
    </label>
    <button type="button" disabled={busy||reason.trim().length<10}
      onClick={()=>void renew(x)}>Lưu hạn mới · Xác minh D1</button>
   </article>)}
   {!rows?<p role="status">{busy?"Đang kiểm tra quyền và dữ liệu D1…":"Chưa có dữ liệu được xác minh."}</p>:
     !filtered.length?<p>Không có tài khoản phù hợp.</p>:null}
  </div>
  <footer>Gia hạn được ghi nhật ký; máy chủ tự khóa quyền khi hết hạn nếu không được gia hạn.</footer>
 </section>;
}
