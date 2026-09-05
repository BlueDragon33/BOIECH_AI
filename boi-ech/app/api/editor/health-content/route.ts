import {
  createHealthEditScope,
  healthEditSectionFromDocument,
  listHealthEditorVersions,
  parseHealthCourseDocument,
  parseHealthEditScope,
  publishedHealthCourseDocument,
  replaceHealthEditSection,
  validateHealthCourseDocument,
} from "../../../health-content.server";
import { EditorAccessError, editorErrorResponse, verifyEditorProof } from "../../../editor-device-auth.server";
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
  ).bind(actor, action, target, JSON.stringify({ ...detail, application: "child-health", source: "child-health-editor" })).run();
}

async function versionFor(id: string) {
  const database = await getCourseDatabase();
  return database.prepare(
    `SELECT id, status, payload_json, created_by, editor_device_id, edit_scope FROM health_content_versions WHERE id = ?`,
  ).bind(id).first<EditorVersionRow>();
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const editor = await verifyEditorProof(payload);
    const action = typeof payload.action === "string" ? payload.action : "bootstrap";
    const database = await getCourseDatabase();

    if (action === "bootstrap") {
      const versions = await listHealthEditorVersions(database, editor.email, editor.deviceId);
      const active = versions.find((item) => ["draft", "changes_requested"].includes(item.status));
      const row = active ? await versionFor(active.id) : null;
      const scope = parseHealthEditScope(row?.edit_scope);
      const document = row ? parseHealthCourseDocument(row.payload_json) : null;
      return json({
        application: "child-health",
        device: editor,
        versions,
        activeContent: scope && document ? healthEditSectionFromDocument(document, scope) : undefined,
        activeScope: scope ?? undefined,
      });
    }

    if (action === "request-edit") {
      const scope = createHealthEditScope(payload.editLesson, payload.editSection) ?? parseHealthEditScope(payload.editScope);
      if (!scope) throw new EditorAccessError("Hãy chọn đúng bài và phần Sức khỏe trẻ cần chỉnh sửa.", 400, "INVALID_HEALTH_EDIT_SCOPE");
      const summary = typeof payload.summary === "string" ? payload.summary.trim().slice(0, 300) : "";
      if (summary.length < 5) throw new EditorAccessError("Hãy mô tả ngắn lý do cần chỉnh sửa.", 400, "EDIT_SUMMARY_REQUIRED");
      const existing = await database.prepare(
        `SELECT id FROM health_content_versions
          WHERE editor_device_id = ? AND status IN ('permission_requested','draft','changes_requested','review')
          ORDER BY version_number DESC LIMIT 1`,
      ).bind(editor.deviceId).first<{ id: string }>();
      if (existing) throw new EditorAccessError("Laptop này đang có một yêu cầu Sức khỏe trẻ chưa kết thúc.", 409, "OPEN_HEALTH_EDIT_REQUEST_EXISTS");
      const source = await publishedHealthCourseDocument(database);
      const id = crypto.randomUUID();
      await database.prepare(
        `INSERT INTO health_content_versions
          (id, version_number, status, payload_json, summary, created_by,
           editor_device_id, editor_device_code, edit_scope, parent_version_id)
         SELECT ?, COALESCE(MAX(version_number), 0) + 1, 'permission_requested', ?, ?, ?, ?, ?, ?,
                (SELECT id FROM health_content_versions WHERE status = 'published' ORDER BY version_number DESC LIMIT 1)
           FROM health_content_versions`,
      ).bind(id, JSON.stringify(source), summary, editor.email, editor.deviceId, editor.deviceCode, scope.value).run();
      await audit(editor.email, "health_content_edit_permission_requested", id, { scope: scope.value, lessonNumber: scope.lessonNumber, section: scope.section, deviceCode: editor.deviceCode });
      return json({ application: "child-health", versionId: id, versions: await listHealthEditorVersions(database, editor.email, editor.deviceId) }, 201);
    }

    const versionId = typeof payload.versionId === "string" ? payload.versionId : "";
    if (!/^[0-9a-f-]{36}$/i.test(versionId)) throw new EditorAccessError("Yêu cầu chỉnh sửa không hợp lệ.", 400, "INVALID_EDIT_REQUEST");
    const current = await versionFor(versionId);
    if (!current || current.created_by !== editor.email || current.editor_device_id !== editor.deviceId) {
      throw new EditorAccessError("Yêu cầu không thuộc tài khoản và laptop hiện tại.", 403, "EDIT_REQUEST_OWNERSHIP_MISMATCH");
    }

    if (action === "save-draft") {
      if (!["draft", "changes_requested"].includes(current.status)) {
        throw new EditorAccessError("Trung tâm chưa cấp quyền hoặc bản sửa đang chờ duyệt.", 409, "EDIT_NOT_ALLOWED");
      }
      const scope = parseHealthEditScope(current.edit_scope);
      const source = parseHealthCourseDocument(current.payload_json);
      if (!scope || !source) throw new EditorAccessError("Bản nháp không còn hợp lệ.", 409, "EDIT_DRAFT_INVALID");
      const next = replaceHealthEditSection(source, scope, payload.sectionContent);
      const validation = validateHealthCourseDocument(next);
      if (!validation.valid) return json({ error: "Nội dung chưa đạt kiểm tra.", validationErrors: validation.errors }, 422);
      await database.prepare(
        `UPDATE health_content_versions SET payload_json = ?, status = 'draft', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND editor_device_id = ?`,
      ).bind(JSON.stringify(next), versionId, editor.deviceId).run();
      await audit(editor.email, "health_content_editor_draft_saved", versionId, { scope: scope.value, lessonNumber: scope.lessonNumber, section: scope.section });
    } else if (action === "submit-review") {
      if (current.status !== "draft") throw new EditorAccessError("Hãy lưu bản sửa hợp lệ trước khi gửi.", 409, "DRAFT_SAVE_REQUIRED");
      const document = parseHealthCourseDocument(current.payload_json);
      const scope = parseHealthEditScope(current.edit_scope);
      if (!document || !scope) throw new EditorAccessError("Bản sửa hoặc phạm vi chưa hợp lệ.", 422, "EDIT_VALIDATION_FAILED");
      const published = await publishedHealthCourseDocument(database);
      const before = healthEditSectionFromDocument(published, scope);
      const after = healthEditSectionFromDocument(document, scope);
      if (JSON.stringify(before) === JSON.stringify(after)) throw new EditorAccessError("Phần được cấp quyền chưa có thay đổi nào để gửi.", 409, "EDIT_HAS_NO_CHANGES");
      await database.prepare(
        `UPDATE health_content_versions SET status = 'review', submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND editor_device_id = ?`,
      ).bind(versionId, editor.deviceId).run();
      await audit(editor.email, "health_content_editor_submitted", versionId, { scope: scope.value, lessonNumber: scope.lessonNumber, section: scope.section });
    } else if (action === "withdraw") {
      if (!["permission_requested", "draft", "changes_requested"].includes(current.status)) {
        throw new EditorAccessError("Không thể rút yêu cầu ở trạng thái hiện tại.", 409, "EDIT_WITHDRAW_NOT_ALLOWED");
      }
      await database.prepare(
        `UPDATE health_content_versions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND editor_device_id = ?`,
      ).bind(versionId, editor.deviceId).run();
      await audit(editor.email, "health_content_editor_withdrawn", versionId);
    } else {
      throw new EditorAccessError("Thao tác chỉnh sửa Sức khỏe trẻ không hợp lệ.", 400, "INVALID_HEALTH_EDITOR_ACTION");
    }

    const versions = await listHealthEditorVersions(database, editor.email, editor.deviceId);
    const latest = action === "save-draft" ? await versionFor(versionId) : null;
    const scope = latest ? parseHealthEditScope(latest.edit_scope) : null;
    const document = latest ? parseHealthCourseDocument(latest.payload_json) : null;
    return json({
      application: "child-health",
      versions,
      activeContent: scope && document ? healthEditSectionFromDocument(document, scope) : undefined,
      activeScope: scope ?? undefined,
    });
  } catch (error) {
    return editorErrorResponse(error);
  }
}
