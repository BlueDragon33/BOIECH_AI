import {
  DeviceAccessError,
  getCourseDatabase,
  verifyDeviceRequest,
} from "../../../../device-auth.server";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["acknowledged", "completed", "needs-help"]);

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
    },
  });
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
        "Chỉ Học viên được cập nhật trạng thái nhiệm vụ của mình.",
        403,
        "LEARNER_ROLE_REQUIRED",
        learner,
      );
    }

    const actionId = Number(payload.actionId);
    const status = typeof payload.status === "string" ? payload.status : "";
    const clientEventId = normalizeClientEventId(payload.clientEventId);
    if (!Number.isInteger(actionId) || actionId <= 0) return json({ error: "Nhiệm vụ không hợp lệ." }, 400);
    if (!STATUSES.has(status)) return json({ error: "Trạng thái nhiệm vụ không hợp lệ." }, 400);

    const database = await getCourseDatabase();
    const assignment = await database.prepare(
      `SELECT id, lesson_number, detail_json, created_at
         FROM course_activity_events
        WHERE id = ?
          AND device_id = ?
          AND event_type = 'teacher_assignment'
        LIMIT 1`,
    ).bind(actionId, learner.deviceId).first<{
      id: number;
      lesson_number: string | null;
      detail_json: string;
      created_at: string;
    }>();

    if (!assignment) return json({ error: "Không tìm thấy bài luyện thuộc tài khoản này." }, 404);

    if (clientEventId) {
      const duplicate = await database.prepare(
        "SELECT id FROM course_activity_events WHERE device_id = ? AND client_event_id = ? LIMIT 1",
      ).bind(learner.deviceId, clientEventId).first<{ id: number }>();
      if (duplicate) return json({ ok: true, duplicate: true, id: duplicate.id, status });
    }

    const result = await database.prepare(
      `INSERT INTO course_activity_events
        (device_id, event_type, lesson_number, part, detail_json, client_event_id)
       VALUES (?, 'learner_assignment_status', ?, 'assignment-status', ?, ?)`,
    ).bind(
      learner.deviceId,
      assignment.lesson_number,
      JSON.stringify({
        source: "learner-teacher-inbox",
        actionId,
        status,
        learnerName: learner.learnerName?.slice(0, 120) || "Học viên",
        className: learner.className?.slice(0, 120) || "",
        assignmentCreatedAt: assignment.created_at,
      }),
      clientEventId,
    ).run();

    await database.prepare(
      `INSERT INTO course_audit_log (actor, action, target, detail_json)
       VALUES (?, 'learner_assignment_status', ?, ?)`,
    ).bind(
      learner.personCode || learner.deviceCode,
      String(actionId),
      JSON.stringify({ status, className: learner.className || "" }),
    ).run();

    return json({ ok: true, id: Number(result.meta?.last_row_id) || null, actionId, status }, 201);
  } catch (error) {
    if (error instanceof DeviceAccessError) {
      return json({ error: error.message, code: error.code, device: error.device }, error.status);
    }
    return json({ error: "Không thể cập nhật trạng thái bài luyện." }, 500);
  }
}
