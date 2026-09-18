import {
  DeviceAccessError,
  getCourseDatabase,
  verifyDeviceRequest,
} from "../../../../device-auth.server";

export const dynamic = "force-dynamic";

const TEACHER_ACTIONS = new Set(["teacher_feedback", "teacher_assignment", "teacher_analysis_review"]);

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

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const hostname = new URL(request.url).hostname;
    const previewRequest = hostname === "terminal.local" || hostname === "localhost";
    const learner = await verifyDeviceRequest(payload, previewRequest);
    if (learner.personRole !== "learner") {
      throw new DeviceAccessError(
        "Chỉ Học viên được phản hồi hướng dẫn gửi tới tài khoản của mình.",
        403,
        "LEARNER_ROLE_REQUIRED",
        learner,
      );
    }

    const actionId = Number(payload.actionId);
    const message = cleanText(payload.message, 1000);
    const clientEventId = normalizeClientEventId(payload.clientEventId);
    if (!Number.isInteger(actionId) || actionId <= 0) return json({ error: "Hướng dẫn cần phản hồi không hợp lệ." }, 400);
    if (!message) return json({ error: "Nội dung phản hồi không được để trống." }, 400);

    const database = await getCourseDatabase();
    const original = await database.prepare(
      `SELECT id, event_type, lesson_number, detail_json, created_at
         FROM course_activity_events
        WHERE id = ? AND device_id = ?
        LIMIT 1`,
    ).bind(actionId, learner.deviceId).first<{
      id: number;
      event_type: string;
      lesson_number: string | null;
      detail_json: string;
      created_at: string;
    }>();

    if (!original || !TEACHER_ACTIONS.has(original.event_type)) {
      return json({ error: "Không tìm thấy hướng dẫn Giảng viên thuộc tài khoản này." }, 404);
    }

    const replyCount = await database.prepare(
      `SELECT COUNT(*) AS count
         FROM course_activity_events
        WHERE device_id = ?
          AND event_type = 'learner_teacher_reply'
          AND CAST(json_extract(detail_json, '$.actionId') AS INTEGER) = ?`,
    ).bind(learner.deviceId, actionId).first<{ count: number }>();

    if ((Number(replyCount?.count) || 0) >= 5) {
      return json({ error: "Mỗi hướng dẫn tối đa 5 phản hồi. Hãy chờ Giảng viên gửi hướng dẫn mới." }, 409);
    }

    if (clientEventId) {
      const duplicate = await database.prepare(
        "SELECT id FROM course_activity_events WHERE device_id = ? AND client_event_id = ? LIMIT 1",
      ).bind(learner.deviceId, clientEventId).first<{ id: number }>();
      if (duplicate) return json({ ok: true, duplicate: true, id: duplicate.id });
    }

    const detail = {
      source: "learner-teacher-inbox",
      actionId,
      teacherActionType: original.event_type,
      message,
      learnerName: learner.learnerName?.slice(0, 120) || "Học viên",
      className: learner.className?.slice(0, 120) || "",
      lessonNumber: original.lesson_number || "",
      actionCreatedAt: original.created_at,
    };

    const result = await database.prepare(
      `INSERT INTO course_activity_events
        (device_id, event_type, lesson_number, part, detail_json, client_event_id)
       VALUES (?, 'learner_teacher_reply', ?, 'learner-reply', ?, ?)`,
    ).bind(
      learner.deviceId,
      original.lesson_number,
      JSON.stringify(detail),
      clientEventId,
    ).run();

    await database.prepare(
      `INSERT INTO course_audit_log (actor, action, target, detail_json)
       VALUES (?, 'learner_teacher_reply', ?, ?)`,
    ).bind(
      learner.personCode || learner.deviceCode,
      String(actionId),
      JSON.stringify({
        className: learner.className || "",
        learnerName: learner.learnerName?.slice(0, 120) || "Học viên",
        messageLength: message.length,
      }),
    ).run();

    return json({
      ok: true,
      id: Number(result.meta?.last_row_id) || null,
      actionId,
      message,
    }, 201);
  } catch (error) {
    if (error instanceof DeviceAccessError) {
      return json({ error: error.message, code: error.code, device: error.device }, error.status);
    }
    return json({ error: "Không thể gửi phản hồi tới Giảng viên." }, 500);
  }
}
