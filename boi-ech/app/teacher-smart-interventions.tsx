"use client";

import {useState} from "react";
import {TaskGlyph} from "./teacher-task-icon-v39";

export type SmartSuggestionClient={
 id:string;mode:"feedback"|"assignment"|"review";priority:"critical"|"high"|"normal";
 lessonNumber:string;title:string;reason:string;noteTemplate:string;evidence:string[];
 requiresHumanReview:true;
};
type SmartLearner={name:string;personCode:string;className:string;interventionSuggestions:SmartSuggestionClient[]};
function modeLabel(mode:SmartSuggestionClient["mode"]){
 return mode==="assignment"?"Giao bài luyện":mode==="review"?"Review AI":"Nhận xét";
}
export default function TeacherSmartInterventions({learners,onUse}:{
 learners:SmartLearner[];onUse:(personCode:string,suggestion:SmartSuggestionClient)=>void;
}){
 const [expanded,setExpanded]=useState(false);
 const items=learners
  .flatMap(learner=>learner.interventionSuggestions.map(suggestion=>({learner,suggestion})))
  .sort((left,right)=>{
   const rank={critical:3,high:2,normal:1} as const;
   return rank[right.suggestion.priority]-rank[left.suggestion.priority];
  }).slice(0,18);
 const visible=expanded?items:items.slice(0,4);
 return <section className="teacher-smart-interventions icon-task-ai" aria-label="Gợi ý can thiệp thông minh">
  <header className="icon-task-ai-heading">
   <div className="icon-task-ai-heading-title"><span><TaskGlyph name="sparkles" size={25}/></span>
    <div><small>SMART INTERVENTION ENGINE</small><h2>Gợi ý can thiệp</h2></div>
   </div>
   <p>Đề xuất dựa trên dữ liệu học tập hiện có. Giảng viên phải duyệt nội dung trước khi gửi.</p>
   <strong className="icon-task-ai-count">{items.length} đề xuất cần xem</strong>
  </header>
  <div className="icon-task-ai-list">{visible.map(({learner,suggestion})=><article key={learner.personCode+"-"+suggestion.id}
   className="icon-task-ai-card" data-priority={suggestion.priority}>
   <div className="icon-task-ai-icon"><TaskGlyph name={suggestion.priority==="critical"?"clock":suggestion.priority==="high"?"help":"trend"} size={27}/></div>
   <div className="icon-task-ai-detail"><span className="icon-task-ai-priority">{suggestion.priority==="critical"?"Ưu tiên cao":suggestion.priority==="high"?"Cần theo dõi":"Gợi ý"}</span>
    <strong>{suggestion.title}</strong><small>{learner.name} · {learner.className} · Bài {suggestion.lessonNumber}</small>
    <p>{suggestion.reason}</p>
    <button type="button" onClick={()=>onUse(learner.personCode,suggestion)}>
     {modeLabel(suggestion.mode)} <TaskGlyph name="arrow" size={16}/>
    </button>
   </div>
  </article>)}
  {!items.length?<div className="icon-task-ai-empty"><TaskGlyph name="check" size={32}/><strong>Chưa có đề xuất mới</strong><p>Engine chỉ hiển thị gợi ý khi có đủ tín hiệu học tập và bằng chứng hiện có. Không có hành động gửi tự động.</p></div>:null}
  </div>
  {items.length>4?<footer className="icon-task-ai-footer"><button type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>
   {expanded?"Thu gọn đề xuất":"Xem thêm "+(items.length-4)+" đề xuất"} <TaskGlyph name="arrow" size={16}/>
  </button></footer>:null}
 </section>;
}
