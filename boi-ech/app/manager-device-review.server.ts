import { DeviceAccessError, getCourseDatabase, type PublicDeviceState } from "./device-auth.server";
import { requireManager } from "./training-management.server";

export const MANAGER_DEFAULT_LEARNER_LIMIT = 50;
export const MANAGER_DEFAULT_TEACHER_LIMIT = 5;

type ApprovalRole = "learner" | "teacher";
type ReviewRow = {
  device_id: string; display_code: string; person_role: ApprovalRole;
  learner_name: string | null; person_code: string | null;
  class_name: string | null; status: "pending" | "approved" | "blocked";
  registration_submitted_at: string | null; manager_device_id: string | null;
};
type LimitRow = { learner_limit: number; teacher_limit: number };
type UsageRow = { person_role: ApprovalRole; used: number };

export async function managerReviewBoard(actor: PublicDeviceState) {
  requireManager(actor);
  const db = await getCourseDatabase();
  const [limits, usage, queued] = await Promise.all([
    db.prepare("SELECT learner_limit, teacher_limit FROM manager_approval_limits WHERE manager_device_id=?")
      .bind(actor.deviceId).first<LimitRow>(),
    db.prepare(`SELECT person_role, COUNT(*) AS used FROM manager_device_assignments
      WHERE manager_device_id=? GROUP BY person_role`).bind(actor.deviceId).all<UsageRow>(),
    db.prepare(`SELECT d.device_id,d.display_code,d.person_role,d.learner_name,d.person_code,
      d.class_name,d.status,d.registration_submitted_at,a.manager_device_id
      FROM device_access d LEFT JOIN manager_device_assignments a ON a.target_device_id=d.device_id
      WHERE (d.status='pending' AND d.person_role IN ('learner','teacher')
        AND d.payment_status='unassigned' AND a.target_device_id IS NULL
        AND d.registration_submitted_at IS NOT NULL)
        OR a.manager_device_id=?
      ORDER BY CASE WHEN d.status='pending' THEN 0 ELSE 1 END,d.created_at DESC LIMIT 201`)
      .bind(actor.deviceId).all<ReviewRow>(),
  ]);
  if ((queued.results?.length ?? 0)>200) {
    throw new DeviceAccessError("Có quá nhiều hồ sơ. Hãy thu hẹp hàng chờ trước khi quản lý.",413,"MANAGER_QUEUE_LIMIT");
  }
  const used = Object.fromEntries((usage.results ?? []).map(row=>[row.person_role,Number(row.used)]));
  const quotas = {
    learner: {limit: limits?.learner_limit ?? MANAGER_DEFAULT_LEARNER_LIMIT, used: used.learner ?? 0},
    teacher: {limit: limits?.teacher_limit ?? MANAGER_DEFAULT_TEACHER_LIMIT, used: used.teacher ?? 0},
  };
  return {
    managerDeviceId:actor.deviceId,
    quotas,
    devices:(queued.results ?? []).map(row=>({
      deviceId:row.device_id,deviceCode:row.display_code,role:row.person_role,
      name:row.learner_name ?? "",personCode:row.person_code ?? "",
      className:row.class_name ?? "",status:row.status,
      assignedToMe:row.manager_device_id===actor.deviceId,
      registrationComplete:Boolean(row.registration_submitted_at),
    })),
  };
}

export async function managerReviewCommand(actor: PublicDeviceState, payload: Record<string,unknown>) {
  requireManager(actor);
  const action = payload.action;
  const deviceId = payload.targetDeviceId;
  if ((action!=="approve" && action!=="block") || typeof deviceId!=="string"
    || !/^[a-f0-9]{64}$/.test(deviceId) || deviceId===actor.deviceId) {
    throw new DeviceAccessError("Thao tác hoặc thiết bị chưa hợp lệ.",400,"MANAGER_REVIEW_INVALID");
  }
  const db=await getCourseDatabase();
  const target=await db.prepare(`SELECT d.status,d.person_role,d.payment_status,d.registration_submitted_at,
      a.manager_device_id FROM device_access d LEFT JOIN manager_device_assignments a
      ON a.target_device_id=d.device_id WHERE d.device_id=?`)
    .bind(deviceId).first<{status:string;person_role:string;payment_status:string;
      registration_submitted_at:string|null;manager_device_id:string|null}>();
  if (!target || !["learner","teacher"].includes(target.person_role)) {
    throw new DeviceAccessError("Chỉ cán bộ quản lý được xét duyệt thiết bị học viên và giảng viên.",403,"MANAGER_TARGET_ROLE_FORBIDDEN");
  }
  if (action==="block") {
    if (target.manager_device_id!==actor.deviceId || target.status!=="approved")
      throw new DeviceAccessError("Chỉ có thể khóa thiết bị đang được chính bạn quản lý.",403,"MANAGER_SCOPE_FORBIDDEN");
    const update=await db.prepare(`UPDATE device_access SET status='blocked',
        blocked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
      WHERE device_id=? AND status='approved' AND person_role IN ('learner','teacher')
        AND EXISTS(SELECT 1 FROM manager_device_assignments
          WHERE target_device_id=? AND manager_device_id=?)`)
      .bind(deviceId,deviceId,actor.deviceId).run();
    if (Number(update.meta.changes)!==1) throw new DeviceAccessError("Thiết bị vừa thay đổi; đồng bộ lại.",409,"MANAGER_REVIEW_CONFLICT");
  } else {
    if(target.status!=="pending" || target.payment_status!=="unassigned"
      || !target.registration_submitted_at || target.manager_device_id) {
      throw new DeviceAccessError("Thiết bị không còn chờ duyệt hoặc đang thuộc cán bộ khác.",409,"MANAGER_REVIEW_CONFLICT");
    }
    // D1 batch is one transaction. The migration trigger validates active
    // manager grant, complete target, unique assignment and quota at INSERT.
    const results=await db.batch([
      db.prepare(`INSERT INTO manager_device_assignments(target_device_id,manager_device_id,person_role)
        VALUES(?,?,?)`).bind(deviceId,actor.deviceId,target.person_role),
      db.prepare(`UPDATE device_access SET status='approved',access_group='free',
          payment_status='free_approved',approved_at=CURRENT_TIMESTAMP,
          blocked_at=NULL,updated_at=CURRENT_TIMESTAMP
        WHERE device_id=? AND status='pending' AND payment_status='unassigned'
          AND person_role=? AND registration_submitted_at IS NOT NULL
          AND EXISTS(SELECT 1 FROM manager_device_assignments
            WHERE target_device_id=? AND manager_device_id=?)`)
        .bind(deviceId,target.person_role,deviceId,actor.deviceId),
    ]);
    if (Number(results[0].meta.changes)!==1 || Number(results[1].meta.changes)!==1)
      throw new DeviceAccessError("Xung đột khi cấp quyền, không xác minh được cập nhật.",409,"MANAGER_REVIEW_CONFLICT");
  }
  await db.prepare(`INSERT INTO course_audit_log(actor,action,target,detail_json)
    VALUES(?,?,?,?)`).bind(actor.deviceCode,action==="approve"?"manager_device_approved":"manager_device_blocked",
    deviceId,JSON.stringify({managerDeviceId:actor.deviceId,role:target.person_role})).run();
  // Separate readback. Do not mark applied on mutation response alone.
  const current=await db.prepare(`SELECT d.status,a.manager_device_id FROM device_access d
    JOIN manager_device_assignments a ON a.target_device_id=d.device_id WHERE d.device_id=?`)
    .bind(deviceId).first<{status:string;manager_device_id:string}>();
  if (current?.manager_device_id!==actor.deviceId ||
      current.status!==(action==="approve"?"approved":"blocked"))
    throw new DeviceAccessError("Đã gửi lệnh nhưng đọc lại không khớp. Đồng bộ trước khi thử lại.",503,"MANAGER_REVIEW_READBACK_MISMATCH");
  return managerReviewBoard(actor);
}
