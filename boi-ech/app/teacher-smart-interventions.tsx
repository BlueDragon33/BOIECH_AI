"use client";

import {useState} from "react";
import {TaskGlyph} from "./teacher-task-icon-v39";
import {buildTeacherEvidenceQueueV48} from "./teacher-evidence-triage-v48";

export type SmartSuggestionClient={
 id:string;mode:"feedback"|"assignment"|"review";priority:"critical"|"high"|"normal";
 lessonNumber:string;title:string;reason:string;noteTemplate:string;evidence:string[];
 requiresHumanReview:true;
};
type SmartLearner={name:string;personCode:string;className:string;interventionSuggestions:SmartSuggestionClient[];
 lastAnalysis?:{confidence:number;captureQuality:"good"|"review"}|null;
 learningAnalytics?:{latest?:{observedChange:string}|null}|null;};
function modeLabel(mode:SmartSuggestionClient["mode"]){
 return mode==="assignment"?"Giao bài luyện":mode==="review"?"Review AI":"Nhận xét";
}
export default function TeacherSmartInterventions({learners,onUse,sourcePossiblyTruncated=false}:{
 learners:SmartLearner[];onUse:(personCode:string,suggestion:SmartSuggestionClient)=>void;
 sourcePossiblyTruncated?:boolean;
}){
 const [expanded,setExpanded]=useState(false);
 const queue=buildTeacherEvidenceQueueV48(learners,{limit:18,sourcePossiblyTruncated});
 const items=queue.items;
 const visible=expanded?items:items.slice(0,4);
 return <section className="teacher-smart-interventions icon-task-ai" aria-label="Gợi ý can thiệp thông minh">
  <header className="icon-task-ai-heading">
   <div className="icon-task-ai-heading-title"><span><TaskGlyph name="sparkles" size={25}/></span>
    <div><small>SMART INTERVENTION ENGINE</small><h2>Gợi ý can thiệp</h2></div>
   </div>
   <p>Đối chiếu độ tin cậy AI, ưu tiên theo lớp đã xác thực và luân phiên học viên ngang mức ưu tiên.
    Giảng viên phải duyệt nội dung trước khi gửi.</p>
   <strong className="icon-task-ai-count">{items.length}/{queue.totalEligible} đề xuất đang hiển thị</strong>
  </header>
  {queue.possiblyIncomplete?<p role="status" className="teacher-video-list-note">
    {queue.hidden?queue.hidden+" đề xuất nằm ngoài giới hạn hiển thị. ":""}
    {sourcePossiblyTruncated?"Dữ liệu nguồn lớp có thể chưa tải đầy đủ. ":""}
    {queue.rejected?queue.rejected+" mục không đủ định danh/bằng chứng đã bị loại. ":""}
    Không kết luận danh sách đã bao phủ tất cả nhu cầu.</p>:null}
  <div className="icon-task-ai-list">{visible.map(({learner,suggestion,explanation,evidenceCaution})=><article key={learner.personCode+"-"+suggestion.id}
   className="icon-task-ai-card" data-priority={suggestion.priority}>
   <div className="icon-task-ai-icon"><TaskGlyph name={suggestion.priority==="critical"?"clock":suggestion.priority==="high"?"help":"trend"} size={27}/></div>
   <div className="icon-task-ai-detail"><span className="icon-task-ai-priority">{suggestion.priority==="critical"?"Ưu tiên cao":suggestion.priority==="high"?"Cần theo dõi":"Gợi ý"}</span>
    <strong>{suggestion.title}</strong><small>{learner.name} · {learner.className} · Bài {suggestion.lessonNumber}</small>
    <p>{suggestion.reason}</p>
    <small>{explanation}{evidenceCaution?" · Video phải được kiểm chứng trước khi dùng để hướng dẫn.":""}</small>
    <button type="button" onClick={()=>onUse(learner.personCode,suggestion)}>
     {modeLabel(suggestion.mode)} <TaskGlyph name="arrow" size={16}/>
    </button>
   </div>
  </article>)}
  {!items.length?<div className="icon-task-ai-empty"><TaskGlyph name="check" size={32}/><strong>Chưa có đề xuất đủ điều kiện hiển thị</strong><p>Không có nghĩa mọi học viên đều đạt chuẩn; kiểm tra độ phủ nguồn và tải lại dữ liệu.</p></div>:null}
  </div>
  {items.length>4?<footer className="icon-task-ai-footer"><button type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>
   {expanded?"Thu gọn đề xuất":"Xem thêm "+(items.length-4)+" đề xuất"} <TaskGlyph name="arrow" size={16}/>
  </button></footer>:null}
 </section>;
}
