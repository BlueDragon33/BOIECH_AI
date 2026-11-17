"use client";

import {useEffect,useMemo,useState} from "react";
import type {TrainingBoard} from "./training-types";
import type {TrainingProof} from "./training-client";
import type {ManagerAiDestination} from "./manager-ai-evidence-v41";
import {buildAllocationReview,type AllocationProposal} from "./manager-ai-allocation-v42";
import styles from "./manager-ai-allocation-v42.module.css";
import ManagerAiProfilesV44 from "./manager-ai-profiles-v44";
import AiCoachPanelV44 from "./ai-coach-panel-v44";

function date(value:string){
 const d=new Date(value);
 return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(d):"Chưa xác minh";
}
type Decision={status:"reviewed"|"approved"|"applied"|"rejected"|"stale";revision:number};
function Shortlist({title,rows,empty,navigate,onReview,onDecision,onReject,onApply,decisions,decisionBusy,target}:{
 title:string;rows:AllocationProposal[];empty:string;navigate:(target:ManagerAiDestination)=>void;
 onReview:(personId:string,classId:string)=>void;
 onDecision?:(proposal:AllocationProposal)=>void;
 onReject?:(proposal:AllocationProposal)=>void;
 onApply?:(proposal:AllocationProposal)=>void;
 decisions:Record<string,Decision>;decisionBusy:boolean;
 target:ManagerAiDestination;
}){
 const [showAll,setShowAll]=useState(false);
 const [expanded,setExpanded]=useState<string|null>(null);
 const visible=showAll?rows:rows.slice(0,8);
 return <section className={styles.column} aria-label={title}>
  <header><h4>{title}</h4><small>{rows.length} phương án xem xét, không tự áp dụng</small></header>
  <div className={styles.records}>
   {visible.map((r)=><article key={r.id} className={styles.record}>
    <div className={styles.recordHead}><span>{r.evidenceStatus==="no-class-sessions"?"Chưa xác minh lịch":r.suggestedRole==="teacher-primary"?"Ưu tiên ghép lịch":r.suggestedRole==="teacher-alternative"?"Chỉ là phương án khác":r.suggestedRole==="primary"?"Ưu tiên mô phỏng":r.suggestedRole==="alternative"?"Lựa chọn khác":r.priority==="high"?"Ưu tiên":"Đề xuất"}</span>
     <strong>{r.personName}</strong></div>
    <p><b>{r.className}</b> · {r.reason}</p>
    <dl><div><dt>Sĩ số cấu hình</dt><dd>{r.currentLearnerCount}/{r.classCapacity}</dd></div>
      <div><dt>Giảng viên hiện có</dt><dd>{r.teacherCoverage}</dd></div>
      {r.currentClassLoad!==null?<div><dt>Tải của ứng viên</dt><dd>{r.currentClassLoad} lớp</dd></div>:null}
      {r.currentSessionLoad!==null?<div><dt>Buổi đã xếp (khoảng tải)</dt><dd>{r.currentSessionLoad} buổi</dd></div>:null}
    </dl>
    <div className={styles.actions}>
      <button type="button" aria-expanded={expanded===r.id} onClick={()=>setExpanded(expanded===r.id?null:r.id)}>
       {expanded===r.id?"Ẩn căn cứ":"Vì sao đề xuất?"}
      </button>
      <button type="button" disabled={decisionBusy||r.admissible===false||decisions[r.id]?.status==="rejected"||decisions[r.id]?.status==="applied"}
       onClick={()=>{if(onDecision)onDecision(r);else onReview(r.personId,r.classId);}}>
       {r.admissible===false?"Thiếu hồ sơ xác minh":decisions[r.id]?.status==="applied"?"Đã áp dụng phân công":decisions[r.id]?.status==="approved"?"Mở lưu phân công":
        decisions[r.id]?.status==="reviewed"?"Phê duyệt & mở phân công":
        decisions[r.id]?.status==="rejected"?"Đã từ chối":decisions[r.id]?.status==="stale"?"Xem xét lại dữ liệu":"Ghi nhận xem xét"}
      </button>
      {decisions[r.id]?.status==="approved"&&r.admissible===true&&onApply?
       <button type="button" data-ai-apply-confirm disabled={decisionBusy} onClick={()=>onApply(r)}>
        Áp dụng phân công đã duyệt
       </button>:null}
      {decisions[r.id]?.status==="reviewed"&&onReject?
       <button type="button" disabled={decisionBusy} onClick={()=>onReject(r)}>Từ chối đề xuất</button>:null}
      <button type="button" onClick={()=>navigate(target)}>Mở {target==="people"?"Nhân sự":"Lớp học"}</button>
    </div>
    {expanded===r.id?<div className={styles.evidence}>
      <strong>Bằng chứng · {date(r.observedAt)}</strong>
      {r.admissionStatus?<p>Đối chiếu hồ sơ: {r.admissionStatus==="verified"?"Đã xác minh theo nguồn":
       r.admissionStatus==="hard-veto"?"Không đủ điều kiện":"Chưa có đủ chứng cứ"}</p>:null}
      {r.admissionSources?.map(source=><small key={source}>Hồ sơ xác minh: {source}</small>)}
      {r.sourceRecords.map(x=><small key={x.source+":"+x.id}>{x.source} · {x.id}</small>)}
      {r.warnings.map((w,i)=><p key={i}>{w}</p>)}
      <p>Chưa có thay đổi dữ liệu hoặc thông báo phân công chính thức.</p>
    </div>:null}
   </article>)}
   {!rows.length?<p className={styles.empty}>{empty}</p>:null}
  </div>
  {rows.length>8?<button type="button" className={styles.showAll} onClick={()=>setShowAll(!showAll)}>
   {showAll?"Thu gọn":"Xem thêm "+(rows.length-8)+" phương án"}</button>:null}
 </section>;
}
export default function ManagerAiAllocationPanelV42({board,onNavigate,onReviewProposal,getProof}:{
 board:TrainingBoard;onNavigate:(id:ManagerAiDestination)=>void;
 onReviewProposal:(personId:string,classId:string)=>void;
 getProof?:(signal?:AbortSignal)=>Promise<TrainingProof>;
}){
 const review=useMemo(()=>buildAllocationReview(board),[board]);
 const [decisions,setDecisions]=useState<Record<string,Decision>>({});
 const [decisionBusy,setDecisionBusy]=useState(false);
 const [decisionError,setDecisionError]=useState("");
 const [decisionsReady,setDecisionsReady]=useState(false);
 useEffect(()=>{
  let live=true;
  if(!getProof){return;}
  const controller=new AbortController();
  void (async()=>{
   try{
    const proof=await getProof(controller.signal);
    const response=await fetch("/api/training-ai-proposals",{
     method:"POST",credentials:"same-origin",cache:"no-store",signal:controller.signal,
     headers:{"content-type":"application/json"},
     body:JSON.stringify({...proof,from:board.from,to:board.to,action:"list"})
    });
    const data=await response.json() as {items?:{id:string;status:Decision["status"];revision:number}[];error?:string};
    if(!response.ok)throw new Error(data.error??"Không thể tải quyết định AI.");
    if(!live)return;
    setDecisions(Object.fromEntries((data.items??[]).map(item=>[item.id,{status:item.status,revision:item.revision}])));
    setDecisionsReady(true);setDecisionError("");
   }catch(error){
    if(!live)return;
    setDecisionsReady(false);
    setDecisionError(error instanceof Error?error.message:"Không đồng bộ được trạng thái đề xuất.");
   }
  })();
  return ()=>{live=false;controller.abort();};
 },[getProof,board.from,board.to,board.observedAt]);
 async function recordApply(proposal:AllocationProposal){
  const current=decisions[proposal.id];
  if(!getProof||decisionBusy||!decisionsReady||!board.admissionProfiles||
    current?.status!=="approved"||proposal.admissible!==true)return;
  if(!window.confirm("Áp dụng phân công sau khi kiểm tra lại hồ sơ, chứng chỉ, lớp và sĩ số trên máy chủ?"))return;
  setDecisionBusy(true);setDecisionError("");
  try{
   const proof=await getProof();
   const response=await fetch("/api/training-ai-proposals",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({...proof,from:board.from,to:board.to,action:"apply",
      proposalId:proposal.id,expectedRevision:current.revision,commandId:crypto.randomUUID()})
   });
   const result=await response.json() as {ok?:boolean;applied?:boolean;error?:string;code?:string};
   if(!response.ok||!result.ok||!result.applied)
    throw new Error(result.error??"Chưa xác minh được việc áp dụng phân công.");
   setDecisions(prev=>({...prev,[proposal.id]:{status:"applied",revision:current.revision}}));
   setDecisionError("Đã ghi phân công và có biên nhận D1; đồng bộ bảng để xem danh sách mới.");
  }catch(error){setDecisionError(error instanceof Error?error.message:"Không áp dụng được đề xuất.");}
  finally{setDecisionBusy(false);}
 }
 async function recordDecision(proposal:AllocationProposal,mode?:"reject"){
  if(!getProof){onReviewProposal(proposal.personId,proposal.classId);return;}
  if(!decisionsReady||decisionBusy)return;
  const old=decisions[proposal.id];
  if(old?.status==="approved"&&!mode){onReviewProposal(proposal.personId,proposal.classId);return;}
  if(old?.status==="rejected")return;
  const action=mode==="reject"?"reject":old?.status==="reviewed"?"approve":"review";
  setDecisionBusy(true);setDecisionError("");
  try{
   const proof=await getProof();
   const response=await fetch("/api/training-ai-proposals",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({...proof,from:board.from,to:board.to,action,
     proposalId:proposal.id,expectedRevision:old?.revision??0,
     commandId:crypto.randomUUID(),
     reason:"Cán bộ xác nhận đã đọc và chịu trách nhiệm rà soát phương án trong dữ liệu hiện hành."})
   });
   const data=await response.json() as {status?:Decision["status"];revision?:number;error?:string};
   if(!response.ok||!data.status||!data.revision)throw new Error(data.error??"Không ghi được quyết định.");
   setDecisions(prev=>({...prev,[proposal.id]:{status:data.status!,revision:data.revision!}}));
   if(action==="approve")onReviewProposal(proposal.personId,proposal.classId);
  }catch(error){setDecisionError(error instanceof Error?error.message:"Không thể ghi nhận quyết định AI.");}
  finally{setDecisionBusy(false);}
 }
 return <section className={styles.root} aria-label="Đề xuất phân bổ học viên và giảng viên" data-manager-ai-allocation="V42">
  <header className={styles.hero}>
   <div><small>V42 · PHÂN BỔ CÓ GIẢI THÍCH</small><h3>Gợi ý phân lớp & giảng viên</h3>
    <p>Ứng viên được tự động sắp theo sĩ số, số lớp đang nhận và lịch có trong hệ thống. Các đề xuất giảng viên được kiểm tra chéo giữa những lớp trong cùng danh sách; mọi lựa chọn vẫn phải đối chiếu hồ sơ và lưu thủ công. Cán bộ quyết định cuối cùng.</p></div>
   <span>Chỉ đề xuất · Không tự lưu</span>
  </header>
  {getProof?<p role="note" className={styles.qualification}>
   {decisionError||(!decisionsReady?"Đang xác minh trạng thái đề xuất trên máy chủ…":
    "Quy trình: Ghi nhận xem xét → Phê duyệt → Mở biểu mẫu Lưu phân công. Phê duyệt chưa tự ghi thay đổi lớp.")}
  </p>:null}
  <div className={styles.stats}>
   <div><strong>{review.classesNeedingTeachers}</strong><span>Lớp cần bổ sung người</span></div>
   <div><strong>{review.unassignedTeachers}</strong><span>Giảng viên chưa khớp lớp</span></div>
   <div><strong>{review.unassignedLearners}</strong><span>Học viên chưa khớp lớp</span></div>
   <div><strong>{date(review.observedAt)}</strong><span>Mốc dữ liệu xác thực</span></div>
  </div>
  <p className={styles.qualification} role="note">
   {board.admissionProfiles?
    "Đang dùng hồ sơ đã tự nguyện khai báo và được cán bộ đối chiếu nguồn. Phương án thiếu chứng từ hoặc không đủ điều kiện bị khóa thao tác AI; mọi quyết định còn phải kiểm tra lại trên máy chủ."
    :"Chưa kích hoạt nguồn hồ sơ bổ sung có đồng ý và kiểm chứng; chỉ hiển thị gợi ý theo sĩ số/lịch, không xác nhận chuyên môn hoặc an toàn."}
   {review.sourceMayBeTruncated?" Nguồn có thể bị giới hạn số bản ghi.":""}
  </p>
  <div className={styles.columns}>
   <Shortlist title="01 · Giảng viên → lớp thiếu người" rows={review.teacherShortlist}
     empty="Không có ứng viên không trùng giờ được nhận diện trong dữ liệu tải; xem xét thủ công."
     target="people" navigate={onNavigate} onReview={onReviewProposal}
     onDecision={getProof?proposal=>void recordDecision(proposal):undefined}
     onReject={getProof?proposal=>void recordDecision(proposal,"reject"):undefined}
     onApply={getProof?proposal=>void recordApply(proposal):undefined}
     decisions={decisions} decisionBusy={decisionBusy||Boolean(getProof&&!decisionsReady)}/>
   <Shortlist title="02 · Học viên → lớp còn chỗ" rows={review.learnerShortlist}
     empty="Chưa tìm thấy hồ sơ học viên cần phân lớp hoặc lớp còn sức chứa/đủ giảng viên cấu hình."
     target="class" navigate={onNavigate} onReview={onReviewProposal}
     onDecision={getProof?proposal=>void recordDecision(proposal):undefined}
     onReject={getProof?proposal=>void recordDecision(proposal,"reject"):undefined}
     onApply={getProof?proposal=>void recordApply(proposal):undefined}
     decisions={decisions} decisionBusy={decisionBusy||Boolean(getProof&&!decisionsReady)}/>
  </div>
  {getProof?<><ManagerAiProfilesV44 board={board} getProof={getProof}/><AiCoachPanelV44 getProof={getProof}/></>:null}
  <footer>Thứ tự là gợi ý theo bộ quy tắc {review.rulesVersion}, không phải điểm phù hợp AI dự báo.
   Quyết định cần đối chiếu hồ sơ, giờ học, tiêu chuẩn an toàn và xác nhận có thẩm quyền.</footer>
 </section>;
}
