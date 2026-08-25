import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const courseProfiles = sqliteTable("course_profiles", {
  userKey: text("user_key").primaryKey(),
  deviceHash: text("device_hash").notNull(),
  completedJson: text("completed_json").notNull().default("[]"),
  scoresJson: text("scores_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const deviceAccess = sqliteTable("device_access", {
  deviceId: text("device_id").primaryKey(),
  displayCode: text("display_code").notNull().unique(),
  publicKeyJwk: text("public_key_jwk").notNull(),
  status: text("status").notNull().default("pending"),
  label: text("label"),
  learnerName: text("learner_name"),
  learnerFamilyName: text("learner_family_name"),
  learnerGivenName: text("learner_given_name"),
  personRole: text("person_role"),
  personCode: text("person_code"),
  className: text("class_name"),
  phone: text("phone").unique(),
  registrationSubmittedAt: text("registration_submitted_at"),
  accessGroup: text("access_group").notNull().default("unassigned"),
  paymentStatus: text("payment_status").notNull().default("unassigned"),
  paymentProofKey: text("payment_proof_key"),
  paymentProofName: text("payment_proof_name"),
  paymentProofContentType: text("payment_proof_content_type"),
  paymentProofSize: integer("payment_proof_size"),
  paymentSubmittedAt: text("payment_submitted_at"),
  paymentVerifiedAt: text("payment_verified_at"),
  paymentRejectedAt: text("payment_rejected_at"),
  paymentReviewNote: text("payment_review_note"),
  accessExpiresAt: text("access_expires_at"),
  personalEditEnabled: integer("personal_edit_enabled").notNull().default(0),
  autoConfirmedAt: text("auto_confirmed_at"),
  migratedFromUserKey: text("migrated_from_user_key"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  approvedAt: text("approved_at"),
  blockedAt: text("blocked_at"),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at"),
}, (table) => [
  uniqueIndex("device_access_person_identity_unique").on(table.personRole, table.personCode),
]);

export const accessAutomationSettings = sqliteTable("access_automation_settings", {
  id: text("id").primaryKey(),
  autoConfirmNewDevices: integer("auto_confirm_new_devices").notNull().default(1),
  autoEnableTeacherLocalEdit: integer("auto_enable_teacher_local_edit").notNull().default(1),
  defaultAccessDays: integer("default_access_days").notNull().default(60),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const deviceProfiles = sqliteTable("device_profiles", {
  deviceId: text("device_id").primaryKey(),
  completedJson: text("completed_json").notNull().default("[]"),
  scoresJson: text("scores_json").notNull().default("{}"),
  attemptsJson: text("attempts_json").notNull().default("{}"),
  totalActiveSeconds: integer("total_active_seconds").notNull().default(0),
  lastActivityAt: text("last_activity_at"),
  lastLesson: text("last_lesson"),
  lastPart: text("last_part"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const deviceChallenges = sqliteTable("device_challenges", {
  nonce: text("nonce").primaryKey(),
  deviceId: text("device_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const contentEditorDevices = sqliteTable("content_editor_devices", {
  deviceId: text("device_id").primaryKey(),
  displayCode: text("display_code").notNull().unique(),
  publicKeyJwk: text("public_key_jwk").notNull(),
  email: text("email").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("content_editor_devices_email_idx").on(table.email),
]);

export const contentEditorChallenges = sqliteTable("content_editor_challenges", {
  nonce: text("nonce").primaryKey(),
  deviceId: text("device_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const courseActivityEvents = sqliteTable("course_activity_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: text("device_id").notNull(),
  eventType: text("event_type").notNull(),
  lessonNumber: text("lesson_number"),
  part: text("part"),
  detailJson: text("detail_json").notNull().default("{}"),
  clientEventId: text("client_event_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("course_activity_device_created_idx").on(table.deviceId, table.createdAt),
  uniqueIndex("course_activity_client_event_unique").on(table.deviceId, table.clientEventId),
]);

export const paymentReviews = sqliteTable("payment_reviews", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  status: text("status").notNull().default("submitted"),
  proofKey: text("proof_key"),
  proofName: text("proof_name"),
  submittedAt: text("submitted_at").notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  reviewNote: text("review_note"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("payment_reviews_device_created_idx").on(table.deviceId, table.createdAt),
  index("payment_reviews_status_created_idx").on(table.status, table.createdAt),
]);

export const courseContentVersions = sqliteTable("course_content_versions", {
  id: text("id").primaryKey(),
  versionNumber: integer("version_number").notNull(),
  status: text("status").notNull().default("draft"),
  payloadJson: text("payload_json").notNull(),
  summary: text("summary"),
  createdBy: text("created_by").notNull(),
  editorDeviceId: text("editor_device_id"),
  editorDeviceCode: text("editor_device_code"),
  editScope: text("edit_scope"),
  permissionNote: text("permission_note"),
  permissionReviewedBy: text("permission_reviewed_by"),
  permissionReviewedAt: text("permission_reviewed_at"),
  submittedAt: text("submitted_at"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  publishedAt: text("published_at"),
  parentVersionId: text("parent_version_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("course_content_status_version_idx").on(table.status, table.versionNumber),
  uniqueIndex("course_content_version_number_unique").on(table.versionNumber),
]);

export const courseAuditLog = sqliteTable("course_audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  detailJson: text("detail_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const aiSettings = sqliteTable("ai_settings", {
  id: text("id").primaryKey(),
  enabled: integer("enabled").notNull().default(1),
  tutorEnabled: integer("tutor_enabled").notNull().default(1),
  adaptiveEnabled: integer("adaptive_enabled").notNull().default(1),
  contentAssistantEnabled: integer("content_assistant_enabled").notNull().default(1),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const aiDeviceControls = sqliteTable("ai_device_controls", {
  deviceId: text("device_id").primaryKey(),
  enabled: integer("enabled").notNull().default(1),
  reason: text("reason"),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const aiInteractions = sqliteTable("ai_interactions", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  kind: text("kind").notNull(),
  lessonNumber: text("lesson_number"),
  section: text("section"),
  queryText: text("query_text"),
  responseJson: text("response_json").notNull(),
  sourceRefsJson: text("source_refs_json").notNull().default("[]"),
  engineVersion: text("engine_version").notNull(),
  promptVersion: text("prompt_version").notNull(),
  durationMs: integer("duration_ms").notNull().default(0),
  inputUnits: integer("input_units").notNull().default(0),
  outputUnits: integer("output_units").notNull().default(0),
  costMicros: integer("cost_micros").notNull().default(0),
  status: text("status").notNull().default("completed"),
  teacherRating: text("teacher_rating"),
  teacherReviewedBy: text("teacher_reviewed_by"),
  teacherReviewedAt: text("teacher_reviewed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("ai_interactions_subject_created_idx").on(table.subjectId, table.createdAt),
  index("ai_interactions_kind_created_idx").on(table.kind, table.createdAt),
]);

export const aiFeedback = sqliteTable("ai_feedback", {
  id: text("id").primaryKey(),
  interactionId: text("interaction_id").notNull(),
  deviceId: text("device_id").notNull(),
  rating: text("rating").notNull(),
  note: text("note"),
  status: text("status").notNull().default("open"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("ai_feedback_status_created_idx").on(table.status, table.createdAt),
  uniqueIndex("ai_feedback_interaction_device_unique").on(table.interactionId, table.deviceId),
]);

export const learnerSelfAssessments = sqliteTable("learner_self_assessments", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  lessonNumber: text("lesson_number").notNull(),
  section: text("section").notNull(),
  rating: integer("rating").notNull(),
  confidence: integer("confidence").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("learner_self_assessments_device_created_idx").on(table.deviceId, table.createdAt),
]);

export const aiQuizSessions = sqliteTable("ai_quiz_sessions", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  questionRefsJson: text("question_refs_json").notNull(),
  status: text("status").notNull().default("active"),
  score: integer("score"),
  passed: integer("passed"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  submittedAt: text("submitted_at"),
}, (table) => [
  index("ai_quiz_sessions_device_created_idx").on(table.deviceId, table.createdAt),
]);

export const courseCertificates = sqliteTable("course_certificates", {
  id: text("id").primaryKey(),
  verificationCode: text("verification_code").notNull().unique(),
  deviceId: text("device_id").notNull(),
  deviceCode: text("device_code").notNull(),
  learnerName: text("learner_name").notNull(),
  className: text("class_name").notNull(),
  scoresJson: text("scores_json").notNull(),
  totalActiveSeconds: integer("total_active_seconds").notNull().default(0),
  completedAt: text("completed_at").notNull(),
  courseVersion: integer("course_version").notNull(),
  issuedAt: text("issued_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("course_certificates_device_unique").on(table.deviceId),
  index("course_certificates_issued_idx").on(table.issuedAt),
]);
