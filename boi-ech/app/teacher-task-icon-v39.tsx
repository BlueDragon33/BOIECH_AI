"use client";

import {useState,type ReactNode} from "react";
import type { TeacherAssignmentScheduleItem } from "./teacher-assignment-schedule";

export type TaskFilter = "all" | "active" | "overdue" | "needs-help" | "completed";
type GlyphName = "plus" | "play" | "clock" | "help" | "sparkles" | "task" | "check" | "wave" | "user" | "calendar" | "eye" | "arrow" | "search" | "layers" | "trend";

export function TaskGlyph({name,size=22}:{name:GlyphName;size?:number}){
 const shapes:Record<GlyphName,ReactNode>={
  plus:<><path d="M12 5v14M5 12h14"/></>,
  play:<><path d="m8 5 11 7-11 7z"/></>,
  clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>,
  help:<><circle cx="12" cy="12" r="9"/><path d="M12 16v.01M9.5 9a3 3 0 0 1 5 2c0 2-2.5 2.5-2.5 3"/></>,
  sparkles:<><path d="m12 2 2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2L12 2zM20 19l1 2m-2-1h2"/></>,
  task:<><rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4V2h6v2M9 13l2 2 4-4"/></>,
  check:<><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
  wave:<><path d="M2 14c3-4 6 4 10 0s7-4 10 0M2 19c3-4 6 4 10 0s7-4 10 0"/><circle cx="16" cy="5" r="2"/><path d="m5 10 5-4 5 3"/></>,
  user:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/></>,
  eye:<><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/></>,
  arrow:<><path d="M5 12h14m-6-6 6 6-6 6"/></>,
  search:<><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,
  layers:<><path d="m12 3 9 5-9 5-9-5 9-5zm-9 9 9 5 9-5M3 16l9 5 9-5"/></>,
  trend:<><path d="m3 17 6-6 4 3 8-9M15 5h6v6"/></>
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shapes[name]}</svg>;
}

export type TaskLearnerOption={personCode:string;name:string;className:string};
type QuickProps={
 assignments:TeacherAssignmentScheduleItem[];
 learners:TaskLearnerOption[];
 filter:TaskFilter;
 onFilterChange:(next:TaskFilter)=>void;
 showCreator:boolean;
 onCreatorChange:(next:boolean)=>void;
 onAssign:(personCode:string)=>void;
};
export function TeacherTaskQuickActions({assignments,learners,filter,onFilterChange,showCreator,onCreatorChange,onAssign}:QuickProps){
 const [picked,setPicked]=useState("");
 const selected=learners.some(l=>l.personCode===picked)?picked:(learners[0]?.personCode||"");
 const active=assignments.filter(a=>["open","upcoming","acknowledged"].includes(a.scheduleState)).length;
 const overdue=assignments.filter(a=>a.scheduleState==="overdue").length;
 const needsHelp=assignments.filter(a=>a.scheduleState==="needs-help").length;
 const jumpToSuggestions=()=>{
  const node=document.getElementById("teacher-task-ai-v39");
  node?.scrollIntoView({block:"start",behavior:"auto"});
  node?.focus();
 };
 const tiles=[
  {id:"create",name:"Tạo bài tập",help:"Giao bài luyện mới",icon:"plus" as const,tone:"create",action:()=>onCreatorChange(!showCreator),count:undefined},
  {id:"active",name:"Đang theo dõi",help:"Bài đã giao, chưa hoàn tất",icon:"play" as const,tone:"active",action:()=>onFilterChange("active"),count:active},
  {id:"overdue",name:"Quá hạn",help:"Kiểm tra việc cần xử lý",icon:"clock" as const,tone:"overdue",action:()=>focusList("overdue"),count:overdue},
  {id:"needs-help",name:"Cần hỗ trợ",help:"Học viên đã yêu cầu giúp đỡ",icon:"help" as const,tone:"help",action:()=>focusList("needs-help"),count:needsHelp},
  {id:"ai",name:"Gợi ý AI",help:"Giảng viên xem và quyết định",icon:"sparkles" as const,tone:"ai",action:jumpToSuggestions,count:undefined}
 ];
 return <section className="icon-task-quick-area" id="teacher-task-quick-v39" aria-label="Lối tắt quản lý bài luyện">
  <div className="icon-task-shortcuts">{tiles.map(t=><button type="button" key={t.id}
    className="icon-task-shortcut" data-tone={t.tone} aria-pressed={t.id!=="create"&&t.id!=="ai"?filter===t.id:undefined}
    aria-expanded={t.id==="create"?showCreator:undefined} aria-controls={t.id==="create"?"teacher-task-create-v39":undefined}
    onClick={t.action}><span className="icon-task-tile-icon"><TaskGlyph name={t.icon} size={29}/></span><span className="icon-task-tile-text"><strong>{t.name}</strong><small>{t.help}</small></span>
    {typeof t.count==="number"?<b className="icon-task-tile-count">{t.count}</b>:<TaskGlyph name="arrow" size={16}/>}</button>)}</div>
  {showCreator?<div className="icon-task-create" id="teacher-task-create-v39">
    <div><strong>Giao bài luyện cho học viên</strong><small>Chọn học viên trong phạm vi lớp hiện tại. Nội dung chỉ được gửi khi giảng viên xác nhận trong biểu mẫu.</small></div>
    <label>Học viên <select value={selected} onChange={e=>setPicked(e.target.value)}>
     {learners.length?learners.map(l=><option key={l.personCode} value={l.personCode}>{l.name} · {l.className}</option>):<option value="">Không có học viên trong phạm vi</option>}
    </select></label>
    <button className="icon-task-primary" type="button" disabled={!selected} onClick={()=>{onAssign(selected);onCreatorChange(false);}}><TaskGlyph name="plus" size={18}/> Mở biểu mẫu giao bài</button>
    <button className="icon-task-quiet" type="button" onClick={()=>onCreatorChange(false)} aria-label="Đóng lựa chọn giao bài">Đóng</button>
  </div>:null}
 </section>;
}


export function TeacherTaskToday({assignments,helpCount,onFilterChange,onCreate,onReports}:{
 assignments:TeacherAssignmentScheduleItem[];helpCount:number;onFilterChange:(next:TaskFilter)=>void;
 onCreate:()=>void;onReports:()=>void;
}){
 const overdue=assignments.filter(a=>a.scheduleState==="overdue").length;
 const helpAssignments=assignments.filter(a=>a.scheduleState==="needs-help").length;
 const focusList=(next:TaskFilter)=>{onFilterChange(next);document.getElementById("teacher-task-list-v39")?.scrollIntoView({block:"start",behavior:"auto"});};
 const actions=[
  {label:"Xem quá hạn",sub:overdue+" nhiệm vụ",icon:"clock" as const,tone:"overdue",action:()=>onFilterChange("overdue")},
  {label:"Cần hỗ trợ",sub:helpAssignments+" bài · "+helpCount+" học viên",icon:"help" as const,tone:"help",action:()=>onFilterChange("needs-help")},
  {label:"Giao bài luyện",sub:"Giảng viên xác nhận",icon:"plus" as const,tone:"create",action:onCreate},
  {label:"Xem báo cáo",sub:"Tiến độ thực tế",icon:"trend" as const,tone:"ai",action:onReports}
 ];
 return <section className="icon-task-today" aria-label="Thao tác cần xử lý">
  <div className="icon-task-today-title"><TaskGlyph name="task" size={28}/><div><strong>Hôm nay cần làm</strong><small>Thao tác nhanh, không gửi tự động cho học viên</small></div></div>
  <div className="icon-task-today-actions">{actions.map(a=><button key={a.label} type="button" data-tone={a.tone} onClick={a.action}><TaskGlyph name={a.icon} size={22}/><span><strong>{a.label}</strong><small>{a.sub}</small></span><TaskGlyph name="arrow" size={15}/></button>)}</div>
 </section>;
}
