import {
  DeviceAccessError,
  getCourseDatabase,
  verifyDeviceRequest,
} from "../../../device-auth.server";

export const dynamic = "force-dynamic";

type RosterRow = {
  device_id: string;
  display_code: string;
  status: "pending" | "approved" | "blocked";
  learner_name: string | null;
  person_code: string | null;
  class_name: string | null;
  phone: string | null;
  registration_submitted_at: string | null;
  created_at: string;
  approved_at: string | null;
  blocked_at: string | null;
  last_seen_at: string;
};

function response(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
    },
  });
}

function teacherClassNames(value: string | null) {
  const classes = String(value ?? "")
    .split(/[;\n,]+/)
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  return [...new Map(classes.map((item) => [item.toLocaleLowerCase("vi"), item])).values()].slice(0, 12);
}

function normalizeTarget(value: unknown) {
  const target = typeof value === "string"
    ? value.trim().replace(/\s+/g, "").toUpperCase().slice(0, 32)
    : "";
  if (!/^[A-Z0-9][A-Z0-9./_-]{2,31}$/.test(target)) {
    throw new DeviceAccessError("Mã học viên không hợp lệ.", 400, "INVALID_LEARNER_CODE");
  }
  return target;
}

function rosterItem(row: RosterRow) {
  return {
    name: row.learner_name?.trim() || "Học viên",
    personCode: row.person_code?.trim() || "",
    className: row.class_name?.trim() || "",
    status: row.status,
    registrationComplete: Boolean(
      row.learner_name?.trim()
      && row.person_code?.trim()
      && row.class_name?.trim()
      && row.phone?.trim()
      && row.registration_submitted_at,
    ),
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    blockedAt: row.blocked_at,
    lastSeenAt: row.last_seen_at,
  };
}

async function listRoster(classNames: string[]) {
  const database = await getCourseDatabase();
  const classPlaceholders = classNames.map(() => "lower(trim(?))").join(", ");
  const result = await database.prepare(
    `SELECT device_id, display_code, status, learner_name, person_code, class_name, phone,
            registration_submitted_at, created_at, approved_at, blocked_at, last_seen_at
       FROM device_access
      WHERE person_role = 'learner'
        AND lower(trim(class_name)) IN (${classPlaceholders})
      ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
               datetime(COALESCE(registration_submitted_at, created_at)) DESC,
               learner_name COLLATE NOCASE ASC
      LIMIT 250`,
  ).bind(...classNames).all<RosterRow>();
  const roster = (result.results ?? []).map(rosterItem);
  return {
    roster,
    counts: {
      pending: roster.filter((item) => item.status === "pending").length,
      approved: roster.filter((item) => item.status === "approved").length,
      blocked: roster.filter((item) => item.status === "blocked").length,
    },
    syncedAt: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const hostname = new URL(request.url).hostname;
    const previewRequest = hostname === "terminal.local" || hostname === "localhost";
    const teacher = await verifyDeviceRequest(payload, previewRequest);

    if (teacher.personRole !== "teacher") {
      throw new DeviceAccessError(
        "Chỉ Giảng viên được quản lý danh sách học viên của lớp phụ trách.",
        403,
        "TEACHER_ROLE_REQUIRED",
        teacher,
      );
    }
    const teacherClasses = teacherClassNames(teacher.className);
    if (!teacherClasses.length) {
      throw new DeviceAccessError(
        "Hồ sơ Giảng viên chưa có lớp / đơn vị phụ trách.",
        400,
        "TEACHER_CLASS_REQUIRED",
        teacher,
      );
    }
    const classPlaceholders = teacherClasses.map(() => "lower(trim(?))").join(", ");

    const action = typeof payload.action === "string" ? payload.action : "list";
    if (action === "list") {
      return response(await listRoster(teacherClasses));
    }
    if (action !== "approve" && action !== "remove") {
      throw new DeviceAccessError("Thao tác quản lý học viên không hợp lệ.", 400, "INVALID_TEACHER_ROSTER_ACTION");
    }

    const personCode = normalizeTarget(payload.personCode);
    const database = await getCourseDatabase();
    const target = await database.prepare(
      `SELECT device_id, display_code, status, learner_name, person_code, class_name, phone,
              registration_submitted_at, created_at, approved_at, blocked_at, last_seen_at
         FROM device_access
        WHERE person_role = 'learner'
          AND person_code = ?
          AND lower(trim(class_name)) IN (${classPlaceholders})
        LIMIT 1`,
    ).bind(personCode, ...teacherClasses).first<RosterRow>();

    if (!target) {
      throw new DeviceAccessError(
        "Không tìm thấy học viên trong lớp / đơn vị Giảng viên đang phụ trách.",
        404,
        "LEARNER_NOT_IN_TEACHER_CLASS",
      );
    }

    const alreadyInRequestedState =
      (action === "approve" && target.status === "approved")
      || (action === "remove" && target.status === "blocked");
    if (alreadyInRequestedState) {
      return response(await listRoster(teacherClasses));
    }

    if (action === "approve") {
      if (!target.learner_name?.trim() || !target.person_code?.trim() || !target.class_name?.trim()
        || !target.phone?.trim() || !target.registration_submitted_at) {
        throw new DeviceAccessError(
          "Học viên chưa hoàn tất hồ sơ đăng ký nên chưa thể phê duyệt.",
          409,
          "LEARNER_REGISTRATION_INCOMPLETE",
        );
      }
      await database.batch([
        database.prepare(
          `UPDATE device_access
              SET status = 'approved',
                  access_group = CASE WHEN payment_status = 'paid_verified' THEN 'paid' ELSE 'free' END,
                  payment_status = CASE WHEN payment_status = 'paid_verified' THEN payment_status ELSE 'free_approved' END,
                  approved_at = CURRENT_TIMESTAMP,
                  blocked_at = NULL,
                  updated_at = CURRENT_TIMESTAMP
            WHERE device_id = ?`,
        ).bind(target.device_id),
        database.prepare(
          `INSERT INTO device_profiles (device_id, completed_json, scores_json)
           VALUES (?, '[]', '{}')
           ON CONFLICT(device_id) DO NOTHING`,
        ).bind(target.device_id),
      ]);
    } else {
      await database.prepare(
        `UPDATE device_access
            SET status = 'blocked',
                blocked_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
          WHERE device_id = ?`,
      ).bind(target.device_id).run();
    }

    await database.prepare(
      `INSERT INTO course_audit_log (actor, action, target, detail_json)
       VALUES (?, ?, ?, ?)`,
    ).bind(
      teacher.personCode || teacher.deviceCode,
      action === "approve" ? "teacher_roster_approved" : "teacher_roster_removed",
      target.person_code || target.device_id,
      JSON.stringify({
        className: target.class_name || teacherClasses[0],
        learnerName: target.learner_name?.slice(0, 120) || "Học viên",
        reversible: true,
      }),
    ).run();

    return response({
      ...(await listRoster(teacherClasses)),
      changed: {
        action,
        personCode,
        name: target.learner_name?.trim() || "Học viên",
      },
    });
  } catch (error) {
    if (error instanceof DeviceAccessError) {
      return response({ error: error.message, code: error.code, device: error.device }, error.status);
    }
    return response({ error: "Không thể đồng bộ danh sách học viên lúc này." }, 500);
  }
}
