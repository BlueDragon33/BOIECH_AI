"use client";

import {useMemo,useState} from "react";
import {TaskGlyph,type TaskFilter} from "./teacher-task-icon-v39";

export type TeacherAssignmentScheduleItem={
 id:number;learnerName:string;personCode:string;className:string;lessonNumber:string;
 title:string;note:string;dueAt:string;createdAt:string;
 status:""|"acknowledged"|"completed"|"needs-help";statusAt:string;
 scheduleState:"open"|"upcoming"|"acknowledged"|"completed"|"needs-help"|"overdue";
};

function when(value:string){
 if(!value)return "Không đặt hạn";
 const date=new Date(value);
 return Number.isNaN(date.getTime())?"Không đặt hạn":new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(date);
}
function stateLabel(value:TeacherAssignmentScheduleItem["scheduleState"]){
 if(value==="completed")return "Đã hoàn thành";
 if(value==="needs-help")return "Cần hỗ trợ";
 if(value==="overdue")return "Quá hạn";
 if(value==="acknowledged")return "Đã nhận";
 if(value==="upcoming")return "Đang chờ";
 return "Đang thực hiện";
}
function matchesFilter(item:TeacherAssignmentScheduleItem,filter:TaskFilter){
 if(filter==="all")return true;
 if(filter==="active")return ["open","upcoming","acknowledged"].includes(item.scheduleState);
 return item.scheduleState===filter;
}
export default function TeacherAssignmentSchedule({assignments,onOpen,filter:controlledFilter,onFilterChange}:{
 assignments:TeacherAssignmentScheduleItem[];onOpen:(personCode:string)=>void;
 filter?:TaskFilter;onFilterChange?:(value:TaskFilter)=>void;
}){
 const [localFilter,setLocalFilter]=useState<TaskFilter>("all");
 const filter=controlledFilter??localFilter;
 const chooseFilter=(value:TaskFilter)=>{if(controlledFilter===undefined)setLocalFilter(value);onFilterChange?.(value);};
 const [query,setQuery]=useState("");
 const [expanded,setExpanded]=useState<number|null>(null);
 const counts=useMemo(()=>assignments.reduce((sum,item)=>{
  sum[item.scheduleState]=(sum[item.scheduleState]??0)+1;
  return sum;
 },{} as Record<string,number>),[assignments]);
 const active=(counts.open??0)+(counts.upcoming??0)+(counts.acknowledged??0);
 const visible=useMemo(()=>{
  const needle=query.trim().toLocaleLowerCase("vi");
  return assignments.filter(item=>matchesFilter(item,filter))
   .filter(item=>!needle||[item.learnerName,item.personCode,item.className,item.title,item.note,item.lessonNumber].join(" ").toLocaleLowerCase("vi").includes(needle));
 },[assignments,filter,query]);
 const filters:Array<[TaskFilter,string,number]>=[
  ["all","Tất cả",assignments.length],["active","Đang thực hiện",active],
  ["overdue","Quá hạn",counts.overdue??0],["needs-help","Cần hỗ trợ",counts["needs-help"]??0],
  ["completed","Hoàn thành",counts.completed??0]
 ];
 return <section className="teacher-assignment-schedule icon-task-schedule" aria-label="Bài luyện có hạn và trạng thái thực tế">
  <header className="icon-task-list-heading"><div className="icon-task-heading-title">
   <span className="icon-task-heading-glyph"><TaskGlyph name="layers" size={24}/></span>
   <div><h2>Danh sách bài tập</h2><p>{assignments.length} nhiệm vụ được giao trong lớp hiện tại</p></div>
  </div></header>
  <div className="icon-task-list-toolbar">
   <div className="icon-task-filter-tabs" role="group" aria-label="Lọc bài tập theo trạng thái">
    {filters.map(([id,label,count])=><button key={id} type="button" aria-pressed={filter===id} onClick={()=>chooseFilter(id)}>
     {id==="all"?<TaskGlyph name="layers" size={16}/>:id==="active"?<TaskGlyph name="play" size={16}/>:id==="overdue"?<TaskGlyph name="clock" size={16}/>:id==="needs-help"?<TaskGlyph name="help" size={16}/>:<TaskGlyph name="check" size={16}/>}
     {label} ({count})</button>)}
   </div>
   <label className="icon-task-list-search"><TaskGlyph name="search" size={17}/><span className="sr-only">Tìm trong bài tập</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)}
    placeholder="Tìm học viên, bài luyện…" aria-label="Tìm trong bài tập" /></label>
  </div>
  <div className="icon-task-assignment-list" aria-live="polite">
   {visible.map(item=>{
    const open=expanded===item.id;
    return <article key={item.id} className="icon-task-assignment" data-status={item.scheduleState}>
     <span className="icon-task-lesson-picture" aria-hidden="true"><TaskGlyph name="wave" size={31}/></span>
     <div className="icon-task-assignment-core">
      <strong>{item.title||"Bài luyện được giao"}</strong>
      <div className="icon-task-assignment-tags">
       <span>Bài {item.lessonNumber||"—"}</span><span><TaskGlyph name="user" size={14}/>{item.learnerName}</span><span>{item.className}</span>
      </div>
      <div className="icon-task-assignment-note">{open?item.note||"Không có hướng dẫn bổ sung.":"Chọn “Chi tiết” để xem hướng dẫn và trạng thái đã xác nhận."}</div>
     </div>
     <div className="icon-task-assignment-meta">
      <span className="icon-task-due" data-overdue={item.scheduleState==="overdue"}><TaskGlyph name="calendar" size={17}/>{when(item.dueAt)}</span>
      <span className="icon-task-assignment-status" data-state={item.scheduleState}>
       {item.scheduleState==="completed"?<TaskGlyph name="check" size={15}/>:item.scheduleState==="overdue"?<TaskGlyph name="clock" size={15}/>:item.scheduleState==="needs-help"?<TaskGlyph name="help" size={15}/>:<TaskGlyph name="play" size={15}/>}
       {stateLabel(item.scheduleState)}
      </span>
     </div>
     <div className="icon-task-row-actions">
      <button type="button" className="icon-task-eye" aria-expanded={open} aria-label={(open?"Ẩn":"Xem")+" chi tiết bài luyện của "+item.learnerName}
       onClick={()=>setExpanded(open?null:item.id)}><TaskGlyph name="eye" size={19}/></button>
      <button type="button" className="icon-task-open" onClick={()=>onOpen(item.personCode)}>Mở học viên <TaskGlyph name="arrow" size={16}/></button>
     </div>
    </article>;
   })}
   {!assignments.length?<div className="icon-task-empty"><TaskGlyph name="task" size={36}/><strong>Chưa có bài luyện được giao</strong><p>Chọn “Tạo bài tập” để mở biểu mẫu giao bài cho học viên trong lớp.</p></div>:null}
   {assignments.length>0&&!visible.length?<div className="icon-task-empty"><TaskGlyph name="search" size={34}/><strong>Không tìm thấy bài luyện phù hợp</strong><p>Thay đổi từ khóa hoặc trạng thái lọc để xem các bài luyện khác.</p><button type="button" onClick={()=>{setQuery("");chooseFilter("all");}}>Xóa bộ lọc</button></div>:null}
  </div>
 </section>;
}
