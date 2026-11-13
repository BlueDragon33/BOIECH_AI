"use client";
import {useEffect,useRef,useState} from "react";
import styles from "./manager-renewal-panel.module.css";
type Period="7d"|"30d"|"6m"|"1y"|"4y"|"forever";
type Row={accountId:string;name:string|null;role:"learner"|"teacher";
 expiresAt:string;revision:number;completedLessons?:number|null;totalLessons?:number;
 totalActiveSeconds?:number|null;lastLearningAt?:string|null};
type Result={verified?:boolean;contract?:string;accounts?:Row[];ok?:boolean;
 accountId?:string;entitlement?:{expiresAt:string;revision:number};
 archived?:boolean;deleted?:boolean;readback?:boolean;error?:string};
const periods:Array<[Period,string]>=[
 ["7d","7 ngày"],["30d","30 ngày"],["6m","6 tháng"],
 ["1y","1 năm"],["4y","4 năm"],["forever","Vĩnh viễn"]
];
const protectedPrefixes=["acc_1f73c030843c73a","acc_6b4dbc19e478ef4","acc_68cfa13cfe2f66d"];
const protectedAccount=(id:string)=>protectedPrefixes.some(prefix=>id.startsWith(prefix));
const err=(value:unknown)=>value instanceof Error?value.message:"Máy chủ chưa xác nhận.";
function remaining(expiresAt:string,now:number){
 if(expiresAt.startsWith("9999-"))return "Vĩnh viễn";
 const ms=Date.parse(expiresAt)-now;if(!Number.isFinite(ms))return "Chưa xác minh";
 if(ms<=0)return "Đã hết hạn";
 const days=Math.ceil(ms/86400000);
 if(days>=365)return Math.floor(days/365)+" năm "+Math.floor(days%365/30)+" tháng";
 if(days>=30)return Math.floor(days/30)+" tháng "+days%30+" ngày";
 return days+" ngày";
}
const dateLabel=(v:string)=>v.startsWith("9999-")?"Không hết hạn":
 new Intl.DateTimeFormat("vi-VN",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v));
async function post(payload:Record<string,unknown>):Promise<Result>{
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const res=await fetch("/api/accounts",{
   method:"POST",credentials:"same-origin",cache:"no-store",signal:controller.signal,
   headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  const data=await res.json() as Result;
  if(!res.ok)throw new Error(data.error||"Không xác minh được yêu cầu D1.");
  return data;
 }catch(e){if(controller.signal.aborted)
   throw new Error("Kết quả chưa rõ. Đọc lại D1 trước khi thử lệnh khác.");
   throw e;
 }finally{clearTimeout(timeout);}
}
export default function ManagerRenewalPanel(){
 const [rows,setRows]=useState<Row[]|null>(null);
 const [search,setSearch]=useState(""),[role,setRole]=useState<"all"|"teacher"|"learner">("all");
 const [period,setPeriod]=useState<Record<string,Period>>({});
 const [reason,setReason]=useState("Cán bộ điều chỉnh thời hạn tài khoản theo yêu cầu");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [now,setNow]=useState(0);
 const lock=useRef(false);
 useEffect(()=>{queueMicrotask(()=>setNow(Date.now()));
  const timer=window.setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
 async function refresh(){
  if(lock.current)return;
  setBusy(true);setError("");
  try{
   const data=await post({action:"manager-renew-list"});
   if(data.verified!==true||data.contract!=="boi-manager-renew.v1"||
    !Array.isArray(data.accounts)||data.accounts.some(x=>!/^acc_[a-f0-9]{64}$/.test(x.accountId)))
    throw new Error("D1 chưa xác minh danh sách tài khoản.");
   setRows(data.accounts);
  }catch(e){setRows(null);setError(err(e));}finally{setBusy(false);}
 }
 async function setDuration(record:Row){
  const selected=period[record.accountId]??"30d";
  if(lock.current||!periods.some(p=>p[0]===selected)||reason.trim().length<10)return;
  if(!window.confirm("ĐẶT LẠI thời hạn "+periods.find(p=>p[0]===selected)?.[1]+
   " kể từ hôm nay cho "+record.name+"? Thời hạn cũ sẽ được thay thế, KHÔNG cộng dồn."))return;
  lock.current=true;setBusy(true);setError("");setNotice("");
  try{
   const result=await post({action:"manager-set-duration",accountId:record.accountId,
    expectedRevision:record.revision,period:selected,reason:reason.trim()});
   if(result.verified!==true||result.contract!=="boi-manager-renew.v1"||
    result.accountId!==record.accountId||!result.entitlement?.expiresAt||
    result.entitlement.revision!==record.revision+1)
    throw new Error("Thời hạn sau khi đặt chưa đọc lại được trên D1.");
   setNotice("Đã đặt thời hạn "+periods.find(p=>p[0]===selected)?.[1]+
    " cho "+record.name+"; không cộng vào thời hạn cũ.");
   const updated=await post({action:"manager-renew-list"});
   if(updated.verified!==true||updated.contract!=="boi-manager-renew.v1"||
    !Array.isArray(updated.accounts))throw new Error("Đã lưu nhưng danh sách đọc lại chưa sẵn sàng.");
   setRows(updated.accounts);
  }catch(e){setError(err(e));}finally{lock.current=false;setBusy(false);}
 }
 async function archive(record:Row){
  if(lock.current||protectedAccount(record.accountId)||reason.trim().length<10)return;
  const typed=window.prompt("Gỡ quyền và lưu trữ tài khoản "+(record.name||"chưa khai báo")+
   ". Nhập đúng toàn bộ Account ID để xác nhận:", "");
  if(typed!==record.accountId)return;
  if(!window.confirm("Gỡ tài khoản khỏi hoạt động, đăng xuất tất cả thiết bị và lưu trữ? "+
   "Dữ liệu học tập, thanh toán và nhật ký vẫn được giữ; KHÔNG phải xóa vĩnh viễn."))return;
  lock.current=true;setBusy(true);setError("");setNotice("");
  try{
   const result=await post({action:"manager-archive-account",accountId:record.accountId,
    expectedRevision:record.revision,reason:reason.trim(),confirmation:typed});
   if(result.verified!==true||result.contract!=="boi-manager-archive.v1"||
    result.archived!==true||result.deleted!==false||result.readback!==true)
     throw new Error("Chưa xác minh được trạng thái lưu trữ.");
   setNotice("Đã thu hồi quyền và lưu trữ "+record.name+". Không xóa dữ liệu lịch sử.");
   const updated=await post({action:"manager-renew-list"});
   if(updated.verified!==true||!Array.isArray(updated.accounts))
    throw new Error("Lưu trữ thành công nhưng cần đồng bộ lại danh sách.");
   setRows(updated.accounts);
  }catch(e){setError(err(e));}finally{lock.current=false;setBusy(false);}
 }
 useEffect(()=>{queueMicrotask(()=>{void refresh();});},[]);
 const filtered=(rows??[]).filter(x=>(role==="all"||x.role===role)&&
  ((x.name??"")+" "+x.accountId).toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));
 return <section className={styles.panel} aria-label="Quản trị chuyên nghiệp thời hạn học viên giảng viên">
  <header className={styles.heading}><div><small>BƠI ẾCH AI · QUẢN LÝ TÀI KHOẢN</small>
   <h2>Thời hạn & tiến độ học tập</h2>
   <p>Thời hạn mới được tính từ hôm nay, không cộng dồn. Quyền điều chỉnh chỉ dành cho cán bộ quản lý được cấp phép.</p>
  </div><button type="button" onClick={()=>void refresh()} disabled={busy}>↻ Đồng bộ D1</button></header>
  <div className={styles.stats} aria-label="Tổng hợp danh sách">
   <div><small>Đang quản lý</small><strong>{rows?rows.length:"—"}</strong></div>
   <div><small>Học viên</small><strong>{rows?rows.filter(x=>x.role==="learner").length:"—"}</strong></div>
   <div><small>Giảng viên</small><strong>{rows?rows.filter(x=>x.role==="teacher").length:"—"}</strong></div>
  </div>
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  {notice?<p role="status" className={styles.notice}>{notice}</p>:null}
  <div className={styles.tools}>
   <label>Tìm theo tên hoặc ID<input value={search} onChange={e=>setSearch(e.target.value)}
     placeholder="Tra cứu học viên, giảng viên…"/></label>
   <label>Vai trò<select value={role} onChange={e=>setRole(e.target.value as typeof role)}>
    <option value="all">Tất cả</option><option value="learner">Học viên</option>
    <option value="teacher">Giảng viên</option></select></label>
  </div>
  <label className={styles.reason}>Lý do điều chỉnh (lưu nhật ký D1)
   <textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={300} rows={2}/>
  </label>
  <div className={styles.list}>{filtered.map(record=>{
   const protectedThree=protectedAccount(record.accountId);
   const count=record.completedLessons;
   return <article className={styles.accountCard} key={record.accountId}>
    <div className={styles.identity}>
     <div><h3>{record.name||"Hồ sơ chưa khai báo"}</h3>
      <span className={styles.role}>{record.role==="teacher"?"Giảng viên":"Học viên"}</span>
      {protectedThree?<span className={styles.protected}>Giữ lại theo Owner</span>:null}
     </div>
     <code>{record.accountId.slice(0,22)}…</code>
     <p>Hết hạn: <strong>{dateLabel(record.expiresAt)}</strong></p>
     <p>Thời gian còn lại: <strong>{now?remaining(record.expiresAt,now):"Đang tính…"}</strong></p>
     {record.role==="learner"?<div className={styles.progress} aria-label="Tiến độ học viên">
      <div><span>Tiến độ học (từ D1)</span><strong>{count===null||count===undefined?"Chưa xác minh":count+"/8 bài"}</strong></div>
      {typeof count==="number"?<div className={styles.progressTrack} role="progressbar"
       aria-valuemin={0} aria-valuemax={8} aria-valuenow={count}
       aria-label="Bài học đã hoàn thành"><i style={{width:Math.min(100,Math.max(0,count/8*100))+"%"}}/></div>:null}
      <small>{record.lastLearningAt?"Hoạt động gần nhất: "+dateLabel(record.lastLearningAt):
       "Chưa ghi nhận thời điểm hoạt động trên thiết bị gốc"}</small>
     </div>:null}
    </div>
    <div className={styles.controls}>
     <label>Đặt thời hạn mới
      <select value={period[record.accountId]??"30d"} disabled={busy}
       onChange={e=>setPeriod(prev=>({...prev,[record.accountId]:e.target.value as Period}))}>
       {periods.map(([value,label])=><option value={value} key={value}>{label}</option>)}
      </select>
     </label>
     <button type="button" className={styles.save} disabled={busy||reason.trim().length<10}
      onClick={()=>void setDuration(record)}>Lưu thời hạn · Xác minh D1</button>
     {protectedThree?<p className={styles.protectionNote}>Tài khoản được Owner yêu cầu giữ. Không thể xóa tại đây.</p>:
      <button type="button" className={styles.archive} disabled={busy||reason.trim().length<10}
       onClick={()=>void archive(record)}>Gỡ quyền & lưu trữ tài khoản…</button>}
    </div>
   </article>;
  })}
  {!rows?<p role="status">{busy?"Đang tải hồ sơ D1…":"Chưa có danh sách được xác minh."}</p>:
   !filtered.length?<p>Không có tài khoản phù hợp bộ lọc.</p>:null}
  </div>
  <footer>Đặt lại 7 ngày, 30 ngày, 6 tháng, 1 năm, 4 năm hoặc vĩnh viễn; CAS, nhật ký và đọc lại trạng thái. Gỡ quyền/lưu trữ không có nghĩa là xóa vĩnh viễn dữ liệu.</footer>
 </section>;
}
