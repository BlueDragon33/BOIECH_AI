"use client";
import {useState,type FormEvent} from "react";
import type {KnowledgeResult} from "./teacher-knowledge-retrieval-v43";

export type ApprovedKnowledgeReplyV43=KnowledgeResult & {
 sourceVersion:{id:string;number:number;reviewedBy:string}|null;
 sourceReason:string;personalDataReturned:false;mediaStored:false;
};
export default function TeacherApprovedKnowledgePanelV43({onSearch}:{
 onSearch:(lessonNumber:string,query:string)=>Promise<ApprovedKnowledgeReplyV43>;
}){
 const [lesson,setLesson]=useState("03"),[query,setQuery]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [result,setResult]=useState<ApprovedKnowledgeReplyV43|null>(null);
 const submit=async(event:FormEvent)=>{
  event.preventDefault();
  if(busy||!query.trim())return;
  setBusy(true);setError("");setResult(null);
  try{setResult(await onSearch(lesson,query.trim().slice(0,160)));}
  catch(e){setError(e instanceof Error?e.message:"Không thể tra cứu giáo trình.");}
  finally{setBusy(false);}
 };
 return <section className="teacher-white-card" aria-label="Tra cứu giáo trình đã duyệt bằng AI quy tắc" data-v43-approved-knowledge>
  <header><div><strong>Tra cứu giáo trình đã duyệt · V43</strong><small>Chỉ hiển thị bản do người có thẩm quyền review và xuất bản; không gọi LLM</small></div></header>
  <form onSubmit={submit} className="teacher-action-row">
   <label>Bài học<select value={lesson} onChange={e=>setLesson(e.target.value)} disabled={busy}>
     {["01","02","03","04","05","06","07","08"].map(x=><option value={x} key={x}>Bài {x}</option>)}
   </select></label>
   <label>Vấn đề cần tra cứu<input value={query} onChange={e=>setQuery(e.target.value)}
     disabled={busy} maxLength={160} placeholder="Ví dụ: thu chân không khép" required/></label>
   <button type="submit" disabled={busy||query.trim().length<3}>{busy?"Đang đối chiếu…":"Tra cứu có dẫn nguồn"}</button>
  </form>
  {error?<p role="alert" className="teacher-action-error">{error}</p>:null}
  {result?.mode==="unavailable"?<p role="status" className="teacher-video-list-note">
    {result.sourceReason} {result.limitations.join(" ")}</p>:null}
  {result?.hits.length?<div role="status">
   <p className="teacher-video-list-note">{result.hits.length} mục phù hợp · phiên bản giáo trình {result.sourceVersion?.number??"chưa xác minh"}. Giảng viên kiểm tra bản gốc và an toàn thực hành.</p>
   <ul>{result.hits.map(hit=><li key={hit.id}>
    <strong>{hit.title}</strong><p>{hit.excerpt}</p><small>{hit.citationLabel} · duyệt bởi {hit.approvedBy}</small>
   </li>)}</ul>
  </div>:null}
  <small>Không có gợi ý được tự gửi cho học viên. Nội dung không thay thế giảng viên tại bể.</small>
 </section>;
}
