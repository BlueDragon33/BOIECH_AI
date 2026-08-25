import {
  foundationDetails,
  mistakes,
  phases,
  practice,
  questions,
  sessionPlan,
} from "./course-data.server";
import { defaultLessonOutlines } from "./course-outline-data";
import type {
  FoundationDetail,
  MovementDrill,
  MovementMistake,
  MovementPhase,
  ServerQuestion,
  SessionItem,
  LessonOutline,
} from "./course-types";
import type { getCourseDatabase } from "./device-auth.server";
import {
  COURSE_DOCUMENT_SCHEMA_VERSION,
  validateCourseDocument,
} from "./course-content-validation";

export { COURSE_DOCUMENT_SCHEMA_VERSION, validateCourseDocument } from "./course-content-validation";

type Database = Awaited<ReturnType<typeof getCourseDatabase>>;

export const COURSE_LESSON_NUMBERS = ["01", "02", "03", "04", "05", "06", "07", "08"] as const;
export type CourseLessonNumber = (typeof COURSE_LESSON_NUMBERS)[number];

export const COURSE_EDIT_SECTIONS = ["content", "practice", "analysis", "review", "quiz"] as const;
export type CourseEditSection = (typeof COURSE_EDIT_SECTIONS)[number];
export type CourseEditScope = {
  lessonNumber: CourseLessonNumber;
  section: CourseEditSection | "lesson";
  sectionLabel: string;
  label: string;
  value: string;
};

const COURSE_EDIT_SECTION_LABELS: Record<CourseEditSection, string> = {
  content: "Nội dung",
  practice: "Thực hành",
  analysis: "Phân tích",
  review: "Ôn tập",
  quiz: "Kiểm tra",
};

export function parseCourseEditScope(value: unknown): CourseEditScope | null {
  if (typeof value !== "string") return null;
  if (COURSE_LESSON_NUMBERS.includes(value as CourseLessonNumber)) {
    const lessonNumber = value as CourseLessonNumber;
    return {
      lessonNumber,
      section: "lesson",
      sectionLabel: "Toàn bài · yêu cầu cũ",
      label: `Bài ${lessonNumber} · Toàn bài`,
      value: lessonNumber,
    };
  }
  const [lessonValue, sectionValue, ...rest] = value.split(":");
  if (rest.length > 0
    || !COURSE_LESSON_NUMBERS.includes(lessonValue as CourseLessonNumber)
    || !COURSE_EDIT_SECTIONS.includes(sectionValue as CourseEditSection)) return null;
  const lessonNumber = lessonValue as CourseLessonNumber;
  const section = sectionValue as CourseEditSection;
  const sectionLabel = COURSE_EDIT_SECTION_LABELS[section];
  return { lessonNumber, section, sectionLabel, label: `Bài ${lessonNumber} · ${sectionLabel}`, value };
}

export function createCourseEditScope(lessonNumber: unknown, section: unknown) {
  return parseCourseEditScope(`${String(lessonNumber ?? "")}:${String(section ?? "")}`);
}

export type CourseDocument = {
  schemaVersion: 1;
  lessonOutlines: Record<CourseLessonNumber, LessonOutline>;
  foundationDetails: Record<"01" | "02" | "04" | "05" | "06" | "07" | "08", FoundationDetail>;
  movement: {
    phases: MovementPhase[];
    analysisPhases: MovementPhase[];
    mistakes: MovementMistake[];
    practice: MovementDrill[];
    sessionPlan: SessionItem[];
    questions: ServerQuestion[];
  };
};

type ContentVersionRow = {
  id: string;
  version_number: number;
  status: "permission_requested" | "draft" | "review" | "published" | "changes_requested" | "denied" | "cancelled" | "archived";
  payload_json: string;
  summary: string | null;
  created_by: string;
  editor_device_id: string | null;
  editor_device_code: string | null;
  edit_scope: string | null;
  permission_note: string | null;
  permission_reviewed_by: string | null;
  permission_reviewed_at: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  parent_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicContentVersion = Omit<ContentVersionRow, "payload_json"> & {
  payload?: CourseDocument;
  edit_lesson: CourseLessonNumber | null;
  edit_section: CourseEditSection | "lesson" | null;
  edit_scope_label: string | null;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function staticLessonOutlines() {
  return Object.fromEntries(defaultLessonOutlines.map((lesson) => [lesson.n, lesson])) as Record<CourseLessonNumber, LessonOutline>;
}

function withDocumentDefaults(value: unknown) {
  if (!isRecord(value)) return value;
  const suppliedOutlines = isRecord(value.lessonOutlines) ? value.lessonOutlines : {};
  const suppliedFoundation = isRecord(value.foundationDetails) ? value.foundationDetails : {};
  const normalizedFoundation = Object.fromEntries(Object.entries(suppliedFoundation).map(([number, rawDetail]) => {
    if (!isRecord(rawDetail)) return [number, rawDetail];
    return [number, {
      ...rawDetail,
      analysis: Array.isArray(rawDetail.analysis)
        ? rawDetail.analysis
        : Array.isArray(rawDetail.knowledge) ? clone(rawDetail.knowledge) : [],
    }];
  }));
  const suppliedMovement = isRecord(value.movement) ? value.movement : {};
  const normalizedMovement = {
    ...suppliedMovement,
    analysisPhases: Array.isArray(suppliedMovement.analysisPhases)
      ? suppliedMovement.analysisPhases
      : Array.isArray(suppliedMovement.phases) ? clone(suppliedMovement.phases) : [],
  };
  return {
    ...value,
    lessonOutlines: { ...staticLessonOutlines(), ...suppliedOutlines },
    foundationDetails: normalizedFoundation,
    movement: normalizedMovement,
  };
}

export function staticCourseDocument(): CourseDocument {
  const normalizedFoundation = Object.fromEntries(Object.entries(foundationDetails).map(([number, detail]) => [
    number,
    { ...detail, analysis: clone(detail.knowledge) },
  ])) as CourseDocument["foundationDetails"];
  return clone({
    schemaVersion: COURSE_DOCUMENT_SCHEMA_VERSION,
    lessonOutlines: staticLessonOutlines(),
    foundationDetails: normalizedFoundation,
    movement: { phases, analysisPhases: clone(phases), mistakes, practice, sessionPlan, questions },
  });
}

type EditableSectionPayload = Record<string, unknown>;

export function courseEditSectionFromDocument(document: CourseDocument, scope: CourseEditScope): EditableSectionPayload {
  const lessonNumber = scope.lessonNumber;
  const outline = document.lessonOutlines[lessonNumber];
  if (scope.section === "lesson") {
    return clone({
      outline,
      content: lessonNumber === "03"
        ? document.movement
        : document.foundationDetails[lessonNumber as Exclude<CourseLessonNumber, "03">],
    });
  }

  if (lessonNumber === "03") {
    if (scope.section === "content") return clone({ outline, phases: document.movement.phases });
    if (scope.section === "practice") return clone({ practice: document.movement.practice, sessionPlan: document.movement.sessionPlan });
    if (scope.section === "analysis") return clone({ analysisPhases: document.movement.analysisPhases });
    if (scope.section === "review") return clone({ mistakes: document.movement.mistakes });
    return clone({ questions: document.movement.questions });
  }

  const detail = document.foundationDetails[lessonNumber as Exclude<CourseLessonNumber, "03">];
  if (scope.section === "content") return clone({ outline, safety: detail.safety, knowledge: detail.knowledge, memory: detail.memory });
  if (scope.section === "practice") {
    return clone({
      drills: detail.drills,
      session: detail.session,
      practiceEyebrow: detail.practiceEyebrow,
      practiceTitle: detail.practiceTitle,
      practiceText: detail.practiceText,
      sessionEyebrow: detail.sessionEyebrow,
      sessionTitle: detail.sessionTitle,
      sessionText: detail.sessionText,
    });
  }
  if (scope.section === "analysis") return clone({ analysis: detail.analysis ?? detail.knowledge });
  if (scope.section === "review") return clone({ mistakes: detail.mistakes });
  return clone({ questions: detail.questions });
}

export function replaceCourseEditSection(document: CourseDocument, scope: CourseEditScope, payload: unknown) {
  const next = clone(document);
  const value = isRecord(payload) ? payload : {};
  const lessonNumber = scope.lessonNumber;

  if (scope.section === "lesson") {
    next.lessonOutlines[lessonNumber] = value.outline as CourseDocument["lessonOutlines"][CourseLessonNumber];
    if (lessonNumber === "03") next.movement = value.content as CourseDocument["movement"];
    else next.foundationDetails[lessonNumber as Exclude<CourseLessonNumber, "03">] = value.content as CourseDocument["foundationDetails"][Exclude<CourseLessonNumber, "03">];
    return next;
  }

  if (lessonNumber === "03") {
    if (scope.section === "content") {
      next.lessonOutlines[lessonNumber] = value.outline as CourseDocument["lessonOutlines"][CourseLessonNumber];
      next.movement.phases = value.phases as CourseDocument["movement"]["phases"];
    }
    else if (scope.section === "practice") {
      next.movement.practice = value.practice as CourseDocument["movement"]["practice"];
      next.movement.sessionPlan = value.sessionPlan as CourseDocument["movement"]["sessionPlan"];
    } else if (scope.section === "analysis") next.movement.analysisPhases = value.analysisPhases as CourseDocument["movement"]["analysisPhases"];
    else if (scope.section === "review") next.movement.mistakes = value.mistakes as CourseDocument["movement"]["mistakes"];
    else next.movement.questions = value.questions as CourseDocument["movement"]["questions"];
    return next;
  }

  const detail = next.foundationDetails[lessonNumber as Exclude<CourseLessonNumber, "03">];
  if (scope.section === "content") {
    next.lessonOutlines[lessonNumber] = value.outline as CourseDocument["lessonOutlines"][CourseLessonNumber];
    detail.safety = value.safety as typeof detail.safety;
    detail.knowledge = value.knowledge as typeof detail.knowledge;
    detail.memory = value.memory as string;
  } else if (scope.section === "practice") {
    detail.drills = value.drills as typeof detail.drills;
    detail.session = value.session as typeof detail.session;
    for (const key of ["practiceEyebrow", "practiceTitle", "practiceText", "sessionEyebrow", "sessionTitle", "sessionText"] as const) {
      if (typeof value[key] === "string") detail[key] = value[key];
    }
  } else if (scope.section === "analysis") detail.analysis = value.analysis as NonNullable<typeof detail.analysis>;
  else if (scope.section === "review") detail.mistakes = value.mistakes as typeof detail.mistakes;
  else detail.questions = value.questions as typeof detail.questions;
  return next;
}

export function parseCourseDocument(value: string): CourseDocument | null {
  try {
    const parsed = withDocumentDefaults(JSON.parse(value) as unknown);
    return validateCourseDocument(parsed).valid ? (parsed as CourseDocument) : null;
  } catch {
    return null;
  }
}

export async function publishedCourseDocument(database: Database) {
  const row = await database.prepare(
    `SELECT payload_json
       FROM course_content_versions
      WHERE status = 'published'
      ORDER BY version_number DESC LIMIT 1`,
  ).first<{ payload_json: string }>();
  return row ? parseCourseDocument(row.payload_json) ?? staticCourseDocument() : staticCourseDocument();
}

export function publicVersion(row: ContentVersionRow, includePayload = false): PublicContentVersion {
  const { payload_json, ...rest } = row;
  const reviewable = ["review", "published", "archived", "changes_requested"].includes(row.status);
  const scope = parseCourseEditScope(row.edit_scope);
  const metadata = {
    edit_lesson: scope?.lessonNumber ?? null,
    edit_section: scope?.section ?? null,
    edit_scope_label: scope?.label ?? null,
  };
  return includePayload && reviewable
    ? { ...rest, ...metadata, payload: parseCourseDocument(payload_json) ?? undefined }
    : { ...rest, ...metadata };
}

export async function listContentVersions(database: Database, includePayloadId?: string) {
  const result = await database.prepare(
    `SELECT id, version_number, status, payload_json, summary, created_by,
            editor_device_id, editor_device_code, edit_scope, permission_note,
            permission_reviewed_by, permission_reviewed_at, submitted_at,
            reviewed_by, reviewed_at, published_at, parent_version_id, created_at, updated_at
       FROM course_content_versions
      ORDER BY version_number DESC LIMIT 50`,
  ).all<ContentVersionRow>();
  return result.results.map((row: ContentVersionRow) => publicVersion(row, row.id === includePayloadId));
}

export async function listEditorContentVersions(
  database: Database,
  email: string,
  deviceId: string,
  includePayloadId?: string,
) {
  const result = await database.prepare(
    `SELECT id, version_number, status, payload_json, summary, created_by,
            editor_device_id, editor_device_code, edit_scope, permission_note,
            permission_reviewed_by, permission_reviewed_at, submitted_at,
            reviewed_by, reviewed_at, published_at, parent_version_id, created_at, updated_at
       FROM course_content_versions
      WHERE created_by = ? AND editor_device_id = ?
      ORDER BY version_number DESC LIMIT 20`,
  ).bind(email, deviceId).all<ContentVersionRow>();
  return result.results.map((row: ContentVersionRow) => publicVersion(row, row.id === includePayloadId));
}
