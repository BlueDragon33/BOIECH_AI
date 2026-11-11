"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import styles from "./manager-v2-review-panel.module.css";

type Role="learner"|"teacher";
type Person={accountId:string;role:Role;name:string|null;personCode:string|null;
 className:string|null;status:"pending"|"approved"|"blocked";registrationComplete:boolean;
 onboardingStage:string|null;onboardingRevision:number|null;firstReviewMine:boolean;assignedToMe:boolean};
type Board={devices:Person[];nextCursor:string|null;quotas:{learner:{limit:number;used:number};teacher:{limit:number;used:number}}};
type Reply={board?:Board;onboarding?:{stage:string;revision:number};error?:string;code?:string};

async function command(payload:Record<string,unknown>):Promise<Reply>{
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch("/api/accounts",{method:"POST",credentials:"same-origin",cache:"no-store",
   signal:controller.signal,headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  const data=await response.json().catch(()=>null) as Reply|null;
  if(!response.ok||!data||typeof data!=="object")
   throw new Error(data?.error||data?.code||`Không xác minh được phản hồi máy chủ (HTTP ${response.status}).`);
  return data;
 }finally{clearTimeout(timer);}
}
function verifiedBoard(data:Reply):Board{
 const board=data.board;
 if(!board||!Array.isArray(board.devices)||typeof board.quotas?.learner?.used!=="number"
  ||typeof board.quotas?.teacher?.used!=="number"
  ||(board.nextCursor!==null && typeof board.nextCursor!=="string"))
  throw new Error("Bảng xét duyệt chưa được máy chủ xác thực.");
 return board;
}
async function readback(accountId:string):Promise<Board>{
 // The applicant may be outside page one. Never show success until the
 // authoritative manager-scoped inbox confirms the exact account and stage.
 const seen=new Set<string>();let after="",first:Board|null=null;
 for(let page=0;page<25;page++){
  const current=verifiedBoard(await command({action:"review-list",after,limit:50}));
  if(!first)first=current;
  const found=current.devices.find(p=>p.accountId===accountId);
  if(found){
   if(found.onboardingStage!=="profile_required"||found.firstReviewMine!==true)
    throw new Error("Trạng thái hoặc cán bộ tiếp nhận không khớp khi đọc lại D1.");
   return first;
  }
  if(!current.nextCursor||seen.has(current.nextCursor))break;
  seen.add(current.nextCursor);after=current.nextCursor;
 }
 throw new Error("Duyệt đã gửi nhưng không đọc lại được hồ sơ theo đúng phạm vi. Không tự thực hiện lại; hãy đồng bộ và kiểm tra nhật ký.");
}
const displayRole=(role:Role)=>role==="teacher"?"Giảng viên":"Học viên";

export default function ManagerV2ReviewPanel({singleReview=false}:{singleReview?:boolean}){
 const [board,setBoard]=useState<Board|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const mounted=useRef(true),locked=useRef(false);
 const refresh=useCallback(async(after="")=>{
  if(locked.current)return;
  locked.current=true;setBusy(true);setError("");setNotice("");
  try{
   const page=verifiedBoard(await command({action:"review-list",after,limit:50}));
   if(mounted.current)setBoard(old=>after&&old?{
    ...page,devices:[...old.devices.filter(a=>!page.devices.some(b=>b.accountId===a.accountId)),...page.devices]
   }:page);
  }catch(e){
   if(mounted.current){setBoard(null);setError(e instanceof Error?e.message:"Không tải được hồ sơ.");}
  }finally{locked.current=false;if(mounted.current)setBusy(false);}
 },[]);
 useEffect(()=>{
  if(!singleReview)return;
  mounted.current=true;
  queueMicrotask(()=>{if(mounted.current)void refresh();});
  return()=>{mounted.current=false;};
 },[refresh,singleReview]);
 async function approve(person:Person){
  // Stage, role, revision, owner and permission are all revalidated in D1.
  if(!singleReview||locked.current||!board||person.onboardingStage!=="requested"
   ||person.status!=="pending"||!Number.isInteger(person.onboardingRevision))return;
  if(!window.confirm(`Duyệt ${displayRole(person.role)} ${person.name||person.accountId}? Người dùng sẽ phải bổ sung hồ sơ trước khi được kích hoạt.`))return;
  locked.current=true;setBusy(true);setError("");setNotice("");
  try{
   const response=await command({action:"review-first",accountId:person.accountId,
    expectedRevision:person.onboardingRevision});
   if(response.onboarding?.stage!=="profile_required"
     ||response.onboarding.revision!==person.onboardingRevision!+1)
    throw new Error("Máy chủ chưa xác nhận quyết định duyệt một lần.");
   const verified=await readback(person.accountId);
   if(mounted.current){setBoard(verified);setNotice("Đã duyệt một lần và đọc lại đúng hồ sơ từ D1. Người dùng đang chờ hoàn thiện hồ sơ; chưa kích hoạt tài khoản.");}
  }catch(e){
   // An uncertain write must never show a stale queue or encourage retry.
   if(mounted.current){setBoard(null);setError(e instanceof Error?e.message:"Không xác minh được quyết định duyệt. Kiểm tra nhật ký trước khi làm lại.");}
  }finally{locked.current=false;if(mounted.current)setBusy(false);}
 }
 if(!singleReview)return <p role="alert" className={styles.error}>Chế độ duyệt một lần chưa được xác minh. Không cấp quyền hoặc tiếp nhận hồ sơ.</p>;
 const pending=board?.devices.filter(p=>p.status==="pending"&&p.onboardingStage==="requested")??[];
 const progress=board?.devices.filter(p=>p.onboardingStage!=="requested")??[];
 return <section className={styles.root} aria-label="Duyệt học viên và giảng viên — một lần">
  <header className={styles.head}>
   <div><h2>Xét duyệt tài khoản · Một lần duyệt</h2><p>Chỉ cán bộ có quyền trong Bơi Ếch mới duyệt Học viên/Giảng viên. Duyệt chưa cấp quyền sử dụng khi hồ sơ chưa hoàn tất.</p></div>
   <button type="button" disabled={busy} onClick={()=>void refresh()}>Đồng bộ D1</button>
  </header>
  {board?<p className={styles.meta}>Đang sử dụng: {board.quotas.learner.used}/{board.quotas.learner.limit} Học viên · {board.quotas.teacher.used}/{board.quotas.teacher.limit} Giảng viên · {pending.length} hồ sơ chờ trên trang đang xem</p>:null}
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  {notice?<p role="status" className={styles.success}>{notice}</p>:null}
  {!board?<p className={styles.empty}>{busy?"Đang đọc danh sách có xác thực…":"Chưa có dữ liệu được xác minh. Không coi lỗi kết nối là 0 hồ sơ."}</p>:null}
  {board?<div className={styles.groups}>
   <section className={styles.group} aria-label="Hồ sơ chờ duyệt"><h3>Hồ sơ chờ tiếp nhận</h3>
    {pending.map(person=><article className={styles.entry} key={person.accountId}>
     <div className={styles.details}><strong>{person.name||"Hồ sơ chưa khai"} · {displayRole(person.role)}</strong>
      <small>Mã: {person.accountId.slice(0,14)} · {person.className||"Chưa phân lớp"}</small>
      <span className={styles.status}>Chờ duyệt đúng một lần</span></div>
     <button type="button" disabled={busy||board.quotas[person.role].used>=board.quotas[person.role].limit}
      onClick={()=>void approve(person)}>Duyệt hồ sơ</button>
    </article>)}
    {!pending.length?<p className={styles.empty}>Không có hồ sơ mới chờ duyệt trên trang này (đã đọc được dữ liệu).</p>:null}
   </section>
   <section className={styles.group} aria-label="Hồ sơ đang xử lý"><h3>Hồ sơ đã tiếp nhận / đang hoàn thiện</h3>
    {progress.map(person=><article className={styles.entry} key={person.accountId}>
     <div className={styles.details}><strong>{person.name||person.accountId.slice(0,14)} · {displayRole(person.role)}</strong>
      <span className={styles.status}>{person.onboardingStage==="profile_required"?"Đã duyệt · Chờ người dùng điền hồ sơ":
       person.onboardingStage==="active"?"Đã kích hoạt · Theo dõi thời hạn":
       person.onboardingStage==="suspended"?"Tạm khóa":
       person.onboardingStage==="profile_review"?"Hồ sơ cũ cần đối soát":
       person.onboardingStage==="changes_requested"?"Cần bổ sung hồ sơ":"Cần kiểm tra trạng thái"}</span>
      <small>{person.firstReviewMine?"Đang thuộc cán bộ tiếp nhận này":"Không có quyền thay đổi hồ sơ này"}</small>
     </div>
    </article>)}
    {!progress.length?<p className={styles.empty}>Chưa có hồ sơ đã tiếp nhận trong trang đang xem.</p>:null}
   </section>
  </div>:null}
  {board?.nextCursor?<button type="button" className={styles.pager} disabled={busy}
   onClick={()=>void refresh(board.nextCursor!)}>Tải thêm hồ sơ</button>:null}
 </section>;
}
