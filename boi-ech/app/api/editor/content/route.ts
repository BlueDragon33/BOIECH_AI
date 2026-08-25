import {
  courseEditSectionFromDocument,
  createCourseEditScope,
  listEditorContentVersions,
  parseCourseDocument,
  parseCourseEditScope,
  publishedCourseDocument,
  replaceCourseEditSection,
  validateCourseDocument,
} from "../../../course-content.server";
import { AI_ENGINE_VERSION, contentDraftSuggestions } from "../../../ai-engine.server";
import {
  EditorAccessError,
  editorErrorResponse,
  verifyEditorProof,
} from "../../../editor-device-auth.server";
import { getCourseDatabase } from "../../../device-auth.server";

export const dynamic = "force-dynamic";

type EditorVersionRow = {
  id: string;
  status: string;
  payload_json: string;
  created_by: string;
  editor_device_id: string | null;
  edit_scope: string | null;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
}

async function audit(actor: string, action: string, target: string, detail: Record<string, unknown> = {}) {
  const database = await getCourseDatabase();
  await database.prepare(
    "INSERT INTO course_audit_log (actor, action, target, detail_json) VALUES (?, ?, ?, ?)",
  ).bind(actor, action, target, JSON.stringify({ ...detail, source: "boi-ech-editor" })).run();
}

async function versionFor(id: string) {
  const database = await getCourseDatabase();
  return database.prepare(
    `SELECT id, status, payload_json, created_by, editor_device_id, edit_scope
       FROM course_content_versions WHERE id = ?`,
  ).bind(id).first<EditorVersionRow>();
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const editor = await verifyEditorProof(payload);
    const action = typeof payload.action === "string" ? payload.action : "bootstrap";
    const database = await getCourseDatabase();

    if (action === "bootstrap") {
      const all = await listEditorContentVersions(database, editor.email, editor.deviceId);
      const active = all.find((item) => ["draft", "changes_requested"].includes(item.status));
      const activeRow = active ? await versionFor(active.id) : null;
      const activeScope = parseCourseEditScope(activeRow?.edit_scope);
      const activeDocument = activeRow ? parseCourseDocument(activeRow.payload_json) : null;
      return json({
        device: editor,
        versions: all,
        activeContent: activeScope && activeDocument ? courseEditSectionFromDocument(activeDocument, activeScope) : undefined,
        activeScope,
      });
    }

    if (action === "request-edit") {
      const scope = createCourseEditScope(payload.editLesson, payload.editSection)
        ?? parseCourseEditScope(payload.editScope);
      if (!scope || scope.section === "lesson") {
        throw new EditorAccessError("Hãy chọn đúng bài và phần nội dung cần chỉnh sửa.", 400, "INVALID_EDIT_SCOPE");
      }
      const summary = typeof payload.summary === "string" ? payload.summary.trim().slice(0, 300) : "";
      if (summary.length < 5) throw new EditorAccessError("Hãy mô tả ngắn nội dung cần chỉnh sửa.", 400, "EDIT_SUMMARY_REQUIRED");
      const existing = await database.prepare(
        `SELECT id FROM course_content_versions
          WHERE editor_device_id = ? AND status IN ('permission_requested','draft','changes_requested','review')
          ORDER BY version_number DESC LIMIT 1`,
      ).bind(editor.deviceId).first<{ id: string }>();
      if (existing) throw new EditorAccessError("Laptop này đang có một yêu cầu chưa kết thúc.", 409, "OPEN_EDIT_REQUEST_EXISTS");
      const source = await publishedCourseDocument(database);
      const id = crypto.randomUUID();
      await database.prepare(
        `INSERT INTO course_content_versions
          (id, version_number, status, payload_json, summary, created_by,
           editor_device_id, editor_device_code, edit_scope, parent_version_id)
         SELECT ?, COALESCE(MAX(version_number), 0) + 1, 'permission_requested', ?, ?, ?, ?, ?, ?,
                (SELECT id FROM course_content_versions WHERE status = 'published'
                  ORDER BY version_number DESC LIMIT 1)
           FROM course_content_versions`,
      ).bind(id, JSON.stringify(source), summary, editor.email, editor.deviceId, editor.deviceCode, scope.value).run();
      await audit(editor.email, "content_edit_permission_requested", id, {
        scope: scope.value,
        lessonNumber: scope.lessonNumber,
        section: scope.section,
        deviceCode: editor.deviceCode,
      });
      return json({ versionId: id, versions: await listEditorContentVersions(database, editor.email, editor.deviceId) }, 201);
    }

    const versionId = typeof payload.versionId === "string" ? payload.versionId : "";
    if (!/^[0-9a-f-]{36}$/i.test(versionId)) throw new EditorAccessError("Yêu cầu chỉnh sửa không hợp lệ.", 400, "INVALID_EDIT_REQUEST");
    const current = await versionFor(versionId);
    if (!current || current.created_by !== editor.email || current.editor_device_id !== editor.deviceId) {
      throw new EditorAccessError("Yêu cầu không thuộc tài khoản và laptop hiện tại.", 403, "EDIT_REQUEST_OWNERSHIP_MISMATCH");
    }

    if (action === "ai-suggest") {
      if (!["draft", "changes_requested"].includes(current.status)) {
        throw new EditorAccessError("Chỉ được dùng trợ lý AI sau khi Trung tâm đã cấp quyền chỉnh sửa.", 409, "AI_EDIT_NOT_ALLOWED");
      }
      const setting = await database.prepare(
        "SELECT enabled, content_assistant_enabled FROM ai_settings WHERE id = 'global'",
      ).first() as { enabled: number; content_assistant_enabled: number } | null;
      if ((setting?.enabled ?? 1) !== 1 || (setting?.content_assistant_enabled ?? 1) !== 1) {
        throw new EditorAccessError("Trợ lý soạn nội dung đang được Trung tâm tạm tắt.", 403, "AI_CONTENT_ASSISTANT_DISABLED");
      }
      const scope = parseCourseEditScope(current.edit_scope);
      const source = parseCourseDocument(current.payload_json);
      if (!scope || !source) throw new EditorAccessError("Bản nháp không còn hợp lệ.", 409, "EDIT_DRAFT_INVALID");
      const sectionContent = payload.sectionContent ?? courseEditSectionFromDocument(source, scope);
      const aiReview = contentDraftSuggestions(sectionContent, scope);
      const interactionId = crypto.randomUUID();
      await database.prepare(
        `INSERT INTO ai_interactions
          (id, subject_id, kind, lesson_number, section, response_json, source_refs_json,
           engine_version, prompt_version, duration_ms, input_units, output_units, cost_micros)
         VALUES (?, ?, 'content_assistant', ?, ?, ?, '[]', ?, ?, 1, 0, ?, 0)`,
      ).bind(
        interactionId, editor.deviceId, scope.lessonNumber, scope.section,
        JSON.stringify(aiReview), AI_ENGINE_VERSION, aiReview.promptVersion,
        JSON.stringify(aiReview).split(/\s+/).length,
      ).run();
      await audit(editor.email, "ai_content_draft_reviewed", versionId, { scope: scope.value, interactionId, suggestionCount: aiReview.suggestions.length });
      return json({ aiReview: { ...aiReview, interactionId } });
    }

    if (action === "save-draft") {
      if (!["draft", "changes_requested"].includes(current.status)) {
        throw new EditorAccessError("Trung tâm chưa cấp quyền hoặc bản sửa đang chờ duyệt.", 409, "EDIT_NOT_ALLOWED");
      }
      const scope = parseCourseEditScope(current.edit_scope);
      const source = parseCourseDocument(current.payload_json);
      if (!scope || !source) throw new EditorAccessError("Bản nháp không còn hợp lệ.", 409, "EDIT_DRAFT_INVALID");
      const next = replaceCourseEditSection(source, scope, payload.sectionContent);
      const validation = validateCourseDocument(next);
      if (!validation.valid) return json({ error: "Nội dung chưa đạt kiểm tra.", validationErrors: validation.errors }, 422);
      await database.prepare(
        `UPDATE course_content_versions SET payload_json = ?, status = 'draft', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND editor_device_id = ?`,
      ).bind(JSON.stringify(next), versionId, editor.deviceId).run();
      await audit(editor.email, "content_editor_draft_saved", versionId, {
        scope: scope.value,
        lessonNumber: scope.lessonNumber,
        section: scope.section,
      });
    } else if (action === "submit-review") {
      if (current.status !== "draft") throw new EditorAccessError("Hãy lưu bản sửa hợp lệ trước khi gửi.", 409, "DRAFT_SAVE_REQUIRED");
      const document = parseCourseDocument(current.payload_json);
      if (!document) throw new EditorAccessError("Bản sửa chưa đạt kiểm tra nội dung.", 422, "EDIT_VALIDATION_FAILED");
      const scope = parseCourseEditScope(current.edit_scope);
      if (!scope) throw new EditorAccessError("Phạm vi bản sửa không còn hợp lệ.", 409, "EDIT_SCOPE_INVALID");
      const published = await publishedCourseDocument(database);
      const currentSection = courseEditSectionFromDocument(published, scope);
      const proposedSection = courseEditSectionFromDocument(document, scope);
      if (JSON.stringify(currentSection) === JSON.stringify(proposedSection)) {
        throw new EditorAccessError("Phần được cấp quyền chưa có thay đổi nào để gửi.", 409, "EDIT_HAS_NO_CHANGES");
      }
      await database.prepare(
        `UPDATE course_content_versions SET status = 'review', submitted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP WHERE id = ? AND editor_device_id = ?`,
      ).bind(versionId, editor.deviceId).run();
      await audit(editor.email, "content_editor_submitted", versionId, {
        scope: scope.value,
        lessonNumber: scope.lessonNumber,
        section: scope.section,
      });
    } else if (action === "withdraw") {
      if (!["permission_requested", "draft", "changes_requested"].includes(current.status)) {
        throw new EditorAccessError("Không thể rút yêu cầu ở trạng thái hiện tại.", 409, "EDIT_WITHDRAW_NOT_ALLOWED");
      }
      await database.prepare(
        `UPDATE course_content_versions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND editor_device_id = ?`,
      ).bind(versionId, editor.deviceId).run();
      await audit(editor.email, "content_editor_withdrawn", versionId);
    } else {
      throw new EditorAccessError("Thao tác chỉnh sửa không hợp lệ.", 400, "INVALID_EDITOR_CONTENT_ACTION");
    }
    return json({
      versions: await listEditorContentVersions(database, editor.email, editor.deviceId),
      activeContent: action === "save-draft" ? payload.sectionContent : undefined,
      activeScope: action === "save-draft" ? parseCourseEditScope(current.edit_scope) : undefined,
    });
  } catch (error) {
    return editorErrorResponse(error);
  }
}
