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
 const [editing,setEditing]=useState<string|null>(null);
 const dialogRef=useRef<HTMLElement|null>(null);
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
   setRows(data.accounts);setEditing(null);
  }catch(e){setError(getError(e));}finally{lock.current=false;setBusy(false);}
 }
 useEffect(()=>{queueMicrotask(()=>{void refresh();});},[]);
 const filtered=(rows??[]).filter(x=>(role==="all"||x.role===role)
  &&(x.name+" "+x.accountId).toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));
 useEffect(()=>{
  if(!editing)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const overflow=document.body.style.overflow;document.body.style.overflow="hidden";
  const timer=window.setTimeout(()=>dialogRef.current?.focus(),0);
  const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!busy){event.preventDefault();setEditing(null);}};
  document.addEventListener("keydown",onKey);
  return()=>{window.clearTimeout(timer);document.body.style.overflow=overflow;document.removeEventListener("keydown",onKey);
    if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[editing,busy]);
 const activeRecord=filtered.find(item=>item.accountId===editing)??null;
 // Editing is an opt-in modal: keep the roster compact on large and small screens.
 return <section className={styles.panel} aria-label="Gia hạn tài khoản giảng viên và học viên">
  <header className={styles.heading}>
   <div><small>MANAGER · QUYỀN SỬ DỤNG</small><h2>Thời hạn tài khoản</h2>
    <p>Học viên và giảng viên · Chạm vào biểu tượng lịch để xem và điều chỉnh thời hạn. Mỗi thay đổi có nhật ký và xác minh D1.</p></div>
   <button type="button" disabled={busy} onClick={()=>void refresh()}>↻ Làm mới</button>
  </header>
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  {notice?<p role="status" className={styles.notice}>{notice}</p>:null}
  <div className={styles.tools}>
    <label>Tìm tài khoản<input type="search" value={search} onChange={e=>setSearch(e.target.value)}
      placeholder="Tên học viên / giảng viên…"/></label>
    <label>Vai trò<select value={role} onChange={e=>setRole(e.target.value as typeof role)}>
      <option value="all">Tất cả</option><option value="learner">Học viên</option><option value="teacher">Giảng viên</option>
    </select></label>
  </div>
  {rows?<p className={styles.summary} role="status">Đã xác minh {rows.length} tài khoản · Đang hiển thị {filtered.length} · Quyền gia hạn theo phạm vi cán bộ được cấp</p>:null}
  <div className={styles.list}>
    {filtered.map(x=>{
      const left=x.expiresAt===FOREVER_EXPIRES_AT?null:Math.max(0,Math.ceil((Date.parse(x.expiresAt)-now)/86400000));
      return <article className={styles.accountTile} key={x.accountId}>
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">{x.role==="teacher"?"♧":"♙"}</span>
          <div><strong>{x.name||"Chưa khai báo"}</strong>
            <small>{x.role==="teacher"?"Giảng viên":"Học viên"} · {x.expiresAt===FOREVER_EXPIRES_AT?"Không giới hạn":
              left===0?"Hết hạn":`Còn ${left} ngày`}</small></div>
        </div>
        <div className={styles.termSummary}>
          <span>Hết hạn</span><strong>{x.expiresAt===FOREVER_EXPIRES_AT?"Vĩnh viễn":
            new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(new Date(x.expiresAt))}</strong>
          {x.role==="learner"&&x.progress?<small>{x.progress.completed}/{x.progress.total} bài đã hoàn thành</small>:null}
        </div>
        <button type="button" className={styles.editIcon} disabled={busy}
          aria-label={`Mở gia hạn cho ${x.name||"tài khoản"}`}
          onClick={()=>{setEditing(x.accountId);setError("");}}
          title="Chi tiết và gia hạn">◷ <span>Điều chỉnh</span></button>
      </article>;
    })}
    {!rows?<p role="status">{busy?"Đang xác minh D1…":"Chưa có dữ liệu được xác minh."}</p>:
      !filtered.length?<p>Không có tài khoản phù hợp.</p>:null}
  </div>
  {activeRecord?<div className={styles.backdrop} role="presentation"
    onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setEditing(null);}}>
    <section ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true"
      aria-label={`Gia hạn tài khoản ${activeRecord.name}`} tabIndex={-1}>
      <header><div><small>GIA HẠN CÓ XÁC MINH · ACCOUNT-FIRST V2</small>
        <h2>Điều chỉnh thời hạn</h2><p>{activeRecord.name} · {activeRecord.role==="teacher"?"Giảng viên":"Học viên"}</p></div>
        <button type="button" className={styles.close} disabled={busy} aria-label="Đóng gia hạn"
          onClick={()=>setEditing(null)}>✕</button></header>
      <div className={styles.details}>
        <div><small>Đang có hiệu lực đến</small><strong>{activeRecord.expiresAt===FOREVER_EXPIRES_AT?"Vĩnh viễn":
          new Intl.DateTimeFormat("vi-VN",{dateStyle:"medium",timeStyle:"short"}).format(new Date(activeRecord.expiresAt))}</strong></div>
        {activeRecord.role==="learner"?<div><small>Tiến độ học tập</small>
          <strong>{activeRecord.progress?`${activeRecord.progress.completed}/${activeRecord.progress.total} bài`:"Chưa xác minh"}</strong></div>:null}
      </div>
      <label>Đặt lại thời hạn
        <select value={terms[activeRecord.accountId]??"30d"} disabled={busy}
          onChange={e=>setTerms(v=>({...v,[activeRecord.accountId]:e.target.value as AccountTerm}))}>
          {accountTerms.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
        </select></label>
      <p className={styles.warning}>Hạn mới tính từ thời điểm cấp, không cộng dồn. Tài khoản đang khóa không được gia hạn để vượt quyền.</p>
      <label>Lý do gia hạn (bắt buộc, tối thiểu 10 ký tự)
        <textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={300} rows={3}/></label>
      {error?<p className={styles.error} role="alert">{error}</p>:null}
      <div className={styles.actions}>
        <button type="button" disabled={busy} onClick={()=>setEditing(null)}>Hủy</button>
        <button type="button" disabled={busy||reason.trim().length<10}
          onClick={()=>void renew(activeRecord)}>Xác nhận · Lưu và đọc lại D1</button>
      </div>
    </section>
  </div>:null}
  <footer>Chỉ tài khoản có trạng thái hợp lệ mới được gia hạn. Mọi thao tác đều được kiểm tra quyền phía máy chủ.</footer>
 </section>;
}
