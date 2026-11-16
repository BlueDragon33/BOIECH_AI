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
-- Capture a new allocation made after this migration, without claiming older
-- teacher allocations existed since signup or a historic timetable entry.
CREATE TRIGGER IF NOT EXISTS training_teacher_class_terms_update
AFTER UPDATE OF class_name ON device_access
WHEN NEW.person_role='teacher' AND COALESCE(NEW.class_name,'')<>COALESCE(OLD.class_name,'')
BEGIN
  UPDATE training_teacher_class_terms SET
    ended_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
    version=version+1,updated_at=CURRENT_TIMESTAMP
  WHERE teacher_device_id=NEW.device_id AND ended_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM training_resources c
      WHERE c.id=training_teacher_class_terms.class_id AND c.kind='class'
      AND EXISTS (
        SELECT 1 FROM json_each('[' || replace(json_quote(replace(replace(COALESCE(NEW.class_name,''),char(10),';'),',',';')),';','","') || ']') token
        WHERE lower(trim(token.value))=lower(c.name)
      )
    );
  INSERT INTO training_teacher_class_terms(teacher_device_id,class_id,started_at,planned_end_at,ended_at,version)
  SELECT NEW.device_id,c.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NULL,NULL,1
  FROM training_resources c
  WHERE c.kind='class' AND c.status='active'
    AND EXISTS (
      SELECT 1 FROM json_each('[' || replace(json_quote(replace(replace(COALESCE(NEW.class_name,''),char(10),';'),',',';')),';','","') || ']') token
      WHERE lower(trim(token.value))=lower(c.name)
    )
    AND NOT EXISTS (
      SELECT 1 FROM json_each('[' || replace(json_quote(replace(replace(COALESCE(OLD.class_name,''),char(10),';'),',',';')),';','","') || ']') token
      WHERE lower(trim(token.value))=lower(c.name)
    )
  ON CONFLICT(teacher_device_id,class_id) DO UPDATE SET
    started_at=excluded.started_at,planned_end_at=NULL,ended_at=NULL,
    version=training_teacher_class_terms.version+1,updated_at=CURRENT_TIMESTAMP;
END;
