"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {conversationRequest,newClientEventId,type ConversationItem,type IncomingItem,type ConversationChannel} from "./teacher-learner-conversation-client";
import styles from "./teacher-learner-conversations.module.css";

type LearnerOption={name:string;personCode:string;className:string};
type Props={role:"learner"|"teacher";deviceId:string;learners?:LearnerOption[]};
function when(value:string){const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(date):"—";}
const label={chat:"Chat trực tiếp",request:"Thư yêu cầu & phản hồi"} as const;

/** No page reload: scoped authenticated D1 polling every 5–7s while visible. Not a WebSocket. */
export default function TeacherLearnerConversations({role,deviceId,learners=[]}:Props){
 const [channel,setChannel]=useState<ConversationChannel>("chat");
 const [selected,setSelected]=useState("");
 const [records,setRecords]=useState<{target:string;items:ConversationItem[]}>({target:"",items:[]});
 const [inbox,setInbox]=useState<IncomingItem[]>([]);
 const [text,setText]=useState("");
 const [subject,setSubject]=useState("");
 const [requestId,setRequestId]=useState<number|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const lastIncoming=useRef<number|null>(null);
 const pendingId=useRef<string|null>(null);
 const validDevice=/^[a-f0-9]{64}$/i.test(deviceId);
 const available=useMemo(()=>learners.filter(l=>l.personCode),[learners]);
 const scopedInbox=inbox.filter(item=>available.some(l=>l.personCode===item.learnerPersonCode));
 const target=role==="teacher"?(available.some(l=>l.personCode===selected)?selected:available[0]?.personCode||""):"";
 const messages=records.target===target?records.items:[];
 const forRequest=useMemo(()=>messages.filter(m=>m.channel===channel),[channel,messages]);
 const openRequests=useMemo(()=>messages.filter(m=>m.channel==="request"&&m.role==="learner"&&!m.requestId),[messages]);
 const selectedRequest=openRequests.find(m=>m.id===requestId)||null;
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  if(!validDevice||(role==="teacher"&&!target))return;
  const data=await conversationRequest(deviceId,{action:"list",...(target?{learnerPersonCode:target}:{})},signal);
  if(!signal?.aborted){setRecords({target,items:data.messages??[]});setLoading(false);setError("");}
 },[role,deviceId,target,validDevice]);
 useEffect(()=>{
  if(!validDevice||(role==="teacher"&&!target))return;
  let dead=false,pending=false;
  const controller=new AbortController();
  const poll=()=>{
   if(dead||pending||document.visibilityState==="hidden"||!navigator.onLine)return;
   pending=true;
   void refresh(controller.signal).catch(err=>{if(!dead&&!controller.signal.aborted){setError(err instanceof Error?err.message:"Không tải được tin nhắn.");setLoading(false);}}).finally(()=>{pending=false;});
  };
  poll();
  const handle=()=>poll();
  const timer=window.setInterval(poll,5200);
  document.addEventListener("visibilitychange",handle);
  window.addEventListener("online",handle);
  return ()=>{dead=true;controller.abort();window.clearInterval(timer);document.removeEventListener("visibilitychange",handle);window.removeEventListener("online",handle);};
 },[refresh,validDevice,role,target]);
 useEffect(()=>{
  if(role!=="teacher"||!validDevice)return;
  let dead=false,pending=false;
  const controller=new AbortController();
  const poll=()=>{
   if(dead||pending||document.visibilityState==="hidden"||!navigator.onLine)return;
   pending=true;
   void conversationRequest(deviceId,{action:"inbox"},controller.signal)
    .then(data=>{
     if(dead||controller.signal.aborted)return;
     const list=data.recent??[];
     setInbox(list);
     const newest=list[0]?.id??0;
     if(lastIncoming.current!==null&&newest>lastIncoming.current&&list[0])setNotice(`Có tin mới từ ${list[0].learnerName}.`);
     lastIncoming.current=newest;
    }).catch(err=>{if(!dead&&!controller.signal.aborted)setError(err instanceof Error?err.message:"Lỗi đồng bộ thư đến.");})
    .finally(()=>{pending=false;});
  };
  poll();
  const handle=()=>poll();
  const timer=window.setInterval(poll,6800);
  document.addEventListener("visibilitychange",handle);window.addEventListener("online",handle);
  return ()=>{dead=true;controller.abort();window.clearInterval(timer);document.removeEventListener("visibilitychange",handle);window.removeEventListener("online",handle);};
 },[deviceId,role,validDevice]);
 function resetDraft(){pendingId.current=null;setText("");setSubject("");setRequestId(null);}
 function selectChannel(type:ConversationChannel){setChannel(type);resetDraft();}
 async function send(event:React.FormEvent){
  event.preventDefault();if(busy||!validDevice)return;
  const message=text.trim();if(!message||message.length>1200)return;
  if(role==="teacher"&&!target){setError("Hãy chọn học viên.");return;}
  if(channel==="request"&&role==="learner"&&!subject.trim()){setError("Hãy nhập tiêu đề thư yêu cầu.");return;}
  if(channel==="request"&&role==="teacher"&&!selectedRequest){setError("Chọn thư yêu cầu cần trả lời.");return;}
  setBusy(true);setError("");
  pendingId.current??=newClientEventId();
  try{
   await conversationRequest(deviceId,{action:"send",channel,message,subject:channel==="request"?subject.trim():"",
    ...(target?{learnerPersonCode:target}:{}),...(channel==="request"&&role==="teacher"?{requestId:selectedRequest!.id}:{}),
    clientEventId:pendingId.current});
   pendingId.current=null;setText("");if(role==="learner"&&channel==="request")setSubject("");
   await refresh();setNotice("Đã gửi. Người nhận sẽ thấy tin khi tự đồng bộ.");
  }catch(err){setError(err instanceof Error?err.message:"Chưa gửi được. Có thể thử lại mà không tạo tin trùng.");}
  finally{setBusy(false);}
 }
 const editing=(value:string)=>{setText(value);pendingId.current=null;};
 if(!validDevice)return <section className={styles.shell}><p>Đang xác minh thiết bị để mở kênh Giảng viên – Học viên…</p></section>;
 return <section className={styles.shell} aria-label="Liên lạc trực tiếp giữa giảng viên và học viên">
  <header className={styles.header}><div><small>LIÊN LẠC HAI CHIỀU</small><h2>Giảng viên ↔ Học viên</h2><p>Hai kênh độc lập, lưu theo đúng lớp và tài khoản. Tự nhận tin mới khi trang đang mở.</p></div><span className={styles.online}>● Tự đồng bộ 5–7 giây</span></header>
  {role==="teacher"?<div className={styles.teacherScope}>
    <label>Học viên trong lớp<select value={target} onChange={e=>{setSelected(e.target.value);resetDraft();setNotice("");}}>
      {available.length?available.map(l=><option key={l.personCode} value={l.personCode}>{l.name} · {l.className}</option>):<option value="">Chưa có học viên phù hợp</option>}
    </select></label>
    <div className={styles.incoming}><strong>Thư và tin mới nhất trong lớp</strong><div>
     {scopedInbox.slice(0,5).map(item=><button type="button" key={item.id} onClick={()=>{
       setSelected(item.learnerPersonCode);selectChannel(item.channel);setNotice("");
       if(item.channel==="request")setRequestId(item.id);
      }}><span>{item.channel==="request"?"✉":"●"} {item.learnerName}</span><small>{item.subject||item.message.slice(0,80)}</small></button>)}
     {!scopedInbox.length?<span>Chưa có tin mới trong phạm vi lớp đang chọn.</span>:null}
    </div></div>
  </div>:null}
  <nav className={styles.tabs} aria-label="Chọn kênh liên lạc">
    {(["chat","request"] as const).map(type=><button type="button" key={type} aria-pressed={channel===type}
      className={channel===type?styles.active:""} onClick={()=>selectChannel(type)}>{type==="chat"?"💬":"✉️"} {label[type]}</button>)}
  </nav>
  {notice?<p className={styles.notice} role="status">{notice}</p>:null}
  {error?<p className={styles.error} role="alert">{error}</p>:null}
  <div className={styles.history} aria-live="polite" aria-relevant="additions">
    {forRequest.map(item=><article key={item.id} className={styles.message} data-mine={item.role===role}>
      <div><strong>{item.senderName}</strong><time>{when(item.createdAt)}</time></div>
      {item.subject?<b className={styles.subject}>✉ {item.subject}</b>:null}
      {item.requestId?<small>Phản hồi cho thư #{item.requestId}</small>:null}
      <p>{item.message}</p>
      {channel==="request"&&role==="teacher"&&item.role==="learner"&&!item.requestId?
       <button type="button" className={styles.reply} onClick={()=>setRequestId(item.id)}>Trả lời thư này</button>:null}
    </article>)}
    {!forRequest.length?<p className={styles.empty}>{loading||records.target!==target?"Đang đồng bộ hội thoại…":channel==="chat"?"Chưa có tin chat. Bạn có thể bắt đầu cuộc trò chuyện.":"Chưa có thư yêu cầu. Học viên có thể gửi thư mới mà không cần Giảng viên nhắn trước."}</p>:null}
  </div>
  <form className={styles.form} onSubmit={event=>void send(event)}>
    {channel==="request"&&role==="learner"?<label>Tiêu đề yêu cầu<input value={subject} maxLength={100} onChange={e=>{setSubject(e.target.value);pendingId.current=null;}} placeholder="Ví dụ: Cần hướng dẫn kỹ thuật đạp chân" required/></label>:null}
    {channel==="request"&&role==="teacher"?<label>Thư cần trả lời<select value={selectedRequest?.id??""} onChange={e=>{setRequestId(Number(e.target.value)||null);pendingId.current=null;}} required>
      <option value="">Chọn thư của học viên</option>{openRequests.map(m=><option key={m.id} value={m.id}>#{m.id} · {m.subject||m.message.slice(0,60)}</option>)}
    </select></label>:null}
    <label>Nội dung {channel==="request"?"thư":"tin nhắn"}<textarea rows={3} maxLength={1200} value={text} onChange={e=>editing(e.target.value)}
      placeholder={channel==="chat"?"Nhập tin nhắn gửi trực tiếp…":"Mô tả vấn đề, yêu cầu hướng dẫn hoặc phản hồi cụ thể…"} required/></label>
    <div className={styles.actions}><small>{text.length}/1200 · Không đính kèm video gốc hoặc dữ liệu nhạy cảm</small>
      <button disabled={busy||!text.trim()||(role==="teacher"&&!selected)||(channel==="request"&&role==="teacher"&&!selectedRequest)} type="submit">{busy?"Đang gửi…":channel==="chat"?"Gửi tin nhắn":"Gửi thư / phản hồi"}</button></div>
  </form>
 </section>;
}
