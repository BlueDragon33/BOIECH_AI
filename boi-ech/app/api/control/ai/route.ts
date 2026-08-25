import { AI_ENGINE_VERSION, learnerIntelligence, type AiLearnerProfile, type AiSelfAssessment } from "../../../ai-engine.server";
import { publishedCourseDocument } from "../../../course-content.server";
import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";
import { deviceErrorResponse, getCourseDatabase } from "../../../device-auth.server";

export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return controlPreflight(request);
}

type LearnerRow = {
  device_id: string;
  display_code: string;
  learner_name: string | null;
  class_name: string | null;
  status: string;
  completed_json: string | null;
  scores_json: string | null;
  attempts_json: string | null;
  total_active_seconds: number | null;
  last_activity_at: string | null;
  ai_enabled: number | null;
  ai_reason: string | null;
  interaction_count: number;
  last_ai_at: string | null;
};

function parse<T>(value: string | null | undefined, fallback: T): T {
  try { return JSON.parse(value ?? "") as T; } catch { return fallback; }
}

async function audit(actor: string, action: string, target: string, detail: Record<string, unknown> = {}) {
  const database = await getCourseDatabase();
  await database.prepare(
    "INSERT INTO course_audit_log (actor, action, target, detail_json) VALUES (?, ?, ?, ?)",
  ).bind(actor, action, target, JSON.stringify({ ...detail, source: "control-center-ai" })).run();
}

async function aiSettings() {
  const database = await getCourseDatabase();
  const row = await database.prepare(
    "SELECT enabled, tutor_enabled, adaptive_enabled, content_assistant_enabled, updated_by, updated_at FROM ai_settings WHERE id = 'global'",
  ).first() as { enabled: number; tutor_enabled: number; adaptive_enabled: number; content_assistant_enabled: number; updated_by: string | null; updated_at: string } | null;
  return {
    enabled: (row?.enabled ?? 1) === 1,
    tutorEnabled: (row?.tutor_enabled ?? 1) === 1,
    adaptiveEnabled: (row?.adaptive_enabled ?? 1) === 1,
    contentAssistantEnabled: (row?.content_assistant_enabled ?? 1) === 1,
    updatedBy: row?.updated_by ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

async function overview(role: string) {
  const database = await getCourseDatabase();
  const document = await publishedCourseDocument(database);
  const [learnersResult, assessmentsResult, metrics, adaptive, feedbackResult, interactionsResult, published] = await Promise.all([
    database.prepare(
      `SELECT d.device_id, d.display_code, d.learner_name, d.class_name, d.status,
              p.completed_json, p.scores_json, p.attempts_json, p.total_active_seconds, p.last_activity_at,
              c.enabled AS ai_enabled, c.reason AS ai_reason,
              COUNT(i.id) AS interaction_count, MAX(i.created_at) AS last_ai_at
         FROM device_access d
         LEFT JOIN device_profiles p ON p.device_id = d.device_id
         LEFT JOIN ai_device_controls c ON c.device_id = d.device_id
         LEFT JOIN ai_interactions i ON i.subject_id = d.device_id
        GROUP BY d.device_id ORDER BY COALESCE(p.last_activity_at, d.last_seen_at) DESC LIMIT 500`,
    ).all() as Promise<{ results: LearnerRow[] }>,
    database.prepare(
      `SELECT device_id, lesson_number, section, rating, confidence, created_at
         FROM learner_self_assessments ORDER BY created_at DESC LIMIT 3000`,
    ).all() as Promise<{ results: { device_id: string; lesson_number: string; section: string; rating: number; confidence: number; created_at: string }[] }>,
    database.prepare(
      `SELECT COUNT(*) AS interactions,
              COUNT(DISTINCT subject_id) AS learners,
              COALESCE(AVG(duration_ms), 0) AS average_ms,
              COALESCE(SUM(cost_micros), 0) AS cost_micros,
              COALESCE(SUM(input_units), 0) AS input_units,
              COALESCE(SUM(output_units), 0) AS output_units
         FROM ai_interactions WHERE created_at >= datetime('now', '-30 days')`,
    ).first() as Promise<{ interactions: number; learners: number; average_ms: number; cost_micros: number; input_units: number; output_units: number } | null>,
    database.prepare(
      `SELECT COUNT(*) AS attempts, COALESCE(SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END), 0) AS passed
         FROM ai_quiz_sessions WHERE status = 'submitted' AND submitted_at >= datetime('now', '-30 days')`,
    ).first() as Promise<{ attempts: number; passed: number } | null>,
    database.prepare(
      `SELECT f.id, f.interaction_id, f.device_id, f.rating, f.note, f.status, f.reviewed_by,
              f.reviewed_at, f.created_at, d.display_code, d.learner_name,
              i.query_text, i.response_json, i.engine_version, i.prompt_version
         FROM ai_feedback f JOIN ai_interactions i ON i.id = f.interaction_id
         LEFT JOIN device_access d ON d.device_id = f.device_id
        ORDER BY CASE f.status WHEN 'open' THEN 0 ELSE 1 END, f.created_at DESC LIMIT 100`,
    ).all() as Promise<{ results: {
      id: string; interaction_id: string; device_id: string; rating: string; note: string | null; status: string;
      reviewed_by: string | null; reviewed_at: string | null; created_at: string; display_code: string | null;
      learner_name: string | null; query_text: string | null; response_json: string; engine_version: string; prompt_version: string;
    }[] }>,
    database.prepare(
      `SELECT i.id, i.subject_id, i.kind, i.lesson_number, i.section, i.query_text, i.response_json,
              i.source_refs_json, i.engine_version, i.prompt_version, i.duration_ms, i.cost_micros,
              i.teacher_rating, i.teacher_reviewed_by, i.teacher_reviewed_at, i.created_at,
              d.display_code, d.learner_name
         FROM ai_interactions i LEFT JOIN device_access d ON d.device_id = i.subject_id
        ORDER BY i.created_at DESC LIMIT 80`,
    ).all() as Promise<{ results: {
      id: string; subject_id: string; kind: string; lesson_number: string | null; section: string | null;
      query_text: string | null; response_json: string; source_refs_json: string; engine_version: string; prompt_version: string;
      duration_ms: number; cost_micros: number; teacher_rating: string | null; teacher_reviewed_by: string | null;
      teacher_reviewed_at: string | null; created_at: string; display_code: string | null; learner_name: string | null;
    }[] }>,
    database.prepare("SELECT version_number FROM course_content_versions WHERE status = 'published' ORDER BY version_number DESC LIMIT 1").first() as Promise<{ version_number: number } | null>,
  ]);

  const assessmentsByDevice = new Map<string, AiSelfAssessment[]>();
  for (const row of assessmentsResult.results) {
    const current = assessmentsByDevice.get(row.device_id) ?? [];
    if (!current.some((item) => item.lessonNumber === row.lesson_number && item.section === row.section)) {
      current.push({ lessonNumber: row.lesson_number, section: row.section, rating: row.rating, confidence: row.confidence, createdAt: row.created_at });
      assessmentsByDevice.set(row.device_id, current);
    }
  }

  const learners = learnersResult.results.map((row) => {
    const profile: AiLearnerProfile = {
      completed: parse<string[]>(row.completed_json, []),
      scores: parse<Record<string, number>>(row.scores_json, {}),
      attempts: parse<Record<string, number>>(row.attempts_json, {}),
      totalActiveSeconds: Math.max(0, Number(row.total_active_seconds) || 0),
      lastActivityAt: row.last_activity_at,
    };
    const intelligence = learnerIntelligence(document, profile, assessmentsByDevice.get(row.device_id) ?? []);
    const unlocked = intelligence.competencies.filter((item) => item.unlocked);
    const averageMastery = unlocked.length ? Math.round(unlocked.reduce((sum, item) => sum + item.mastery, 0) / unlocked.length) : 0;
    return {
      deviceId: row.device_id,
      deviceCode: row.display_code,
      learnerName: row.learner_name,
      className: row.class_name,
      deviceStatus: row.status,
      aiEnabled: (row.ai_enabled ?? 1) === 1,
      aiReason: row.ai_reason,
      interactionCount: Number(row.interaction_count) || 0,
      lastAiAt: row.last_ai_at,
      priorityLesson: intelligence.priorityLesson,
      averageMastery,
      alerts: intelligence.alerts,
    };
  });

  const settings = await aiSettings();
  const openReports = feedbackResult.results.filter((row) => row.status === "open").length;
  return {
    settings,
    engine: {
      name: "Frog AI · hệ luật và truy xuất bài giảng",
      version: AI_ENGINE_VERSION,
      sourceVersion: published?.version_number ?? 0,
      visionEnabled: false,
      externalProvider: false,
      privacy: "Không camera, không ảnh/video người học, không gửi PII ra dịch vụ AI bên ngoài.",
    },
    metrics: {
      interactions30Days: Number(metrics?.interactions) || 0,
      learners30Days: Number(metrics?.learners) || 0,
      averageResponseMs: Math.round(Number(metrics?.average_ms) || 0),
      inputUnits: Number(metrics?.input_units) || 0,
      outputUnits: Number(metrics?.output_units) || 0,
      costMicros: Number(metrics?.cost_micros) || 0,
      adaptiveAttempts30Days: Number(adaptive?.attempts) || 0,
      adaptivePassRate: Number(adaptive?.attempts) ? Math.round((Number(adaptive?.passed) / Number(adaptive?.attempts)) * 100) : 0,
      openReports,
      learnersAtRisk: learners.filter((item) => item.alerts.some((alert) => alert.level !== "info")).length,
    },
    learners,
    feedback: ["reviewer", "publisher", "owner"].includes(role) ? feedbackResult.results.map((row) => ({
      id: row.id,
      interactionId: row.interaction_id,
      deviceId: row.device_id,
      deviceCode: row.display_code,
      learnerName: row.learner_name,
      rating: row.rating,
      note: row.note,
      status: row.status,
      query: row.query_text,
      response: parse<Record<string, unknown>>(row.response_json, {}),
      engineVersion: row.engine_version,
      promptVersion: row.prompt_version,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
    })) : [],
    interactions: ["reviewer", "publisher", "owner"].includes(role) ? interactionsResult.results.map((row) => ({
      id: row.id,
      subjectId: row.subject_id,
      deviceCode: row.display_code,
      learnerName: row.learner_name,
      kind: row.kind,
      lessonNumber: row.lesson_number,
      section: row.section,
      query: row.query_text,
      response: parse<Record<string, unknown>>(row.response_json, {}),
      citations: parse<unknown[]>(row.source_refs_json, []),
      engineVersion: row.engine_version,
      promptVersion: row.prompt_version,
      durationMs: row.duration_ms,
      costMicros: row.cost_micros,
      teacherRating: row.teacher_rating,
      teacherReviewedBy: row.teacher_reviewed_by,
      teacherReviewedAt: row.teacher_reviewed_at,
      createdAt: row.created_at,
    })) : [],
  };
}

export async function GET(request: Request) {
  try {
    const { role } = await requireControlService(request);
    return controlResponse(await overview(role), 200, request);
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}

export async function POST(request: Request) {
  try {
    const { actor, role } = await requireControlService(request);
    const payload = (await request.json()) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";
    const database = await getCourseDatabase();
    const reviewer = ["reviewer", "publisher", "owner"].includes(role);
    const publisher = ["publisher", "owner"].includes(role);

    if (action === "update-settings") {
      if (!publisher) return controlResponse({ error: "Chỉ người xuất bản hoặc chủ hệ thống được đổi cấu hình AI." }, 403, request);
      const flag = (name: string) => payload[name] === false ? 0 : 1;
      await database.prepare(
        `INSERT INTO ai_settings (id, enabled, tutor_enabled, adaptive_enabled, content_assistant_enabled, updated_by)
         VALUES ('global', ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET enabled = excluded.enabled, tutor_enabled = excluded.tutor_enabled,
           adaptive_enabled = excluded.adaptive_enabled, content_assistant_enabled = excluded.content_assistant_enabled,
           updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
      ).bind(flag("enabled"), flag("tutorEnabled"), flag("adaptiveEnabled"), flag("contentAssistantEnabled"), actor).run();
      await audit(actor, "ai_settings_updated", "global", { enabled: payload.enabled, tutorEnabled: payload.tutorEnabled, adaptiveEnabled: payload.adaptiveEnabled, contentAssistantEnabled: payload.contentAssistantEnabled });
      return controlResponse({ saved: true, settings: await aiSettings() }, 200, request);
    }

    if (action === "set-device-ai") {
      if (!publisher) return controlResponse({ error: "Không có quyền bật hoặc tắt AI cho học viên." }, 403, request);
      const deviceId = typeof payload.deviceId === "string" ? payload.deviceId : "";
      if (!/^[a-f0-9]{64}$/.test(deviceId)) return controlResponse({ error: "Thiết bị không hợp lệ." }, 400, request);
      const enabled = payload.enabled !== false;
      const reason = typeof payload.reason === "string" ? payload.reason.trim().slice(0, 300) : "";
      await database.prepare(
        `INSERT INTO ai_device_controls (device_id, enabled, reason, updated_by)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(device_id) DO UPDATE SET enabled = excluded.enabled, reason = excluded.reason,
           updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
      ).bind(deviceId, enabled ? 1 : 0, reason || null, actor).run();
      await audit(actor, enabled ? "ai_device_enabled" : "ai_device_disabled", deviceId, { reason: reason || null });
      return controlResponse({ saved: true }, 200, request);
    }

    if (action === "review-interaction") {
      if (!reviewer) return controlResponse({ error: "Không có quyền đánh giá phản hồi AI." }, 403, request);
      const interactionId = typeof payload.interactionId === "string" ? payload.interactionId : "";
      const rating = typeof payload.rating === "string" && ["approved", "needs_review", "rejected"].includes(payload.rating) ? payload.rating : "";
      if (!/^[0-9a-f-]{36}$/i.test(interactionId) || !rating) return controlResponse({ error: "Đánh giá không hợp lệ." }, 400, request);
      await database.prepare(
        `UPDATE ai_interactions SET teacher_rating = ?, teacher_reviewed_by = ?, teacher_reviewed_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
      ).bind(rating, actor, interactionId).run();
      await audit(actor, "ai_interaction_reviewed", interactionId, { rating });
      return controlResponse({ saved: true }, 200, request);
    }

    if (action === "resolve-feedback") {
      if (!reviewer) return controlResponse({ error: "Không có quyền xử lý báo cáo AI." }, 403, request);
      const feedbackId = typeof payload.feedbackId === "string" ? payload.feedbackId : "";
      const status = payload.status === "dismissed" ? "dismissed" : "resolved";
      if (!/^[0-9a-f-]{36}$/i.test(feedbackId)) return controlResponse({ error: "Báo cáo không hợp lệ." }, 400, request);
      await database.prepare(
        `UPDATE ai_feedback SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      ).bind(status, actor, feedbackId).run();
      await audit(actor, "ai_feedback_resolved", feedbackId, { status });
      return controlResponse({ saved: true }, 200, request);
    }

    return controlResponse({ error: "Thao tác quản trị AI không hợp lệ." }, 400, request);
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}
