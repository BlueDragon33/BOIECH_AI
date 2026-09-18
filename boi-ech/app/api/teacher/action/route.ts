import {
  DeviceAccessError,
  getCourseDatabase,
  verifyDeviceRequest,
} from "../../../device-auth.server";

export const dynamic = "force-dynamic";

const LESSONS = new Set(["01", "02", "03", "04", "05", "06", "07", "08"]);
const ACTION_TYPES = {
  feedback: "teacher_feedback",
  assignment: "teacher_assignment",
  review: "teacher_analysis_review",
} as const;

type TeacherAction = keyof typeof ACTION_TYPES;

type LearnerTarget = {
  device_id: string;
  learner_name: string | null;
  person_code: string | null;
  class_name: string | null;
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
    },
  });
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function normalizeClientEventId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9:_-]{8,100}$/.test(value) ? value : null;
}

function normalizeAction(value: unknown): TeacherAction | null {
  return value === "feedback" || value === "assignment" || value === "review" ? value : null;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const hostname = new URL(request.url).hostname;
    const previewRequest = hostname === "terminal.local" || hostname === "localhost";
    const teacher = await verifyDeviceRequest(payload, previewRequest);

    if (teacher.personRole !== "teacher") {
      throw new DeviceAccessError(
        "Chỉ Giảng viên được ghi nhận can thiệp chuyên môn.",
        403,
        "TEACHER_ROLE_REQUIRED",
        teacher,
      );
    }
    if (!teacher.className) {
      throw new DeviceAccessError(
        "Hồ sơ Giảng viên chưa có lớp / đơn vị phụ trách.",
        400,
        "TEACHER_CLASS_REQUIRED",
        teacher,
      );
    }

    const action = normalizeAction(payload.action);
    if (!action) return json({ error: "Thao tác Giảng viên không hợp lệ." }, 400);

    const learnerPersonCode = cleanText(payload.learnerPersonCode, 80);
    if (!learnerPersonCode) return json({ error: "Thiếu mã học viên đích." }, 400);

    const database = await getCourseDatabase();
    const learner = await database.prepare(
      `SELECT device_id, learner_name, person_code, class_name
         FROM device_access
        WHERE person_role = 'learner'
          AND status = 'approved'
          AND person_code = ?
          AND lower(trim(class_name)) = lower(trim(?))
        LIMIT 1`,
    ).bind(learnerPersonCode, teacher.className).first<LearnerTarget>();

    if (!learner) {
      return json({ error: "Học viên không thuộc lớp / đơn vị Giảng viên đang phụ trách." }, 404);
    }

    const note = cleanText(payload.note, 1200);
    const title = cleanText(payload.title, 160);
    const lessonNumber = cleanText(payload.lessonNumber, 2);
    const analysisAt = cleanText(payload.analysisAt, 80);
    const reviewStatus = payload.reviewStatus === "follow-up" ? "follow-up" : "reviewed";
    const clientEventId = normalizeClientEventId(payload.clientEventId);

    if (action === "feedback" && !note) {
      return json({ error: "Nhận xét chuyên môn không được để trống." }, 400);
    }
    if (action === "assignment" && (!LESSONS.has(lessonNumber) || !note)) {
      return json({ error: "Bài giao cần chọn Bài 01–08 và có hướng dẫn luyện tập." }, 400);
    }
    if (action === "review" && !analysisAt) {
      return json({ error: "Không xác định được lần phân tích cần review." }, 400);
    }

    if (clientEventId) {
      const duplicate = await database.prepare(
        "SELECT id FROM course_activity_events WHERE device_id = ? AND client_event_id = ? LIMIT 1",
      ).bind(learner.device_id, clientEventId).first<{ id: number }>();
      if (duplicate) return json({ ok: true, duplicate: true, id: duplicate.id });
    }

    const eventType = ACTION_TYPES[action];
    const detail = {
      source: "teacher-dashboard",
      teacherName: teacher.learnerName?.slice(0, 120) || "Giảng viên",
      teacherClassName: teacher.className,
      action,
      note,
      ...(title ? { title } : {}),
      ...(lessonNumber ? { lessonNumber } : {}),
      ...(analysisAt ? { analysisAt } : {}),
      ...(action === "review" ? { reviewStatus } : {}),
    };

    const result = await database.prepare(
      `INSERT INTO course_activity_events
        (device_id, event_type, lesson_number, part, detail_json, client_event_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      learner.device_id,
      eventType,
      lessonNumber || null,
      action === "assignment" ? "teacher-assignment" : action === "feedback" ? "teacher-feedback" : "teacher-review",
      JSON.stringify(detail),
      clientEventId,
    ).run();

    await database.prepare(
      `INSERT INTO course_audit_log (actor, action, target, detail_json)
       VALUES (?, ?, ?, ?)`,
    ).bind(
      teacher.personCode || teacher.deviceCode,
      eventType,
      learner.person_code || learner.device_id,
      JSON.stringify({
        className: teacher.className,
        learnerName: learner.learner_name?.slice(0, 120) || "Học viên",
        lessonNumber: lessonNumber || null,
        reviewStatus: action === "review" ? reviewStatus : null,
      }),
    ).run();

    return json({
      ok: true,
      id: Number(result.meta?.last_row_id) || null,
      action,
      learner: {
        name: learner.learner_name?.trim() || "Học viên",
        personCode: learner.person_code || "",
        className: learner.class_name || teacher.className,
      },
      saved: {
        note,
        title,
        lessonNumber: lessonNumber || null,
        reviewStatus: action === "review" ? reviewStatus : null,
        analysisAt: analysisAt || null,
      },
    });
  } catch (error) {
    if (error instanceof DeviceAccessError) {
      return json({ error: error.message, code: error.code, device: error.device }, error.status);
    }
    return json({ error: "Không thể lưu thao tác chuyên môn của Giảng viên." }, 500);
  }
}
