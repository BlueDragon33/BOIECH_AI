import {DeviceAccessError,getCourseDatabase,verifyDeviceRequest} from "../../../device-auth.server";

export const dynamic="force-dynamic";
type Role="learner"|"teacher";
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
  if(!["list","send","inbox"].includes(operation))return json({error:"Thao tác không hợp lệ."},400);
  const teacherClasses=classes(actor.className);
  if(!teacherClasses.length||!actor.registrationComplete||actor.accessExpired)return json({error:"Tài khoản chưa đủ điều kiện liên lạc."},403);
  const db=await getCourseDatabase();
  const bindClass=teacherClasses.map(()=> "lower(trim(?))").join(",");
  if(operation==="inbox"){
   if(role!=="teacher")return json({error:"Chỉ Giảng viên xem được danh sách tin đến."},403);
   const result=await db.prepare(`SELECT e.id,e.device_id,e.event_type,e.detail_json,e.created_at,
      d.learner_name,d.person_code,d.class_name
      FROM course_activity_events e JOIN device_access d ON d.device_id=e.device_id
      WHERE d.person_role='learner' AND d.status='approved'
        AND lower(trim(d.class_name)) IN (${bindClass})
        AND e.event_type IN ('learner_chat','learner_support_request')
      ORDER BY e.id DESC LIMIT 100`).bind(...teacherClasses).all<MessageRow&{learner_name:string|null;person_code:string|null;class_name:string|null}>();
   const recent=(result.results??[]).map(row=>({
    ...parse(row),learnerPersonCode:row.person_code||"",learnerName:row.learner_name||"Học viên",className:row.class_name||""
   }));
   return json({recent});
  }
  let learnerId=actor.deviceId;
  if(role==="teacher"){
   const learnerCode=clean(payload.learnerPersonCode,80);
   if(!learnerCode)return json({error:"Hãy chọn học viên thuộc lớp phụ trách."},400);
   const target=await db.prepare(`SELECT device_id FROM device_access
      WHERE person_role='learner' AND status='approved' AND person_code=?
       AND lower(trim(class_name)) IN (${bindClass}) LIMIT 1`)
      .bind(learnerCode,...teacherClasses).first<{device_id:string}>();
   if(!target)return json({error:"Không tìm thấy học viên trong lớp được phân công."},404);
   learnerId=target.device_id;
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
  return json({ok:true,id:Number(write.meta?.last_row_id)||null},201);
 }catch(error){
  if(error instanceof DeviceAccessError)return json({error:error.message,code:error.code,device:error.device},error.status);
  return json({error:"Không thể xử lý kênh liên lạc. Vui lòng thử lại."},500);
 }
}
