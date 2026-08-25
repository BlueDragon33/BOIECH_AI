import {
  AI_ENGINE_VERSION,
  adaptiveQuiz,
  learnerIntelligence,
  scoreAdaptiveQuiz,
  tutorReply,
  type AiLearnerProfile,
  type AiQuizHistory,
  type AiQuizQuestionRef,
  type AiSelfAssessment,
} from "../../../ai-engine.server";
import { publishedCourseDocument } from "../../../course-content.server";
import { DeviceAccessError, getCourseDatabase, verifyDeviceRequest } from "../../../device-auth.server";

export const dynamic = "force-dynamic";

type ProfileRow = {
  completed_json: string;
  scores_json: string;
  attempts_json: string;
  total_active_seconds: number;
  last_activity_at: string | null;
};

type AiSettingRow = {
  enabled: number;
  tutor_enabled: number;
  adaptive_enabled: number;
  content_assistant_enabled: number;
};

type AssessmentRow = {
  lesson_number: string;
  section: string;
  rating: number;
  confidence: number;
  created_at: string;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
}

function parse<T>(value: string | null | undefined, fallback: T): T {
  try { return JSON.parse(value ?? "") as T; } catch { return fallback; }
}

function validLesson(value: unknown) {
  return typeof value === "string" && /^(0[1-8])$/.test(value) ? value : "01";
}

function validSection(value: unknown) {
  return typeof value === "string" && ["hoc-tap", "thuc-hanh", "phan-tich", "on-tap", "kiem-tra"].includes(value) ? value : "hoc-tap";
}

function redactSensitive(value: string) {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email đã ẩn]")
    .replace(/(?:\+?84|0)(?:[ .-]?\d){8,10}/g, "[số điện thoại đã ẩn]")
    .replace(/\b\d{9,16}\b/g, "[mã số đã ẩn]")
    .slice(0, 500);
}

async function profileFor(deviceId: string): Promise<AiLearnerProfile> {
  const database = await getCourseDatabase();
  const row = await database.prepare(
    `SELECT completed_json, scores_json, attempts_json, total_active_seconds, last_activity_at
       FROM device_profiles WHERE device_id = ?`,
  ).bind(deviceId).first() as ProfileRow | null;
  return {
    completed: parse<string[]>(row?.completed_json, []),
    scores: parse<Record<string, number>>(row?.scores_json, {}),
    attempts: parse<Record<string, number>>(row?.attempts_json, {}),
    totalActiveSeconds: Math.max(0, Number(row?.total_active_seconds) || 0),
    lastActivityAt: row?.last_activity_at ?? null,
  };
}

async function assessmentsFor(deviceId: string): Promise<AiSelfAssessment[]> {
  const database = await getCourseDatabase();
  const result = await database.prepare(
    `SELECT lesson_number, section, rating, confidence, created_at
       FROM learner_self_assessments WHERE device_id = ? ORDER BY created_at DESC LIMIT 80`,
  ).bind(deviceId).all() as { results: AssessmentRow[] };
  const latest = new Map<string, AiSelfAssessment>();
  for (const row of result.results) {
    const key = `${row.lesson_number}:${row.section}`;
    if (!latest.has(key)) latest.set(key, { lessonNumber: row.lesson_number, section: row.section, rating: row.rating, confidence: row.confidence, createdAt: row.created_at });
  }
  return [...latest.values()];
}

async function quizHistoryFor(deviceId: string): Promise<AiQuizHistory[]> {
  const database = await getCourseDatabase();
  const result = await database.prepare(
    `SELECT lesson_number, detail_json, created_at FROM course_activity_events
      WHERE device_id = ? AND event_type = 'quiz_submit'
      ORDER BY created_at ASC LIMIT 200`,
  ).bind(deviceId).all() as { results: { lesson_number: string | null; detail_json: string; created_at: string }[] };
  return result.results.flatMap((row) => {
    const detail = parse<Record<string, unknown>>(row.detail_json, {});
    const score = Number(detail.score);
    if (!row.lesson_number || !Number.isFinite(score)) return [];
    return [{ lessonNumber: row.lesson_number, score, passed: Boolean(detail.passed), createdAt: row.created_at }];
  });
}

async function settingsFor(deviceId: string) {
  const database = await getCourseDatabase();
  const [global, local] = await Promise.all([
    database.prepare("SELECT enabled, tutor_enabled, adaptive_enabled, content_assistant_enabled FROM ai_settings WHERE id = 'global'").first() as Promise<AiSettingRow | null>,
    database.prepare("SELECT enabled, reason FROM ai_device_controls WHERE device_id = ?").bind(deviceId).first() as Promise<{ enabled: number; reason: string | null } | null>,
  ]);
  return {
    enabled: (global?.enabled ?? 1) === 1 && (local?.enabled ?? 1) === 1,
    tutorEnabled: (global?.tutor_enabled ?? 1) === 1,
    adaptiveEnabled: (global?.adaptive_enabled ?? 1) === 1,
    contentAssistantEnabled: (global?.content_assistant_enabled ?? 1) === 1,
    deviceReason: local?.reason ?? null,
    engineVersion: AI_ENGINE_VERSION,
    dataPolicy: "Không dùng camera, ảnh hoặc video; không gửi dữ liệu cá nhân tới dịch vụ AI bên ngoài.",
  };
}

async function recentInteractions(deviceId: string) {
  const database = await getCourseDatabase();
  const result = await database.prepare(
    `SELECT id, kind, lesson_number, section, query_text, response_json, source_refs_json,
            engine_version, prompt_version, created_at
       FROM ai_interactions WHERE subject_id = ? AND kind = 'mentor'
      ORDER BY created_at DESC LIMIT 8`,
  ).bind(deviceId).all() as { results: {
    id: string; kind: string; lesson_number: string | null; section: string | null; query_text: string | null;
    response_json: string; source_refs_json: string; engine_version: string; prompt_version: string; created_at: string;
  }[] };
  return result.results.map((row) => ({
    id: row.id,
    lessonNumber: row.lesson_number,
    section: row.section,
    query: row.query_text,
    response: parse<Record<string, unknown>>(row.response_json, {}),
    citations: parse<unknown[]>(row.source_refs_json, []),
    engineVersion: row.engine_version,
    promptVersion: row.prompt_version,
    createdAt: row.created_at,
  }));
}

async function recordLearningEvent(deviceId: string, eventType: string, lessonNumber: string | null, section: string | null, detail: Record<string, unknown>) {
  const database = await getCourseDatabase();
  await database.prepare(
    `INSERT INTO course_activity_events (device_id, event_type, lesson_number, part, detail_json)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(deviceId, eventType, lessonNumber, section, JSON.stringify(detail)).run();
}

async function bootstrap(deviceId: string) {
  const database = await getCourseDatabase();
  const [document, profile, assessments, history, settings, interactions] = await Promise.all([
    publishedCourseDocument(database), profileFor(deviceId), assessmentsFor(deviceId), quizHistoryFor(deviceId), settingsFor(deviceId), recentInteractions(deviceId),
  ]);
  return { settings, intelligence: learnerIntelligence(document, profile, assessments, history), assessments, interactions };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const previewRequest = ["terminal.local", "localhost"].includes(new URL(request.url).hostname);
    const device = await verifyDeviceRequest(payload, previewRequest);
    const action = typeof payload.action === "string" ? payload.action : "bootstrap";
    const settings = await settingsFor(device.deviceId);

    if (action === "bootstrap") return json(await bootstrap(device.deviceId));
    if (!settings.enabled) return json({ error: settings.deviceReason || "AI đang được quản trị viên tạm tắt cho thiết bị này.", code: "AI_DISABLED" }, 403);
    const database = await getCourseDatabase();
    const document = await publishedCourseDocument(database);
    const lessonNumber = validLesson(payload.lessonNumber);
    const section = validSection(payload.section);

    if (action === "ask") {
      if (!settings.tutorEnabled) return json({ error: "Trợ giảng AI đang được tạm tắt.", code: "AI_TUTOR_DISABLED" }, 403);
      const query = typeof payload.query === "string" ? payload.query.trim().slice(0, 500) : "";
      if (query.length < 2) return json({ error: "Hãy nhập câu hỏi cụ thể hơn." }, 400);
      const hourly = await database.prepare(
        `SELECT COUNT(*) AS count FROM ai_interactions
          WHERE subject_id = ? AND kind = 'mentor' AND created_at >= datetime('now', '-1 hour')`,
      ).bind(device.deviceId).first() as { count: number } | null;
      if ((hourly?.count ?? 0) >= 30) return json({ error: "Đã đạt giới hạn 30 câu hỏi trong một giờ. Hãy nghỉ ngắn rồi thử lại.", code: "AI_RATE_LIMIT" }, 429);
      const reply = tutorReply(document, query, lessonNumber, device.learnerGivenName ?? "Học viên");
      const interactionId = crypto.randomUUID();
      const storedAnswer = reply.answer.replace(`${device.learnerGivenName ?? "Học viên"},`, "Học viên,");
      await database.prepare(
        `INSERT INTO ai_interactions
          (id, subject_id, kind, lesson_number, section, query_text, response_json, source_refs_json,
           engine_version, prompt_version, duration_ms, input_units, output_units, cost_micros)
         VALUES (?, ?, 'mentor', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      ).bind(
        interactionId, device.deviceId, lessonNumber, section, redactSensitive(query),
        JSON.stringify({ ...reply, answer: storedAnswer }), JSON.stringify(reply.citations),
        reply.engineVersion, reply.promptVersion, reply.durationMs,
        query.split(/\s+/).filter(Boolean).length, reply.answer.split(/\s+/).filter(Boolean).length,
      ).run();
      await recordLearningEvent(device.deviceId, "ai_mentor_question", lessonNumber, section, { interactionId, safety: reply.safety });
      return json({ interaction: { id: interactionId, query, response: reply, createdAt: new Date().toISOString() } });
    }

    if (action === "self-assess") {
      const rating = Number(payload.rating);
      const confidence = Number(payload.confidence);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !Number.isInteger(confidence) || confidence < 1 || confidence > 5) {
        return json({ error: "Mức tự đánh giá và độ tự tin phải từ 1 đến 5." }, 400);
      }
      const note = typeof payload.note === "string" ? redactSensitive(payload.note.trim().slice(0, 300)) : "";
      const id = crypto.randomUUID();
      await database.prepare(
        `INSERT INTO learner_self_assessments
          (id, device_id, lesson_number, section, rating, confidence, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, device.deviceId, lessonNumber, section, rating, confidence, note || null).run();
      await recordLearningEvent(device.deviceId, "ai_self_assessment", lessonNumber, section, { rating, confidence });
      return json(await bootstrap(device.deviceId), 201);
    }

    if (action === "feedback") {
      const interactionId = typeof payload.interactionId === "string" ? payload.interactionId : "";
      const rating = typeof payload.rating === "string" && ["helpful", "not_helpful", "inappropriate"].includes(payload.rating) ? payload.rating : "";
      const note = typeof payload.note === "string" ? redactSensitive(payload.note.trim().slice(0, 500)) : "";
      const owned = await database.prepare("SELECT id FROM ai_interactions WHERE id = ? AND subject_id = ?").bind(interactionId, device.deviceId).first() as { id: string } | null;
      if (!owned || !rating) return json({ error: "Phản hồi AI không hợp lệ." }, 400);
      await database.prepare(
        `INSERT INTO ai_feedback (id, interaction_id, device_id, rating, note)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(interaction_id, device_id) DO UPDATE SET rating = excluded.rating,
           note = excluded.note, status = 'open', reviewed_by = NULL, reviewed_at = NULL`,
      ).bind(crypto.randomUUID(), interactionId, device.deviceId, rating, note || null).run();
      return json({ saved: true });
    }

    if (action === "create-quiz") {
      if (!settings.adaptiveEnabled) return json({ error: "Bài luyện thích ứng đang được tạm tắt.", code: "AI_ADAPTIVE_DISABLED" }, 403);
      const [profile, assessments] = await Promise.all([profileFor(device.deviceId), assessmentsFor(device.deviceId)]);
      const sessionId = crypto.randomUUID();
      const quiz = adaptiveQuiz(document, profile, assessments, `${device.deviceId}:${new Date().toISOString().slice(0, 10)}:${sessionId}`);
      await database.batch([
        database.prepare("UPDATE ai_quiz_sessions SET status = 'abandoned' WHERE device_id = ? AND status = 'active'").bind(device.deviceId),
        database.prepare(
          `INSERT INTO ai_quiz_sessions (id, device_id, question_refs_json, status)
           VALUES (?, ?, ?, 'active')`,
        ).bind(sessionId, device.deviceId, JSON.stringify(quiz.refs)),
      ]);
      await recordLearningEvent(device.deviceId, "ai_adaptive_quiz_start", quiz.focusLessons[0] ?? lessonNumber, "kiem-tra", { sessionId, focusLessons: quiz.focusLessons });
      return json({ quiz: { sessionId, questions: quiz.questions, passScore: 8, questionCount: 10, focusLessons: quiz.focusLessons } }, 201);
    }

    if (action === "submit-quiz") {
      const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
      const answers = Array.isArray(payload.answers) ? payload.answers.map(Number) : [];
      if (!/^[0-9a-f-]{36}$/i.test(sessionId) || answers.length !== 10 || answers.some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 3)) {
        return json({ error: "Hãy trả lời đủ 10 câu trước khi nộp." }, 400);
      }
      const session = await database.prepare(
        "SELECT question_refs_json, status FROM ai_quiz_sessions WHERE id = ? AND device_id = ?",
      ).bind(sessionId, device.deviceId).first() as { question_refs_json: string; status: string } | null;
      if (!session || session.status !== "active") return json({ error: "Bài luyện đã kết thúc. Hãy tạo lượt mới." }, 409);
      const refs = parse<AiQuizQuestionRef[]>(session.question_refs_json, []);
      if (refs.length !== 10) return json({ error: "Bài luyện không còn hợp lệ." }, 409);
      const score = scoreAdaptiveQuiz(document, refs, answers);
      const passed = score >= 8;
      await database.prepare(
        `UPDATE ai_quiz_sessions SET status = 'submitted', score = ?, passed = ?, submitted_at = CURRENT_TIMESTAMP
          WHERE id = ? AND device_id = ? AND status = 'active'`,
      ).bind(score, passed ? 1 : 0, sessionId, device.deviceId).run();
      await recordLearningEvent(device.deviceId, "ai_adaptive_quiz_submit", refs[0]?.lessonNumber ?? lessonNumber, "kiem-tra", { sessionId, score, passed, resetRequired: !passed });
      return json({ score, passed, passScore: 8, resetRequired: !passed });
    }

    return json({ error: "Thao tác AI không được hỗ trợ." }, 400);
  } catch (error) {
    if (error instanceof DeviceAccessError) return json({ error: error.message, code: error.code, device: error.device }, error.status);
    return json({ error: "Dịch vụ AI học tập đang tạm gián đoạn." }, 500);
  }
}
