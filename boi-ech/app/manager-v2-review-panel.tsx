"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Person={accountId:string;role:"learner"|"teacher";name:string|null;personCode:string|null;
 className:string|null;status:"pending"|"approved"|"blocked";registrationComplete:boolean;
 onboardingStage:string|null;onboardingRevision:number|null;firstReviewMine:boolean;assignedToMe:boolean};
type Board={devices:Person[];nextCursor:string|null;quotas:{learner:{limit:number;used:number};teacher:{limit:number;used:number}}};
function verifiedBoard(board:Board|undefined,after=""):Board {
 const fail=()=>new Error("Hàng chờ xét duyệt chưa được xác minh.");
 if(!board||!Array.isArray(board.devices)||board.devices.length>50)throw fail();
 let previous=after;
 for(const person of board.devices){
  if(!person||!/^acc_[a-f0-9]{64}$/.test(person.accountId)||person.accountId<=previous
    ||!["learner","teacher"].includes(person.role)||!["pending","approved","blocked"].includes(person.status)
    ||(person.onboardingRevision!==null&&!Number.isSafeInteger(person.onboardingRevision)))throw fail();
  previous=person.accountId;
 }
 if(board.nextCursor!==null&&(!board.devices.length||board.nextCursor!==previous))throw fail();
 for(const role of ["learner","teacher"] as const){
  const quota=board.quotas?.[role];
  if(!quota||!Number.isSafeInteger(quota.used)||quota.used<0||!Number.isSafeInteger(quota.limit)||quota.limit<0)throw fail();
 }
 return board;
}
async function command(payload:Record<string,unknown>){
 const response=await fetch("/api/accounts",{method:"POST",credentials:"same-origin",cache:"no-store",
  headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
 const data=await response.json() as {board?:Board;onboarding?:{account_id:string;stage:string;revision:number};account?:{accountId:string;status:string};error?:string};
 if(!response.ok)throw new Error(data.error??"Thao tác chưa được xác nhận.");
 return data;
}
export default function ManagerV2ReviewPanel({singleReview=false}:{singleReview?:boolean}){
 const [board,setBoard]=useState<Board|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const mounted=useRef(true),locked=useRef(false);
 const refresh=useCallback(async(after="")=>{
  if(locked.current)return;
  locked.current=true;setBusy(true);setError("");
  try{const data=await command({action:"review-list",after,limit:50});
    const next=verifiedBoard(data.board,after);
    if(mounted.current)setBoard(current=>after&&current
      ? {...next,devices:[...current.devices,...next.devices]} : next);
  }catch(e){if(mounted.current){setBoard(null);setError(e instanceof Error?e.message:"Không tải được hồ sơ.");}}
  finally{locked.current=false;if(mounted.current)setBusy(false);}
 },[]);
 useEffect(()=>{mounted.current=true;void Promise.resolve().then(()=>{if(mounted.current)return refresh();});return()=>{mounted.current=false};},[refresh]);
 async function decide(person:Person,action:"review-first"|"review"|"review-changes"){
  if(locked.current)return;
  if(singleReview && action!=="review-first")return;
  const label=action==="review-first"?(singleReview?"duyệt tài khoản":"duyệt tài khoản lần một"):action==="review"?"kích hoạt lần hai":"yêu cầu bổ sung";
  if(!window.confirm(`Xác nhận ${label} cho ${person.name??person.accountId}?`))return;
  let reason="";
  if(action==="review-changes"){reason=window.prompt("Nội dung cần bổ sung (không ghi dữ liệu nhạy cảm):","")??"";
    if(reason.trim().length<3)return;}
  locked.current=true;setBusy(true);setError("");setNotice("");
  try{
   const result=await command({action,accountId:person.accountId,expectedRevision:person.onboardingRevision,
     ...(action==="review"?{operation:"approve"}:{}),...(action==="review-changes"?{reason}: {})});
   const verified=action==="review"
     ? result.account?.accountId===person.accountId&&result.account.status==="approved"
     : result.onboarding?.account_id===person.accountId
       && result.onboarding.stage===(action==="review-first"?"profile_required":"changes_requested")
       && person.onboardingRevision!==null&&result.onboarding.revision===person.onboardingRevision+1;
   if(!verified)throw new Error("Chưa xác minh kết quả xét duyệt. Đồng bộ lại trước khi tiếp tục.");
   const next=verifiedBoard((await command({action:"review-list"})).board);
   if(mounted.current){setBoard(next);setNotice("Đã thực hiện và đọc lại trạng thái máy chủ.");}
  }catch(e){if(mounted.current){setBoard(null);setError(e instanceof Error?e.message:"Thao tác chưa xác nhận; cần đồng bộ lại trước khi tiếp tục.");}}
  finally{locked.current=false;if(mounted.current)setBusy(false);}
 }
 const pending=board?.devices.filter(x=>x.status==="pending")??[];
 return <section aria-label={singleReview?"Duyệt tài khoản một lần":"Duyệt tài khoản hai giai đoạn"} style={{marginBlock:"1rem"}}>
  <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"1rem"}}>
   <div><h2>{singleReview?"Xét duyệt tài khoản — Một lần duyệt":"Xét duyệt tài khoản — Hai giai đoạn"}</h2><p>Cán bộ chỉ duyệt học viên và giảng viên. Mọi thao tác được kiểm tra quyền trên máy chủ.</p></div>
   <button type="button" disabled={busy} onClick={()=>void refresh()}>Đồng bộ</button>
  </header>
  {board?<p>Học viên đã duyệt: {board.quotas.learner.used}/{board.quotas.learner.limit} · Giảng viên: {board.quotas.teacher.used}/{board.quotas.teacher.limit}</p>:null}
  {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
  {!board?<p>{busy?"Đang đọc dữ liệu…":"Chưa có dữ liệu được xác minh."}</p>:null}
  {board && !pending.length && !board.nextCursor?<p>Không có tài khoản chờ duyệt.</p>:null}
  {pending.map(person=><article key={person.accountId} style={{border:"1px solid var(--border,#777)",borderRadius:12,padding:12,marginBlock:8}}>
   <strong>{person.name||"Tài khoản chưa khai hồ sơ"} · {person.role==="teacher"?"Giảng viên":"Học viên"}</strong>
   <p style={{fontSize:13}}>{person.personCode||person.accountId.slice(0,14)} · {person.className||"Chưa có lớp"} ·
    {person.onboardingStage==="requested"?" Chờ duyệt":
     person.onboardingStage==="profile_required"?" Đang khai hồ sơ":
     person.onboardingStage==="profile_review"?(singleReview?" Đang hoàn thiện":" Chờ duyệt lần 2"):
     person.onboardingStage==="changes_requested"?" Cần bổ sung":" Chưa rõ trạng thái"}</p>
   {person.onboardingStage==="requested" ? <button disabled={busy} onClick={()=>void decide(person,"review-first")}>{singleReview?"Duyệt tài khoản":"Duyệt lần 1"}</button>:null}
   {!singleReview&&person.onboardingStage==="profile_review"&&person.firstReviewMine&&person.registrationComplete?
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
     <button disabled={busy} onClick={()=>void decide(person,"review")}>Duyệt lần 2 — Kích hoạt</button>
     <button disabled={busy} onClick={()=>void decide(person,"review-changes")}>Yêu cầu bổ sung</button>
    </div>:null}
   {!singleReview&&person.onboardingStage==="profile_review"&&!person.firstReviewMine?
     <p>Hồ sơ đã được một cán bộ khác tiếp nhận; không có quyền duyệt vòng hai.</p>:null}
  </article>)}
  {board?.nextCursor?<button type="button" disabled={busy} onClick={()=>void refresh(board.nextCursor!)}>
    Tải thêm yêu cầu đang chờ</button>:null}
 </section>;
}
