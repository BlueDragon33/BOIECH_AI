import type { D1PreparedStatement } from "@cloudflare/workers-types";
import { DeviceAccessError, getCourseDatabase, type PublicDeviceState } from "./device-auth.server";
import { TRAINING_SCHEMA } from "./training-schema";
import { classKey, classNames, type TrainingBoard, type TrainingPerson, type TrainingResource, type TrainingSession } from "./training-types";
let schemaReady:Promise<unknown>|undefined;
export async function trainingDatabase() {
 const db=await getCourseDatabase();
 schemaReady??=db.batch(TRAINING_SCHEMA.map(sql=>db.prepare(sql))).catch(error=>{schemaReady=undefined;throw error;});
 await schemaReady;return db;
}
function fail(message:string,code="INVALID_TRAINING_INPUT",status=400):never { throw new DeviceAccessError(message,status,code); }
function text(v:unknown,max=80) { if(typeof v!=="string"||!v.trim()||v.trim().length>max||/[\x00-\x1f]/.test(v))fail("Thông tin bắt buộc chưa đúng định dạng.");return v.trim().normalize("NFC"); }
function id(v:unknown) { const s=text(v);if(!/^[A-Za-z0-9_-]{3,80}$/.test(s))fail("Mã dữ liệu không hợp lệ.");return s; }
function integer(v:unknown,min:number,max:number) { if(typeof v!=="number"||!Number.isInteger(v)||v<min||v>max)fail("Số lượng hoặc phiên bản không hợp lệ.");return v; }
function instant(v:unknown) { const s=text(v,40);if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(s)||!Number.isFinite(Date.parse(s)))fail("Thời gian phải có múi giờ rõ ràng.");const datePart=s.slice(0,10);const time=s.slice(11,19).split(":").map(Number);
 if(new Date(datePart+"T00:00:00Z").toISOString().slice(0,10)!==datePart || time[0]>23 || time[1]>59 || (time.length>2&&time[2]>59))fail("Ngày hoặc giờ không tồn tại.");
 return new Date(s).toISOString(); }
export function trainingWindow(payload:Record<string,unknown>) { const from=instant(payload.from),to=instant(payload.to);if(from>=to||Date.parse(to)-Date.parse(from)>31*86400000)fail("Chọn khoảng thời gian hợp lệ, tối đa 31 ngày.");return {from,to}; }
export function requireManager(actor:PublicDeviceState) { if(actor.personRole!=="manager"||!actor.managementEnabled)fail("Cán bộ quản lý cần được Owner cấp quyền điều phối. Quyền truy cập học tập không tự cấp quyền này.","MANAGEMENT_PERMISSION_REQUIRED",403); }
const AUTH_GUARD=`EXISTS(SELECT 1 FROM device_access a WHERE a.device_id=? AND a.person_role='manager' AND a.management_enabled=1 AND a.status='approved' AND a.registration_submitted_at IS NOT NULL AND (a.access_expires_at IS NULL OR datetime(a.access_expires_at)>CURRENT_TIMESTAMP))`;
export async function trainingBoard(from:string,to:string):Promise<TrainingBoard> {
 const db=await trainingDatabase();
 const [rs,ps,ss]=await Promise.all([
 db.prepare('SELECT id,kind,name,parent_id AS parentId,capacity,required_teachers AS requiredTeachers,status,version FROM training_resources ORDER BY name LIMIT 1001').all<TrainingResource>(),
 db.prepare(`SELECT device_id AS id,learner_name AS name,person_code AS code,person_role AS role,COALESCE(class_name,'') AS className,status,
 CASE WHEN access_expires_at IS NOT NULL AND datetime(access_expires_at)<=CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS expired,
 CASE WHEN registration_submitted_at IS NOT NULL THEN 1 ELSE 0 END AS registered FROM device_access WHERE person_role IN ('learner','teacher') ORDER BY learner_name LIMIT 1001`).all<TrainingPerson>(),
 db.prepare(`SELECT id,title,class_id AS classId,room_id AS roomId,teacher_id AS teacherId,starts_at AS startsAt,ends_at AS endsAt,status,version FROM training_sessions WHERE starts_at<? AND ends_at>? ORDER BY starts_at LIMIT 1001`).bind(to,from).all<TrainingSession>(),
 ]);
 if([rs,ps,ss].some(r=>(r.results?.length??0)>1000))fail("Khoảng xem có hơn 1.000 bản ghi. Thu hẹp thời gian hoặc liên hệ quản trị; chưa thể hiển thị tổng số đầy đủ.","TRAINING_RESULT_LIMIT",413);
 const sourceResources=rs.results??[];
 const byId=new Map(sourceResources.map(resource=>[resource.id,resource]));
 const sessions=ss.results??[];
 const teacherBookings=new Map<string,number>(),classBookings=new Map<string,number>(),roomBookings=new Map<string,number>();
 const classNameBookings=new Map<string,number>();
 function increment(map:Map<string,number>,key:string){map.set(key,(map.get(key)??0)+1);}
 for(const session of sessions){
  if(session.status==="cancelled")continue;
  increment(teacherBookings,session.teacherId);increment(classBookings,session.classId);increment(roomBookings,session.roomId);
  const resource=byId.get(session.classId);if(resource)increment(classNameBookings,classKey(resource.name));
 }
 const people=(ps.results??[]).map(p=>({...p,name:p.name||p.code,expired:Boolean(p.expired),registered:Boolean(p.registered),bookingCount:p.role==="teacher"?(teacherBookings.get(p.id)??0):(classNameBookings.get(classKey(p.className))??0)}));
 const active=(p:TrainingPerson)=>p.status==="approved"&&!p.expired&&p.registered;
 const learnersByClass=new Map<string,number>(),teachersByClass=new Map<string,number>();
 for(const person of people){
  if(!active(person))continue;
  if(person.role==="learner")increment(learnersByClass,classKey(person.className));
  else for(const name of new Set(classNames(person.className).map(classKey)))increment(teachersByClass,name);
 }
 const resources=sourceResources.map(r=>{
 const learnerCount=r.kind==="class"?(learnersByClass.get(classKey(r.name))??0):0;
 const teacherCount=r.kind==="class"?(teachersByClass.get(classKey(r.name))??0):0;
 const bookingCount=(r.kind==="room"?roomBookings:classBookings).get(r.id)??0;
 const missingTeachers=r.kind==="class"?Math.max(0,r.requiredTeachers-teacherCount):0;
 const parent=r.parentId?byId.get(r.parentId):undefined;
 const inactive=r.status!=="active"||(r.kind==="room"&&parent?.status!=="active");
 const state=inactive?"inactive":r.kind==="class"&&learnerCount>r.capacity?"overloaded":r.kind==="class"&&missingTeachers?"missing":r.kind==="class"?(learnerCount>=r.capacity?"full":"available"):bookingCount>0?"full":"available";
 return {...r,learnerCount:r.kind==="class"?learnerCount:0,teacherCount:r.kind==="class"?teacherCount:0,missingTeachers,bookingCount,remaining:r.kind==="class"?Math.max(0,r.capacity-learnerCount):bookingCount?0:1,state,roomCount:0} as TrainingResource;
 });
 const roomsByBuilding=new Map<string,TrainingResource[]>();
 for(const room of resources){if(room.kind!=="room"||!room.parentId)continue;const rooms=roomsByBuilding.get(room.parentId)??[];rooms.push(room);roomsByBuilding.set(room.parentId,rooms);}
 for(const b of resources.filter(r=>r.kind==="building")){const rooms=roomsByBuilding.get(b.id)??[];b.roomCount=rooms.length;b.remaining=rooms.filter(r=>r.state==="available").length;b.bookingCount=rooms.reduce((n,r)=>n+r.bookingCount,0);if(b.status==="active")b.state=!b.roomCount?"missing":b.remaining?"available":"full";}
 const classes=resources.filter(r=>r.kind==="class");
 const classKeys=new Set(classes.map(resource=>classKey(resource.name)));
 return {resources,people,sessions,from,to,observedAt:new Date().toISOString(),summary:{freeRooms:resources.filter(r=>r.kind==="room"&&r.state==="available").length,occupiedRooms:resources.filter(r=>r.kind==="room"&&r.bookingCount>0).length,missingLearners:classes.filter(r=>r.status==="active").reduce((s,r)=>s+r.remaining,0),missingTeachers:classes.filter(r=>r.status==="active").reduce((s,r)=>s+r.missingTeachers,0),unassignedLearners:people.filter(p=>p.role==="learner"&&active(p)&&!classKeys.has(classKey(p.className))).length,unassignedTeachers:people.filter(p=>p.role==="teacher"&&active(p)&&!classNames(p.className).some(name=>classKeys.has(classKey(name)))).length}};
}
export async function trainingCommand(actor:PublicDeviceState,payload:Record<string,unknown>) {
 requireManager(actor);const db=await trainingDatabase();const commandId=id(payload.commandId);
 const action=payload.action;let command:Record<string,unknown>;let write:D1PreparedStatement;
 if(action==="save-resource") {
  const kind=payload.kind;if(kind!=="class"&&kind!=="room"&&kind!=="building")fail("Loại tài nguyên không hợp lệ.");
  const name=text(payload.name,50);if(/[;,]/.test(name))fail("Tên lớp/phòng không được chứa dấu phẩy hoặc chấm phẩy.");
  const resourceId=id(payload.id),parentId=kind==="room"?id(payload.parentId):null,capacity=integer(payload.capacity,1,5000),requiredTeachers=kind==="class"?integer(payload.requiredTeachers??1,1,12):1;
  const status=payload.status;if(!["active","unavailable","archived"].includes(String(status)))fail("Trạng thái tài nguyên không hợp lệ.");
  const version=integer(payload.expectedVersion,0,1000000);
  command={action,id:resourceId,kind,name,parentId,capacity,requiredTeachers,status,version};
  if(kind==="room"&&!await db.prepare("SELECT id FROM training_resources WHERE id=? AND kind='building' AND status='active'").bind(parentId).first())fail("Hãy chọn tòa học đang hoạt động.","TRAINING_RESOURCE_UNAVAILABLE",409);
  write=version===0?db.prepare(`INSERT INTO training_resources(id,kind,name,parent_id,capacity,required_teachers,status,version) SELECT ?,?,?,?,?,?,?,1 WHERE ${AUTH_GUARD}`).bind(resourceId,kind,name,parentId,capacity,requiredTeachers,status,actor.deviceId)
  :db.prepare(`UPDATE training_resources SET name=?,parent_id=?,capacity=?,required_teachers=?,status=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind=? AND version=? AND ${AUTH_GUARD}`).bind(name,parentId,capacity,requiredTeachers,status,resourceId,kind,version,actor.deviceId);
 } else if(action==="save-session") {
  const sessionId=id(payload.id),title=text(payload.title,100),classId=id(payload.classId),roomId=id(payload.roomId),teacherId=id(payload.teacherId),startsAt=instant(payload.startsAt),endsAt=instant(payload.endsAt);
  const status=payload.status,version=integer(payload.expectedVersion,0,1000000);
  if(startsAt>=endsAt||Date.parse(endsAt)-Date.parse(startsAt)>86400000)fail("Giờ kết thúc phải sau giờ bắt đầu, tối đa 24 giờ.");
  if(!["scheduled","completed","cancelled"].includes(String(status)))fail("Trạng thái buổi học không hợp lệ.");
  if(status==="completed"&&Date.parse(endsAt)>Date.now())fail("Chưa thể hoàn thành buổi học chưa kết thúc.");
  command={action,id:sessionId,title,classId,roomId,teacherId,startsAt,endsAt,status,version};
  write=version===0?db.prepare(`INSERT INTO training_sessions(id,title,class_id,room_id,teacher_id,starts_at,ends_at,status,version) SELECT ?,?,?,?,?,?,?,?,1 WHERE ${AUTH_GUARD}`).bind(sessionId,title,classId,roomId,teacherId,startsAt,endsAt,status,actor.deviceId)
  :db.prepare(`UPDATE training_sessions SET title=?,class_id=?,room_id=?,teacher_id=?,starts_at=?,ends_at=?,status=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=? AND ${AUTH_GUARD}`).bind(title,classId,roomId,teacherId,startsAt,endsAt,status,sessionId,version,actor.deviceId);
 } else if(action==="assign-person") {
  const personId=id(payload.personId),expectedClassName=typeof payload.expectedClassName==="string"?payload.expectedClassName:fail("Thiếu lớp hiện tại để kiểm tra thay đổi đồng thời.");
  const target=await db.prepare("SELECT person_role AS role FROM device_access WHERE device_id=? AND person_role IN ('learner','teacher') AND registration_submitted_at IS NOT NULL").bind(personId).first<{role:string}>();
  if(!target)fail("Không tìm thấy hồ sơ đã đăng ký.","TRAINING_PERSON_NOT_FOUND",404);
  if(!Array.isArray(payload.classIds)||payload.classIds.length>(target.role==="learner"?1:12))fail("Học viên thuộc một lớp; giảng viên tối đa 12 lớp.");
  const ids=[...new Set(payload.classIds.map(id))];const names:string[]=[];
  for(const key of ids){const row=await db.prepare("SELECT name FROM training_resources WHERE id=? AND kind='class' AND status='active'").bind(key).first<{name:string}>();if(!row)fail("Lớp học chưa sẵn sàng.","TRAINING_RESOURCE_UNAVAILABLE",409);names.push(row.name);}
  const className=names.join("; ")||(target.role==="learner"?"Chưa phân lớp":"Chưa phân công");
  command={action,personId,classIds:ids,expectedClassName};
  write=db.prepare(`UPDATE device_access SET class_name=?,updated_at=CURRENT_TIMESTAMP WHERE device_id=? AND COALESCE(class_name,'')=? AND person_role=? AND (?=0 OR (status='approved' AND (access_expires_at IS NULL OR datetime(access_expires_at)>CURRENT_TIMESTAMP))) AND ${AUTH_GUARD}`).bind(className,personId,expectedClassName,target.role,ids.length,actor.deviceId);
 } else fail("Thao tác điều phối không hợp lệ.");
 const canonical=JSON.stringify(command);
 async function receipt(){return db.prepare("SELECT actor_id,payload_json FROM training_commands WHERE command_id=?").bind(commandId).first<{actor_id:string;payload_json:string}>();}
 const existing=await receipt();if(existing){if(existing.actor_id!==actor.deviceId||existing.payload_json!==canonical)fail("Mã thao tác đã dùng cho thay đổi khác.","TRAINING_COMMAND_CONFLICT",409);return;}
 try {
  const result=await db.batch([write,db.prepare("INSERT INTO training_commands(command_id,actor_id,payload_json) SELECT ?,?,? WHERE changes()=1").bind(commandId,actor.deviceId,canonical),db.prepare("INSERT INTO course_audit_log(actor,action,target,detail_json) SELECT ?,'training_management',?,? WHERE changes()=1").bind(actor.deviceCode,commandId,canonical)]);
  if(Number(result[0].meta.changes)!==1)fail("Dữ liệu hoặc quyền điều phối đã thay đổi. Đồng bộ rồi kiểm tra lại bản nháp.","TRAINING_VERSION_CONFLICT",409);
 }catch(error){const replay=await receipt();if(replay&&replay.actor_id===actor.deviceId&&replay.payload_json===canonical)return;throw error;}
}
