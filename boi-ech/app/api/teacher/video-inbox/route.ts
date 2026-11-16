import { DeviceAccessError,getCourseDatabase,verifyDeviceRequest } from "../../../device-auth.server";
import {syncTeacherVideoInbox,readTeacherVideoInbox,markTeacherVideoSeen} from "../../../teacher-video-inbox.server";

export const dynamic="force-dynamic";
function respond(data:unknown,status=200){
 return Response.json(data,{status,headers:{"cache-control":"no-store, private","x-content-type-options":"nosniff"}});
}
function teacherClassNames(value:string|null){
 return [...new Map(String(value??"").split(/[;\n,]+/).map(name=>name.trim().replace(/\s+/g," "))
  .filter(Boolean).map(name=>[name.toLocaleLowerCase("vi"),name])).values()].slice(0,12);
}
/**
 * A separately signed teacher endpoint. No bulk exposure and no unchecked
 * client-supplied role/class name. Each read/write rechecks the actual
 * learner's current class; no video bytes or score payload crosses this API.
 */
export async function POST(request:Request){
 try{
  // Content-Length is optional/untrusted. Reject the ACTUAL body size before
  // parsing an attacker-controlled signed payload.
  const raw=await request.text();
  if(raw.length>8192)return respond({error:"Yêu cầu vượt giới hạn."},413);
  const payload=JSON.parse(raw) as Record<string,unknown>;
  if(!payload||typeof payload!=="object"||Array.isArray(payload))
   return respond({error:"Dữ liệu yêu cầu không hợp lệ."},400);
  const hostname=new URL(request.url).hostname;
  const previewRequest=hostname==="terminal.local"||hostname==="localhost";
  const teacher=await verifyDeviceRequest(payload,previewRequest);
  if(teacher.personRole!=="teacher")
   throw new DeviceAccessError("Chỉ Giảng viên được xem và xử lý hàng chờ video.",403,"TEACHER_ROLE_REQUIRED",teacher);
  const classes=teacherClassNames(teacher.className);
  if(!classes.length)
   throw new DeviceAccessError("Giảng viên chưa có lớp phụ trách.",403,"TEACHER_CLASS_REQUIRED",teacher);
  const action=payload.action;
  if(action!=="list"&&action!=="seen")return respond({error:"Thao tác không hợp lệ."},400);
  const db=await getCourseDatabase();
  // Reconcile if a teacher was newly assigned to a class after the video was
  // submitted. INSERT OR IGNORE preserves previously acknowledged states.
  await syncTeacherVideoInbox(db,teacher.deviceId,classes).run();
  if(action==="list"){
   const result=await readTeacherVideoInbox(db,teacher.deviceId,classes);
   return respond({...result,unreadCount:result.items.filter(item=>item.state==="unread").length,
    limitations:"Chỉ tải tối đa 80 lượt video hợp lệ trong lớp hiện tại. Đây là polling khi truy cập, không phải push."});
  }
  const eventId=payload.eventId,expectedRevision=payload.expectedRevision;
  if(typeof eventId!=="number"||!Number.isSafeInteger(eventId)||eventId<1||
   typeof expectedRevision!=="number"||!Number.isSafeInteger(expectedRevision)||expectedRevision<1)
   return respond({error:"Mã sự kiện hoặc phiên bản không hợp lệ."},400);
  const outcome=await markTeacherVideoSeen({
   db,teacherDeviceId:teacher.deviceId,teacherClasses:classes,eventId,expectedRevision,
  });
  return outcome.ok?respond(outcome):respond(outcome,409);
 }catch(error){
  if(error instanceof DeviceAccessError)
   return respond({error:error.message,code:error.code},error.status);
  if(error instanceof SyntaxError)return respond({error:"JSON không hợp lệ."},400);
  return respond({error:"Không đồng bộ được hàng chờ video; không tự đánh dấu đã xem."},503);
 }
}
