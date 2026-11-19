"use client";

import {useState} from "react";

export type TeacherInboxReceiptV43={
 eventId:number;state:"unread"|"seen";revision:number;createdAt:string;
 learnerCode?:string|null;lessonNumber?:string|null;
};
export type TeacherInboxReplyV43={
 items:TeacherInboxReceiptV43[];unreadCount:number;
 possiblyTruncated:boolean;limitations?:string;
 ok?:boolean;code?:string;revision?:number|null;error?:string;
};

/**
 * Media-free, signed teacher receipt queue. Explicit refresh/seen are the
 * ONLY operations; a receipt is not confirmation that a video was reviewed.
 */
export default function TeacherVideoInboxPanelV43({onRequest}:{
 onRequest:(payload:{action:"list"|"seen";eventId?:number;expectedRevision?:number})=>
 Promise<TeacherInboxReplyV43>;
}){
 const [items,setItems]=useState<TeacherInboxReceiptV43[]>([]);
 const [loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [note,setNote]=useState("");
 const [incomplete,setIncomplete]=useState(false);
 const refresh=async()=>{
  if(busy)return;
  setBusy(true);setError("");
  try{
   const response=await onRequest({action:"list"});
   if(!Array.isArray(response.items))throw new Error("Hàng chờ không trả về dữ liệu xác thực.");
   setItems(response.items.filter(item=>
    Number.isSafeInteger(item.eventId)&&item.eventId>0&&
    Number.isSafeInteger(item.revision)&&item.revision>0&&
    (item.state==="unread"||item.state==="seen")));
   setIncomplete(Boolean(response.possiblyTruncated));
   setLoaded(true);setNote(response.limitations??"Chỉ tải thông báo video của lớp đang phụ trách.");
  }catch(e){setError(e instanceof Error?e.message:"Không đồng bộ được hàng chờ video.");}
  finally{setBusy(false);}
 };
 const markSeen=async(item:TeacherInboxReceiptV43)=>{
  if(busy||item.state!=="unread")return;
  setBusy(true);setError("");
  try{
   const reply=await onRequest({action:"seen",eventId:item.eventId,expectedRevision:item.revision});
   if(!reply.ok||!Number.isSafeInteger(reply.revision)||Number(reply.revision)<item.revision)
    throw new Error(reply.error??"Phiên bản đã thay đổi. Tải lại hàng chờ.");
   setItems(current=>current.map(entry=>entry.eventId===item.eventId?
    {...entry,state:"seen",revision:Number(reply.revision)}:entry));
   setNote("Đã đánh dấu đã xem thông báo. Chưa đồng nghĩa đã đánh giá kỹ thuật video.");
  }catch(e){setError(e instanceof Error?e.message:"Không thể đánh dấu đã xem.");}
  finally{setBusy(false);}
 };
 const unread=items.filter(x=>x.state==="unread").length;
 return <section aria-label="Hàng chờ video Giảng viên" data-teacher-video-inbox-v43="true">
  <header>
   <div><strong>Hàng chờ video kỹ thuật · V43</strong>
   <small>Chỉ tham chiếu sự kiện; không lưu hoặc mở video gốc từ máy chủ.</small></div>
   <button type="button" disabled={busy} onClick={()=>void refresh()}>
    {busy?"Đang đồng bộ…":loaded?"Tải lại hàng chờ":"Tải hàng chờ"}
   </button>
  </header>
  {error?<p role="alert">{error}</p>:null}
  {loaded?<div>
   <p role="status">{unread} chưa xem / {items.length} thông báo đang tải.
    {incomplete?" Danh sách bị giới hạn, chưa phải toàn bộ thông báo.":""}</p>
   {items.length?<ul>
    {items.map(item=><li key={item.eventId}>
      <span>{item.learnerCode?"Mã học viên "+item.learnerCode+" · ":""}{item.lessonNumber?"Bài "+item.lessonNumber+" · ":""}Sự kiện video #{item.eventId} · {item.createdAt} ·
       {item.state==="seen"?" Đã xem thông báo":" Chưa xem"}</span>
      {item.state==="unread"?<button type="button" disabled={busy}
       onClick={()=>void markSeen(item)}>Đánh dấu đã xem</button>:null}
    </li>)}
   </ul>:<p>Chưa có thông báo trong những lớp hiện được phân quyền.</p>}
   <small>{note}</small>
  </div>:<p>Nhấn tải để xem thông báo thuộc lớp của bạn. Không tự chạy nền.</p>}
 </section>;
}
