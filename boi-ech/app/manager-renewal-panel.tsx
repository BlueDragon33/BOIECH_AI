"use client";
import {useEffect,useRef,useState} from "react";
import {accountTerms,isUnlimitedAccountExpiry,replaceExpiryFromNow,type AccountTerm} from "./account-term";
import {accountTermState,accountTimeLabel,expiryDateLabel,renewalCounts,renewalMatchesStatus,renewalStatusText,verifiedProgress,type RenewalRow,type RenewalStatus} from "./manager-renewal-view";
import styles from "./manager-renewal-panel.module.css";
type Row=RenewalRow;
type RenewalIconName="shield"|"clock"|"teacher"|"learner"|"search"|"calendar"|"book"|"edit"|"refresh"|"infinity";
function RenewalIcon({name}:{name:RenewalIconName}){
 return <svg aria-hidden="true" focusable="false" width="22" height="22" viewBox="0 0 24 24"
   fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
  {name==="shield"?<><path d="m12 2 8 3v6c0 5-3.1 8.5-8 11-4.9-2.5-8-6-8-11V5z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></>:null}
  {name==="clock"?<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>:null}
  {name==="teacher"?<><path d="m2 9 10-5 10 5-10 5zM6 11v6c2.8 2.6 9.2 2.6 12 0v-6M22 9v7"/></>:null}
  {name==="learner"?<><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2M17 5a3 3 0 0 1 0 6M17 14a4.5 4.5 0 0 1 3.5 4.4V20"/></>:null}
  {name==="search"?<><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>:null}
  {name==="calendar"?<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18"/></>:null}
  {name==="book"?<><path d="M12 6c-2.7-1.6-6-2-10-1v14c4-1 7.3-.6 10 1 2.7-1.6 6-2 10-1V5c-4-1-7.3-.6-10 1zM12 6v14"/></>:null}
  {name==="edit"?<><path d="m4 16-1 5 5-1L20 8a2.2 2.2 0 0 0-3-3zM14.5 7.5l3 3"/></>:null}
  {name==="refresh"?<><path d="M20 7V3h-4M4 17v4h4"/><path d="M20 7a8 8 0 0 0-14-2M4 17a8 8 0 0 0 14 2"/></>:null}
  {name==="infinity"?<><path d="M12 12C8.8 7 6.8 7 4.7 7a5 5 0 0 0 0 10c2.1 0 4.1 0 7.3-5z"/><path d="M12 12c3.2 5 5.2 5 7.3 5a5 5 0 0 0 0-10c-2.1 0-4.1 0-7.3 5z"/></>:null}
 </svg>;
}
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
 const [statusFilter,setStatusFilter]=useState<RenewalStatus>("all");
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
  && renewalMatchesStatus(x,statusFilter,now)
  && (x.name+" "+x.accountId).toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));
 const counts=renewalCounts(rows??[],now);
 const learners=filtered.filter(x=>x.role==="learner");
 const teachers=filtered.filter(x=>x.role==="teacher");
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
 const activeRecord=rows?.find(item=>item.accountId===editing)??null;

 const accountTile=(x:Row)=>{
  const state=accountTermState(x.expiresAt,now);
  const progress=verifiedProgress(x.progress);
  const unlimited=state==="permanent";
  return <article className={styles.accountTile} key={x.accountId} data-role={x.role} data-term={state}>
    <div className={styles.identity}>
      <span className={styles.avatar} data-role={x.role}><RenewalIcon name={x.role==="teacher"?"teacher":"learner"}/></span>
      <div className={styles.personName}><strong>{x.name||"Chưa khai báo"}</strong>
        <small>{x.role==="teacher"?"Giảng viên":"Học viên"} · {accountTimeLabel(x.expiresAt,now)}</small>
      </div>
      <span className={styles.statusBadge} data-state={state}>{unlimited?<RenewalIcon name="infinity"/>:<RenewalIcon name="clock"/>}{renewalStatusText(state)}</span>
    </div>
    <div className={styles.tileDetails}>
      {unlimited?<div className={styles.permanentInfo} data-permanent="true">
        <span className={styles.detailTitle}>Loại thời hạn</span>
        <strong>Vĩnh viễn</strong><span className={styles.unlimitedValue}><RenewalIcon name="infinity"/> Không giới hạn</span>
      </div>:<div className={styles.expiryInfo}>
        <span className={styles.detailTitle}><RenewalIcon name="calendar"/>{state==="expired"?"Đã hết hạn từ":"Hết hạn vào"}</span>
        <strong>{expiryDateLabel(x.expiresAt)}</strong>
      </div>}
      <div className={styles.learningInfo}>
        {progress?<><span className={styles.detailTitle}><RenewalIcon name="book"/>{progress.completed}/{progress.total} bài đã hoàn thành</span>
           <div className={styles.progressLine}><progress value={progress.completed} max={progress.total} aria-label={"Tiến độ học tập "+(x.name||"tài khoản")}/><strong>{progress.percent}%</strong></div></>
          :<span className={styles.progressEmpty}>{x.role==="learner"?"Chưa có tiến độ được xác minh":"Quyền sử dụng tài khoản giảng viên"}</span>}
      </div>
      <button type="button" className={styles.editIcon} disabled={busy}
        aria-label={"Mở gia hạn cho "+(x.name||"tài khoản")}
        onClick={()=>{setEditing(x.accountId);setError("");}}
        title="Chi tiết và điều chỉnh thời hạn"><RenewalIcon name="edit"/><span>Điều chỉnh</span></button>
    </div>
  </article>;
 };

 // Existing D1 authority and confirmation gates above remain unchanged. Only presentation changes.
 return <section className={styles.panel} aria-label="Gia hạn tài khoản giảng viên và học viên">
  <header className={styles.heading}>
   <div className={styles.headingCopy}><small>MANAGER · QUYỀN SỬ DỤNG</small><h2>Thời hạn tài khoản</h2>
     <p>Quản lý và gia hạn thời hạn tài khoản của học viên và giảng viên. Theo dõi trạng thái, thời gian còn lại và điều chỉnh quyền sử dụng theo đúng phạm vi được cấp.</p>
   </div>
   <button type="button" className={styles.refresh} disabled={busy} onClick={()=>void refresh()}>
     <RenewalIcon name="refresh"/> Làm mới
   </button>
  </header>
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  {notice?<p role="status" className={styles.notice}>{notice}</p>:null}
  <section className={styles.metrics} aria-label="Thống kê tài khoản đã xác minh">
   {([
    {key:"verified",name:"Đã xác minh",subtitle:"Tài khoản hợp lệ",icon:"shield",tone:"green"},
    {key:"soon",name:"Sắp hết hạn",subtitle:"Trong vòng 30 ngày",icon:"clock",tone:"orange"},
    {key:"teacher",name:"Giảng viên",subtitle:"Đang quản lý",icon:"teacher",tone:"purple"},
    {key:"learner",name:"Học viên",subtitle:"Đang theo dõi",icon:"learner",tone:"blue"}
   ] as const).map(card=><article className={styles.metricCard} data-tone={card.tone} key={card.key}>
     <span className={styles.metricIcon}><RenewalIcon name={card.icon}/></span>
     <div><h3>{card.name}</h3><strong>{rows?counts[card.key]:"—"}</strong><small>{rows?card.subtitle:"Đang xác minh dữ liệu"}</small></div>
   </article>)}
  </section>
  <div className={styles.tools}>
    <label className={styles.searchControl}>Tìm tài khoản
      <span className={styles.searchField}><RenewalIcon name="search"/><input type="search" value={search}
        onChange={event=>setSearch(event.target.value)} placeholder="Tên học viên / giảng viên…"/></span>
    </label>
    <label className={styles.roleControl}>Vai trò
      <select value={role} onChange={event=>setRole(event.target.value as typeof role)}>
       <option value="all">Tất cả</option><option value="learner">Học viên</option><option value="teacher">Giảng viên</option>
      </select>
    </label>
    <div className={styles.filterGroup} role="group" aria-label="Lọc theo thời hạn">
      {([
       {id:"all",label:"Tất cả"},
       {id:"soon",label:"Sắp hết hạn"},
       {id:"permanent",label:"Không giới hạn"},
       {id:"expired",label:"Hết hạn"}
      ] as const).map(item=><button type="button" key={item.id} className={styles.filterChip}
         data-filter={item.id} aria-pressed={statusFilter===item.id}
         onClick={()=>setStatusFilter(item.id)}>{item.id==="permanent"?<RenewalIcon name="infinity"/>:item.id==="soon"||item.id==="expired"?<RenewalIcon name="clock"/>:null}{item.label}</button>)}
    </div>
  </div>
  {rows?<p className={styles.summary} role="status">
     Đã xác minh {counts.verified} tài khoản · Đang hiển thị {filtered.length} · Quyền gia hạn theo phạm vi cán bộ được cấp
   </p>:null}
  {rows?<div className={styles.roleSections}>
    {role!=="teacher"?<section className={styles.roleSection} data-role="learner" aria-labelledby="renewal-learner-heading">
      <header className={styles.groupHeader}><div className={styles.groupIdentity}>
        <span className={styles.groupIcon}><RenewalIcon name="learner"/></span>
        <h3 id="renewal-learner-heading">Học viên</h3><span className={styles.groupCount}>{learners.length} tài khoản</span></div>
        <p>Danh sách học viên đang theo học, theo dõi tiến độ và thời hạn tài khoản.</p>
      </header>
      <div className={styles.list}>{learners.map(accountTile)}
       {!learners.length?<p className={styles.empty}>Không có học viên phù hợp bộ lọc hiện tại.</p>:null}
      </div>
    </section>:null}
    {role!=="learner"?<section className={styles.roleSection} data-role="teacher" aria-labelledby="renewal-teacher-heading">
      <header className={styles.groupHeader}><div className={styles.groupIdentity}>
        <span className={styles.groupIcon}><RenewalIcon name="teacher"/></span>
        <h3 id="renewal-teacher-heading">Giảng viên</h3><span className={styles.groupCount}>{teachers.length} tài khoản</span></div>
        <p>Danh sách giảng viên và quyền sử dụng tài khoản.</p>
      </header>
      <div className={styles.list}>{teachers.map(accountTile)}
       {!teachers.length?<p className={styles.empty}>Không có giảng viên phù hợp bộ lọc hiện tại.</p>:null}
      </div>
    </section>:null}
   </div>:<p className={styles.loading} role="status">{busy?"Đang xác minh danh sách tài khoản từ D1…":"Chưa có dữ liệu tài khoản đã được xác minh."}</p>}
  {activeRecord?<div className={styles.backdrop} role="presentation"
    onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setEditing(null);}}>
    <section ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true"
      aria-label={`Gia hạn tài khoản ${activeRecord.name}`} tabIndex={-1}>
      <header><div><small>GIA HẠN CÓ XÁC MINH · ACCOUNT-FIRST V2</small>
        <h2>Điều chỉnh thời hạn</h2><p>{activeRecord.name} · {activeRecord.role==="teacher"?"Giảng viên":"Học viên"}</p></div>
        <button type="button" className={styles.close} disabled={busy} aria-label="Đóng gia hạn"
          onClick={()=>setEditing(null)}>✕</button></header>
      <div className={styles.details}>
        <div><small>{isUnlimitedAccountExpiry(activeRecord.expiresAt)?"Loại thời hạn":"Đang có hiệu lực đến"}</small><strong>{isUnlimitedAccountExpiry(activeRecord.expiresAt)?"Vĩnh viễn":expiryDateLabel(activeRecord.expiresAt)}</strong></div>
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
