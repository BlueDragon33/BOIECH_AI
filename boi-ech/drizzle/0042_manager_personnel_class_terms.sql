-- V40 manager personnel: an explicit, audit-safe class-assignment timeline.
-- Do not backfill the first assignment date for existing class_name values: unknown stays unknown.
-- Recorded device types come from device_access, never a real-time device presence assertion.
CREATE TABLE IF NOT EXISTS training_teacher_class_terms (
 teacher_device_id TEXT NOT NULL REFERENCES device_access(device_id),
 class_id TEXT NOT NULL REFERENCES training_resources(id),
 started_at TEXT NOT NULL,
 planned_end_at TEXT,
 ended_at TEXT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(teacher_device_id,class_id),
 CHECK(planned_end_at IS NULL OR julianday(planned_end_at)>julianday(started_at))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS training_teacher_class_terms_by_class ON training_teacher_class_terms(class_id,ended_at);
--> statement-breakpoint
-- Assignment timestamps are written only by the audited manager `assign-person`
-- transaction after successful CAS. Normal teacher profile edits never create
-- an assignment timestamp; historical `class_name` rows remain unknown.
