import {
  DeviceAccessError,
  getCourseDatabase,
  verifyDeviceRequest,
} from "../../../device-auth.server";

export const dynamic = "force-dynamic";

type ActionRow = {
  id: number;
  event_type: string;
  lesson_number: string | null;
  detail_json: string;
  created_at: string;
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

function parseDetail(value: string) {
  try {
    const source = JSON.parse(value) as Record<string, unknown>;
    return {
      teacherName: typeof source.teacherName === "string" ? source.teacherName.slice(0, 120) : "Giảng viên",
      title: typeof source.title === "string" ? source.title.slice(0, 160) : "",
      note: typeof source.note === "string" ? source.note.slice(0, 1200) : "",
      lessonNumber: typeof source.lessonNumber === "string" ? source.lessonNumber.slice(0, 2) : "",
      reviewStatus: source.reviewStatus === "follow-up" ? "follow-up" : source.reviewStatus === "reviewed" ? "reviewed" : "",
      analysisAt: typeof source.analysisAt === "string" ? source.analysisAt.slice(0, 80) : "",
    };
  } catch {
    return { teacherName: "Giảng viên", title: "", note: "", lessonNumber: "", reviewStatus: "", analysisAt: "" };
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const hostname = new URL(request.url).hostname;
    const previewRequest = hostname === "terminal.local" || hostname === "localhost";
    const learner = await verifyDeviceRequest(payload, previewRequest);
    if (learner.personRole !== "learner") {
      throw new DeviceAccessError(
        "Chỉ Học viên được đọc hướng dẫn Giảng viên gửi cho tài khoản này.",
        403,
        "LEARNER_ROLE_REQUIRED",
        learner,
      );
    }

    const database = await getCourseDatabase();
    const result = await database.prepare(
      `SELECT id, event_type, lesson_number, detail_json, created_at
         FROM course_activity_events
        WHERE device_id = ?
          AND event_type IN ('teacher_feedback', 'teacher_assignment', 'teacher_analysis_review')
        ORDER BY id DESC
        LIMIT 20`,
    ).bind(learner.deviceId).all<ActionRow>();

    const actions = (result.results ?? []).map((row) => {
      const detail = parseDetail(row.detail_json);
      return {
        id: row.id,
        type: row.event_type === "teacher_assignment"
          ? "assignment"
          : row.event_type === "teacher_analysis_review"
            ? "review"
            : "feedback",
        teacherName: detail.teacherName,
        title: detail.title,
        note: detail.note,
        lessonNumber: detail.lessonNumber || row.lesson_number || "",
        reviewStatus: detail.reviewStatus,
        analysisAt: detail.analysisAt,
        createdAt: row.created_at,
      };
    });

    return json({ actions });
  } catch (error) {
    if (error instanceof DeviceAccessError) {
      return json({ error: error.message, code: error.code, device: error.device }, error.status);
    }
    return json({ error: "Không thể tải hướng dẫn từ Giảng viên." }, 500);
  }
}
