"use client";

import {useState} from "react";
import type {TrainingProof} from "./training-client";
import styles from "./ai-personal-profile-v44.module.css";

type Hit={id:string;revision:number;title:string;excerpt:string;
 citationLabel:string;sourceUri:string;approvedBy:string;approvedAt:string};
type Result={mode:"unavailable"|"approved-retrieval-only"|"model-draft";
 providerStatus?:string;publishedVersion?:{id:string;number:number;reviewedBy:string}|null;
 sourceNote?:string;hits:Hit[];draft:string|null;limitations:string[];
 error?:string;requiresTeacherApproval:boolean;sent:false};
export default function AiCoachPanelV44({getProof}:{
 getProof:()=>Promise<TrainingProof|Record<string,unknown>>;
}){
 const [lesson,setLesson]=useState("03");
 const [question,setQuestion]=useState("");
 const [result,setResult]=useState<Result|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function analyze(action:"search"|"draft"){
  if(busy)return;
  if(question.trim().length<8){setError("Nhập câu hỏi kỹ thuật tối thiểu 8 ký tự.");return;}
  setBusy(true);setError("");setResult(null);
  try{
   const proof=await getProof();
   const response=await fetch("/api/training-ai-coach",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({...proof,action,lessonNumber:lesson,query:question.trim()})
   });
   const data=await response.json() as Result;
   if(!response.ok)throw new Error(data.error??"Không thể đối chiếu giáo trình.");
   setResult(data);
  }catch(e){setError(e instanceof Error?e.message:"Không kiểm chứng được dữ liệu.");}
  finally{setBusy(false);}
 }
 return <section className={styles.root} aria-label="AI trợ giảng có trích dẫn" data-ai-coach="v44">
  <header><span>GIÁO TRÌNH ĐÃ DUYỆT · AI CÓ KIỂM SOÁT</span>
   <h3>Tra cứu kỹ thuật và soạn nháp giảng dạy</h3>
   <p>Chỉ dùng các mục giáo trình đã được duyệt và xuất bản. Không gửi video, điểm cá nhân hay danh tính người học cho mô hình. AI tạo sinh cần chính sách nhà cung cấp và hạn mức riêng; bản nháp luôn cần giảng viên duyệt.</p>
  </header>
  <div className={styles.grid}>
   <label>Chọn bài
    <select value={lesson} onChange={e=>setLesson(e.target.value)}>
     {Array.from({length:8},(_,i)=>String(i+1).padStart(2,"0")).map(x=>
      <option key={x} value={x}>Bài {x}</option>)}
    </select>
   </label>
   <label>Câu hỏi kỹ thuật (không nhập tên/số điện thoại/hộ chiếu)
    <input value={question} onChange={e=>setQuestion(e.target.value)} maxLength={320}
     placeholder="Làm sao khắc phục lỗi phối hợp chân và tay khi bơi ếch?"/>
   </label>
  </div>
  <div className={styles.actions}>
   <button type="button" disabled={busy} onClick={()=>void analyze("search")}>Đối chiếu giáo trình</button>
   <button type="button" disabled={busy} onClick={()=>void analyze("draft")}>Soạn nháp AI có trích dẫn</button>
  </div>
  {error?<p className={styles.error} role="alert">{error}</p>:null}
  {result?<div aria-live="polite" className={styles.root}>
   <p className={styles.status}>Trạng thái: {result.mode==="model-draft"?"Có bản nháp AI (chưa được phê duyệt)":
    result.mode==="approved-retrieval-only"?"Chỉ tra cứu nguồn; không có sinh nội dung từ mô hình":
    "Chưa có nguồn đủ điều kiện để trả lời"}</p>
   {result.providerStatus?<p>Nhà cung cấp: {result.providerStatus==="off"?"Chưa được kích hoạt":
     result.providerStatus==="quota"?"Đã chạm ngân sách ngày":
     result.providerStatus==="draft"?"Đã tạo bản nháp có chứng cứ":
     "Không đủ bằng chứng để sử dụng mô hình"}</p>:null}
   {result.publishedVersion?<p>Phiên bản giáo trình: {result.publishedVersion.id} · v{result.publishedVersion.number} · duyệt bởi {result.publishedVersion.reviewedBy}</p>:null}
   {result.sourceNote?<p>{result.sourceNote}</p>:null}
   {result.draft?<article><h4>Bản nháp, cần giảng viên kiểm duyệt</h4><p style={{whiteSpace:"pre-wrap"}}>{result.draft}</p></article>:null}
   <div>{result.hits.map((hit,i)=><article key={hit.id}>
    <h4>[KB{i+1}] {hit.title}</h4>
    <p>{hit.excerpt}</p>
    <small>{hit.citationLabel} · duyệt bởi {hit.approvedBy}</small>
    <p><a href={hit.sourceUri} rel="noopener noreferrer">Mở ứng dụng xem giáo trình gốc</a></p>
   </article>)}</div>
   {result.limitations.map((note,i)=><p key={i}><small>{note}</small></p>)}
   <p role="note"><strong>Chưa gửi cho học viên; không tự sửa bài học hoặc thay đổi phân lớp.</strong></p>
  </div>:null}
 </section>;
}
