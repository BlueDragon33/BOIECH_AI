import {DeviceAccessError,getCourseDatabase,verifyDeviceRequest} from "../../../device-auth.server";

export const dynamic="force-dynamic";
type Role="learner"|"teacher";
type HubStub={fetch(request:Request):Promise<Response>};
type HubNamespace={idFromName(name:string):unknown;get(id:unknown):HubStub};
async function realtimeHub():Promise<HubStub|null>{
 try{
  const workers=await import("cloudflare:workers");
  const ns=(workers.env as unknown as {CHAT_HUB?:HubNamespace}).CHAT_HUB;
  return ns?.get(ns.idFromName("conversations-v16"))??null;
 }catch{return null;}
}

type Channel="chat"|"request";
type MessageRow={id:number;device_id:string;event_type:string;detail_json:string;created_at:string};
const EVENTS={
 learner_chat:"learner_chat",teacher_chat:"teacher_chat",
 learner_request:"learner_support_request",teacher_request:"teacher_support_reply"
} as const;
const TYPES=Object.values(EVENTS);
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
const clean=(v:unknown,max:number)=>typeof v==="string"?v.replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max):"";
const classes=(v:string|null)=>[...new Set(String(v??"").split(/[;,\n]+/).map(s=>s.trim().toLocaleLowerCase("vi")).filter(Boolean))].slice(0,12);
function parse(row:MessageRow){
 let detail:Record<string,unknown>={};try{detail=JSON.parse(row.detail_json) as Record<string,unknown>;}catch{}
 const role:Role=row.event_type.startsWith("teacher_")?"teacher":"learner";
 return {id:row.id,role,channel:row.event_type.endsWith("_chat")?"chat" as Channel:"request" as Channel,
  message:clean(detail.message,1200),subject:clean(detail.subject,100),
  requestId:Number(detail.requestId)||null,createdAt:row.created_at,senderName:clean(detail.senderName,90)|| (role==="teacher"?"Giảng viên":"Học viên")};
}
export async function POST(request:Request){
 try{
  if(Number(request.headers.get("content-length"))>8192)return json({error:"Yêu cầu vượt giới hạn 8 KB."},413);
  const payload=await request.json() as Record<string,unknown>;
  const host=new URL(request.url).hostname;
  const actor=await verifyDeviceRequest(payload,host==="terminal.local"||host==="localhost");
  if(actor.personRole!=="teacher"&&actor.personRole!=="learner")return json({error:"Chỉ Giảng viên hoặc Học viên được sử dụng hộp thư."},403);
  const role=actor.personRole as Role;
  const operation=clean(payload.action,16);
  if(!["list","send","inbox","connect","seen"].includes(operation))return json({error:"Thao tác không hợp lệ."},400);
  const teacherClasses=classes(actor.className);
  if(!teacherClasses.length||!actor.registrationComplete||actor.accessExpired)return json({error:"Tài khoản chưa đủ điều kiện liên lạc."},403);
  const db=await getCourseDatabase();
  const bindClass=teacherClasses.map(()=> "lower(trim(?))").join(",");
  if(operation==="connect"){
   const stub=await realtimeHub();
   if(!stub)return json({realtime:false,mode:"polling"});
   const ticket=crypto.randomUUID().replaceAll("-","");
   const payload={ticket,deviceId:actor.deviceId,role,
    personCode:actor.personCode||"",classes:teacherClasses,
    ticketExpires:Date.now()+30000,expiresAt:Date.now()+120000};
   const admitted=await stub.fetch(new Request("https://realtime.internal/ticket",{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)}));
   if(!admitted.ok)return json({realtime:false,mode:"polling"});
   return json({realtime:true,mode:"websocket",ticket,expiresIn:30});
  }
  if(operation==="inbox"){
   if(role!=="teacher")return json({error:"Chỉ Giảng viên xem được danh sách tin đến."},403);
   const result=await db.prepare(`SELECT e.id,e.device_id,e.event_type,e.detail_json,e.created_at,
      d.learner_name,d.person_code,d.class_name
      FROM course_activity_events e JOIN device_access d ON d.device_id=e.device_id
      WHERE d.person_role='learner' AND d.status='approved'
        AND lower(trim(d.class_name)) IN (${bindClass})
        AND e.event_type IN ('learner_chat','learner_support_request')
      ORDER BY e.id DESC LIMIT 100`).bind(...teacherClasses).all<MessageRow&{learner_name:string|null;person_code:string|null;class_name:string|null}>();
   // Read receipts are durable, scoped to the signed teacher device and
   // the learner's canonical conversation id. Never infer "read" from polling.
   const seenEvents=await db.prepare(`SELECT detail_json FROM course_activity_events
     WHERE device_id=? AND event_type='teacher_conversation_seen'
     ORDER BY id DESC LIMIT 2000`).bind(actor.deviceId).all<{detail_json:string}>();
   const lastSeen=new Map<string,number>();
   for(const row of seenEvents.results??[]){
    try{
     const value=JSON.parse(row.detail_json) as {learnerDeviceId?:string;channel?:string;lastSeenEventId?:number};
     if(!value.learnerDeviceId||!["chat","request"].includes(value.channel||""))continue;
     const key=value.learnerDeviceId+":"+value.channel;
     lastSeen.set(key,Math.max(lastSeen.get(key)||0,Number(value.lastSeenEventId)||0));
    }catch{ /* malformed legacy audit data cannot grant read receipts */ }
   }
   const unread={chat:0,request:0};
   const recent=(result.results??[]).map(row=>{
    const message=parse(row);
    const isUnread=row.id>(lastSeen.get(row.device_id+":"+message.channel)||0);
    if(isUnread)unread[message.channel]++;
    return {...message,unread:isUnread,learnerPersonCode:row.person_code||"",
     learnerName:row.learner_name||"Học viên",className:row.class_name||""};
   });
   return json({recent,unread});
  }
  let learnerId=actor.deviceId;
  let learnerCode=actor.personCode||"";
  let learnerClass=actor.className||"";
  if(role==="teacher"){
   learnerCode=clean(payload.learnerPersonCode,80);
   if(!learnerCode)return json({error:"Hãy chọn học viên thuộc lớp phụ trách."},400);
   const target=await db.prepare(`SELECT device_id, class_name FROM device_access
      WHERE person_role='learner' AND status='approved' AND person_code=?
       AND lower(trim(class_name)) IN (${bindClass}) LIMIT 1`)
      .bind(learnerCode,...teacherClasses).first<{device_id:string;class_name:string|null}>();
   if(!target)return json({error:"Không tìm thấy học viên trong lớp được phân công."},404);
   learnerId=target.device_id;
   learnerClass=target.class_name||"";
  }
  if(operation==="seen"){
   if(role!=="teacher")return json({error:"Chỉ Giảng viên xác nhận đã đọc tin đến."},403);
   const seenChannel=payload.channel==="chat"?"chat":payload.channel==="request"?"request":null;
   const seenId=Number(payload.lastSeenEventId);
   if(!seenChannel||!Number.isSafeInteger(seenId)||seenId<=0)return json({error:"Mốc đã đọc không hợp lệ."},400);
   const allowedType=seenChannel==="chat"?EVENTS.learner_chat:EVENTS.learner_request;
   const incoming=await db.prepare(`SELECT id FROM course_activity_events
     WHERE id=? AND device_id=? AND event_type=? LIMIT 1`)
     .bind(seenId,learnerId,allowedType).first<{id:number}>();
   if(!incoming)return json({error:"Tin đã đọc không thuộc học viên hoặc kênh này."},404);
   // A deterministic event ID makes retries idempotent; append-only receipt
   // avoids migration and preserves D1 audit history.
   const clientEventId=`conversation:seen:${seenChannel}:${seenId}`;
   await db.prepare(`INSERT OR IGNORE INTO course_activity_events
     (device_id,event_type,lesson_number,part,detail_json,client_event_id)
     VALUES (?,'teacher_conversation_seen',NULL,'teacher-conversations',?,?)`)
     .bind(actor.deviceId,JSON.stringify({learnerDeviceId:learnerId,
      learnerPersonCode:learnerCode,channel:seenChannel,lastSeenEventId:seenId}),clientEventId).run();
   return json({ok:true,lastSeenEventId:seenId});
  }
  if(operation==="list"){
   const data=await db.prepare(`SELECT id,device_id,event_type,detail_json,created_at
      FROM course_activity_events
      WHERE device_id=? AND event_type IN ('learner_chat','teacher_chat','learner_support_request','teacher_support_reply')
      ORDER BY id DESC LIMIT 120`).bind(learnerId).all<MessageRow>();
   const messages=(data.results??[]).reverse().map(parse);
   return json({messages,cursor:messages.at(-1)?.id??0,mode:"polling"});
  }
  const channel=payload.channel==="chat"?"chat":payload.channel==="request"?"request":null;
  if(!channel)return json({error:"Kênh gửi không hợp lệ."},400);
  const raw=typeof payload.message==="string"?payload.message:"";
  const message=clean(raw,1200);
  if(!message||raw.length>1200)return json({error:"Tin nhắn cần có nội dung tối đa 1.200 ký tự."},400);
  const subject=clean(payload.subject,100);
  if(channel==="request"&&role==="learner"&&!subject)return json({error:"Thư yêu cầu cần có tiêu đề."},400);
  const requestId=Number(payload.requestId)||null;
  if(channel==="request"&&role==="teacher"){
   if(!Number.isInteger(requestId)||!requestId||requestId<1)return json({error:"Phải chọn một thư yêu cầu để phản hồi."},400);
   const original=await db.prepare(`SELECT id FROM course_activity_events
     WHERE id=? AND device_id=? AND event_type='learner_support_request' LIMIT 1`)
     .bind(requestId,learnerId).first<{id:number}>();
   if(!original)return json({error:"Không tìm thấy thư yêu cầu thuộc học viên này."},404);
  }
  if(channel==="request"&&role==="learner"&&requestId)return json({error:"Học viên hãy gửi thư mới; phản hồi của Giảng viên sẽ gắn với thư gốc."},400);
  const eventId=clean(payload.clientEventId,100);
  if(!/^[A-Za-z0-9:_-]{12,100}$/.test(eventId))return json({error:"Thiếu mã chống gửi lặp hợp lệ."},400);
  const dup=await db.prepare("SELECT id FROM course_activity_events WHERE device_id=? AND client_event_id=? LIMIT 1")
   .bind(learnerId,eventId).first<{id:number}>();
  if(dup)return json({ok:true,id:dup.id,duplicate:true});
  const eventType=channel==="chat"?(role==="teacher"?EVENTS.teacher_chat:EVENTS.learner_chat)
    :(role==="teacher"?EVENTS.teacher_request:EVENTS.learner_request);
  const counted=await db.prepare(`SELECT COUNT(*) AS count FROM course_activity_events
     WHERE device_id=? AND event_type=? AND created_at >= datetime('now','-1 day')`)
     .bind(learnerId,eventType).first<{count:number}>();
  if(Number(counted?.count||0)>=60)return json({error:"Đã đạt giới hạn 60 tin/ngày của kênh. Hãy thử lại sau."},429);
  const detail={source:"teacher-learner-conversations-v15",role,channel,message,subject,
   requestId:channel==="request"&&role==="teacher"?requestId:null,
   senderName:clean(actor.learnerName,90)||(role==="teacher"?"Giảng viên":"Học viên")};
  const write=await db.prepare(`INSERT INTO course_activity_events
    (device_id,event_type,lesson_number,part,detail_json,client_event_id)
    VALUES (?,?,NULL,'teacher-conversations',?,?)`).bind(learnerId,eventType,JSON.stringify(detail),eventId).run();
  await db.prepare(`INSERT INTO course_audit_log(actor,action,target,detail_json) VALUES(?,?,?,?)`)
   .bind(actor.personCode||actor.deviceCode,eventType,learnerId,JSON.stringify({channel,requestId,messageLength:message.length})).run();
  const savedId=Number(write.meta?.last_row_id)||null;
  // D1 is canonical. Realtime failure must not roll back a committed message.
  // A reconnect fetches missed records through the authenticated REST endpoint.
  if(savedId){
   try{
    const stub=await realtimeHub();
    if(stub)await stub.fetch(new Request("https://realtime.internal/publish",{
     method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify({type:"conversation_changed",id:savedId,
      learnerDeviceId:learnerId,learnerPersonCode:learnerCode,learnerClass})}));
   }catch{ /* durable D1 record remains available on reconnect */ }
  }
  return json({ok:true,id:savedId},201);
 }catch(error){
  if(error instanceof DeviceAccessError)return json({error:error.message,code:error.code,device:error.device},error.status);
  return json({error:"Không thể xử lý kênh liên lạc. Vui lòng thử lại."},500);
 }
}
