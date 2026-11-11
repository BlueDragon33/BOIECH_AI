import {DeviceAccessError,getCourseDatabase,verifyDeviceRequest} from "../../../device-auth.server";

export const dynamic = "force-dynamic";
type RosterRow = {
  device_id:string; status:"approved"; learner_name:string|null; person_code:string|null;
  class_name:string|null; created_at:string; approved_at:string|null; last_seen_at:string;
};
const respond=(data:unknown,status=200)=>Response.json(data,{status,headers:{
  "cache-control":"no-store, private","x-content-type-options":"nosniff"
}});
function teacherClassNames(value:string|null){
  return [...new Map(String(value??"").split(/[;\n,]+/).map(item=>item.trim().replace(/\s+/g," "))
    .filter(Boolean).map(item=>[item.toLocaleLowerCase("vi"),item] as const)).values()].slice(0,12);
}
export async function POST(request:Request){
  try {
    // Never waive the P-256 proof on localhost or other preview hostnames.
    const payload=await request.json() as Record<string,unknown>;
    if(!payload||Array.isArray(payload)||typeof payload!=="object")
      throw new DeviceAccessError("Yêu cầu không hợp lệ.",400,"TEACHER_ROSTER_INPUT");
    if(payload.action!=="list")
      throw new DeviceAccessError("Chỉ Cán bộ quản lý được duyệt hoặc thay đổi quyền tài khoản.",403,"ACCOUNT_REVIEW_MANAGER_REQUIRED");
    const teacher=await verifyDeviceRequest(payload,false);
    if(teacher.personRole!=="teacher")
      throw new DeviceAccessError("Chỉ Giảng viên được xem học viên thuộc lớp phụ trách.",403,"TEACHER_ROLE_REQUIRED");
    const classes=teacherClassNames(teacher.className);
    if(!classes.length)
      throw new DeviceAccessError("Giảng viên chưa được phân công lớp học.",403,"TEACHER_CLASS_REQUIRED");
    const placeholders=classes.map(()=>"?").join(",");
    const database=await getCourseDatabase();
    // A teacher cannot inspect pending/blocked registrations or review queues.
    const result=await database.prepare(`SELECT device_id,status,learner_name,person_code,
          class_name,created_at,approved_at,last_seen_at
        FROM device_access
        WHERE person_role='learner' AND status='approved'
          AND lower(trim(class_name)) IN (${placeholders})
        ORDER BY learner_name COLLATE NOCASE ASC LIMIT 250`)
      .bind(...classes.map(name=>name.toLocaleLowerCase("vi"))).all<RosterRow>();
    const roster=(result.results??[]).map(row=>({
      name:row.learner_name?.trim()||"Học viên",
      // Internal relationship key only; never render as a personal code.
      personCode:row.person_code?.trim()||"",
      className:row.class_name?.trim()||"",
      status:row.status,registrationComplete:true,
      createdAt:row.created_at,approvedAt:row.approved_at,
      blockedAt:null,lastSeenAt:row.last_seen_at
    }));
    return respond({canManage:false,roster,
      counts:{pending:0,approved:roster.length,blocked:0},
      syncedAt:new Date().toISOString()});
  } catch(error){
    if(error instanceof DeviceAccessError)
      return respond({error:error.message,code:error.code},error.status);
    return respond({error:"Không thể đồng bộ danh sách học viên lúc này."},500);
  }
}
