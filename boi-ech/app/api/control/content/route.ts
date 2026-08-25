import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";
import {
  courseEditSectionFromDocument,
  listContentVersions,
  parseCourseDocument,
  parseCourseEditScope,
  publishedCourseDocument,
  replaceCourseEditSection,
  validateCourseDocument,
} from "../../../course-content.server";
import { deviceErrorResponse, getCourseDatabase } from "../../../device-auth.server";

export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return controlPreflight(request);
}

function canReview(role: string) {
  return ["reviewer", "publisher", "owner"].includes(role);
}

function canPublish(role: string) {
  return ["publisher", "owner"].includes(role);
}

async function audit(actor: string, action: string, target: string, detail: Record<string, unknown> = {}) {
  const database = await getCourseDatabase();
  await database.prepare(
    "INSERT INTO course_audit_log (actor, action, target, detail_json) VALUES (?, ?, ?, ?)",
  ).bind(actor, action, target, JSON.stringify(detail)).run();
}

export async function GET(request: Request) {
  try {
    const { role } = await requireControlService(request);
    const respond = (data: unknown, status = 200) => controlResponse(data, status, request);
    if (!canReview(role)) return respond({ error: "Không có quyền xem yêu cầu chỉnh sửa." }, 403);
    const database = await getCourseDatabase();
    const versionId = new URL(request.url).searchParams.get("versionId") ?? undefined;
    const versions = await listContentVersions(database);
    if (!versionId) return respond({ versions });
    const selected = await database.prepare(
      "SELECT status, payload_json, edit_scope FROM course_content_versions WHERE id = ?",
    ).bind(versionId).first<{ status: string; payload_json: string; edit_scope: string | null }>();
    const reviewable = selected && ["review", "published", "archived", "changes_requested"].includes(selected.status);
    const proposal = reviewable ? parseCourseDocument(selected.payload_json) : null;
    const scope = parseCourseEditScope(selected?.edit_scope);
    const published = scope ? await publishedCourseDocument(database) : null;
    return respond({
      versions,
      editScope: scope ?? undefined,
      currentSection: published && scope ? courseEditSectionFromDocument(published, scope) : undefined,
      proposedSection: proposal && scope ? courseEditSectionFromDocument(proposal, scope) : undefined,
    });
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
    const respond = (data: unknown, status = 200) => controlResponse(data, status, request);

    const versionId = typeof payload.versionId === "string" ? payload.versionId : "";
    if (!/^[0-9a-f-]{36}$/i.test(versionId)) return respond({ error: "Phiên bản nội dung không hợp lệ." }, 400);
    const current = await database.prepare(
      `SELECT id, status, created_by, payload_json, version_number, edit_scope,
              editor_device_id, editor_device_code
         FROM course_content_versions WHERE id = ?`,
    ).bind(versionId).first<{ id: string; status: string; created_by: string; payload_json: string; version_number: number; edit_scope: string | null; editor_device_id: string | null; editor_device_code: string | null }>();
    if (!current) return respond({ error: "Không tìm thấy phiên bản nội dung." }, 404);
    const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 1000) : "";

    if (action === "approve-edit") {
      if (!canReview(role)) return respond({ error: "Không có quyền cấp phép chỉnh sửa." }, 403);
      if (current.status !== "permission_requested") return respond({ error: "Yêu cầu này không còn ở trạng thái xin quyền." }, 409);
      await database.prepare(
        `UPDATE course_content_versions SET status = 'draft', permission_note = ?,
                permission_reviewed_by = ?, permission_reviewed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'permission_requested'`,
      ).bind(note || null, actor, versionId).run();
      await audit(actor, "content_edit_permission_approved", versionId, { scope: current.edit_scope, deviceCode: current.editor_device_code, note });
    } else if (action === "deny-edit") {
      if (!canReview(role)) return respond({ error: "Không có quyền từ chối yêu cầu." }, 403);
      if (current.status !== "permission_requested") return respond({ error: "Yêu cầu này không còn ở trạng thái xin quyền." }, 409);
      await database.prepare(
        `UPDATE course_content_versions SET status = 'denied', permission_note = ?,
                permission_reviewed_by = ?, permission_reviewed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'permission_requested'`,
      ).bind(note || null, actor, versionId).run();
      await audit(actor, "content_edit_permission_denied", versionId, { scope: current.edit_scope, deviceCode: current.editor_device_code, note });
    } else if (action === "request-changes") {
      if (!canReview(role)) return respond({ error: "Không có quyền yêu cầu sửa lại." }, 403);
      if (current.status !== "review") return respond({ error: "Bản này không ở trạng thái chờ kiểm tra." }, 409);
      await database.prepare(
        `UPDATE course_content_versions SET status = 'changes_requested', permission_note = ?,
                reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'review'`,
      ).bind(note || "Trung tâm yêu cầu kiểm tra và chỉnh sửa lại nội dung.", actor, versionId).run();
      await audit(actor, "content_changes_requested", versionId, { scope: current.edit_scope, note });
    } else if (action === "cancel") {
      if (!canReview(role)) return respond({ error: "Không có quyền hủy bản chỉnh sửa." }, 403);
      if (!["permission_requested", "draft", "changes_requested", "review"].includes(current.status)) {
        return respond({ error: "Không thể hủy ở trạng thái hiện tại." }, 409);
      }
      await database.prepare(
        `UPDATE course_content_versions SET status = 'cancelled', permission_note = ?,
                reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
      ).bind(note || null, actor, versionId).run();
      await audit(actor, "content_edit_cancelled", versionId, { scope: current.edit_scope, note });
    } else if (action === "approve-publish") {
      if (!canPublish(role)) return respond({ error: "Chỉ người có quyền xuất bản mới được phê duyệt." }, 403);
      if (current.status !== "review") return respond({ error: "Nội dung phải được gửi duyệt trước khi xuất bản." }, 409);
      if (current.created_by === actor) return respond({ error: "Người tạo bản nháp không được tự phê duyệt phiên bản của mình." }, 409);
      const candidate = parseCourseDocument(current.payload_json);
      const scope = parseCourseEditScope(current.edit_scope);
      const publishedSource = scope ? await publishedCourseDocument(database) : null;
      const merged = candidate && scope && publishedSource
        ? replaceCourseEditSection(publishedSource, scope, courseEditSectionFromDocument(candidate, scope))
        : null;
      const validation = merged ? validateCourseDocument(merged) : { valid: false, errors: ["Không đọc được gói nội dung hoặc phạm vi sửa."] };
      if (!validation.valid) return respond({ error: "Nội dung không còn đạt kiểm tra.", validationErrors: validation.errors }, 422);
      await database.batch([
        database.prepare(
          `UPDATE course_content_versions SET status = 'published', payload_json = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
                  published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'review'`,
        ).bind(JSON.stringify(merged), actor, versionId),
        database.prepare(
          `UPDATE course_content_versions SET status = 'archived', updated_at = CURRENT_TIMESTAMP
            WHERE status = 'published' AND id <> ?
              AND EXISTS (SELECT 1 FROM course_content_versions
                           WHERE id = ? AND status = 'published' AND reviewed_by = ?)`,
        ).bind(versionId, versionId, actor),
      ]);
      const published = await database.prepare(
        "SELECT status, reviewed_by FROM course_content_versions WHERE id = ?",
      ).bind(versionId).first<{ status: string; reviewed_by: string | null }>();
      if (published?.status !== "published" || published.reviewed_by !== actor) {
        return respond({ error: "Phiên bản đã thay đổi trong lúc phê duyệt. Hãy tải lại." }, 409);
      }
      await audit(actor, "content_published", versionId, {
        versionNumber: current.version_number,
        scope: scope?.value,
        lessonNumber: scope?.lessonNumber,
        section: scope?.section,
      });
    } else if (action === "rollback") {
      if (!canPublish(role)) return respond({ error: "Chỉ người có quyền xuất bản mới được khôi phục." }, 403);
      if (!['archived', 'published'].includes(current.status)) return respond({ error: "Chỉ phiên bản từng xuất bản mới có thể khôi phục." }, 409);
      const restoredId = crypto.randomUUID();
      await database.batch([
        database.prepare(
          `INSERT INTO course_content_versions
            (id, version_number, status, payload_json, summary, created_by, reviewed_by,
             submitted_at, reviewed_at, published_at, parent_version_id)
           SELECT ?, (SELECT COALESCE(MAX(version_number), 0) + 1 FROM course_content_versions),
                  'published', payload_json, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                  CURRENT_TIMESTAMP, id
             FROM course_content_versions WHERE id = ? AND status IN ('archived', 'published')`,
        ).bind(restoredId, `Khôi phục từ V${current.version_number}`, actor, actor, versionId),
        database.prepare(
          `UPDATE course_content_versions SET status = 'archived', updated_at = CURRENT_TIMESTAMP
            WHERE status = 'published' AND id <> ?
              AND EXISTS (SELECT 1 FROM course_content_versions WHERE id = ? AND status = 'published')`,
        ).bind(restoredId, restoredId),
      ]);
      await audit(actor, "content_rolled_back", restoredId, { sourceVersionId: versionId, sourceVersionNumber: current.version_number });
      return respond({ versionId: restoredId, versions: await listContentVersions(database) });
    } else {
      return respond({ error: "Thao tác nội dung không hợp lệ." }, 400);
    }
    return respond({ versions: await listContentVersions(database) });
  } catch (error) {
    return withControlCors(request, deviceErrorResponse(error));
  }
}
