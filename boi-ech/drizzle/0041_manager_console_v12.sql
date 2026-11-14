-- Manager Console V12 — additive only; existing roster, sessions and device identity preserved.
-- Applied to existing boi-ech-db only after Preview evidence and Owner release authority.
CREATE TABLE IF NOT EXISTS training_class_leaders (
 class_id TEXT NOT NULL REFERENCES training_resources(id),
 slot TEXT NOT NULL CHECK(slot IN ('cadre','student')),
 source TEXT NOT NULL CHECK(source IN ('none','cadre','class','outside')),
 member_device_id TEXT REFERENCES device_access(device_id),
 display_name TEXT,
 birth_date TEXT,
 military_rank TEXT,
 battalion TEXT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(class_id,slot),
 CHECK(
   (source='none' AND member_device_id IS NULL AND display_name IS NULL)
   OR (slot='cadre' AND source='cadre' AND member_device_id IS NULL
     AND length(trim(COALESCE(display_name,'')))>0 AND length(trim(COALESCE(birth_date,'')))=10
     AND length(trim(COALESCE(military_rank,'')))>0 AND length(trim(COALESCE(battalion,'')))>0)
   OR (slot='student' AND source IN ('class','outside') AND length(trim(COALESCE(display_name,'')))>0)
 )
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS training_class_leader_history(
 id TEXT PRIMARY KEY,
 class_id TEXT NOT NULL,
 slot TEXT NOT NULL,
 previous_version INTEGER NOT NULL,
 previous_source TEXT NOT NULL,
 previous_member_device_id TEXT,
 previous_display_name TEXT,
 previous_birth_date TEXT,
 previous_military_rank TEXT,
 previous_battalion TEXT,
 replaced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS training_leader_history_class ON training_class_leader_history(class_id,slot,replaced_at);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS training_leader_insert_guard BEFORE INSERT ON training_class_leaders BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM training_resources c WHERE c.id=NEW.class_id AND c.kind='class' AND c.status='active')
  THEN RAISE(ABORT,'TRAINING_RESOURCE_UNAVAILABLE') END;
 SELECT CASE WHEN NEW.source='class' AND NOT EXISTS(
   SELECT 1 FROM device_access d JOIN training_resources c ON c.id=NEW.class_id
    WHERE d.device_id=NEW.member_device_id AND d.person_role='learner'
      AND d.status='approved' AND d.registration_submitted_at IS NOT NULL
      AND lower(trim(COALESCE(d.class_name,'')))=lower(c.name))
  THEN RAISE(ABORT,'TRAINING_LEADER_CLASS_MISMATCH') END;
 SELECT CASE WHEN NEW.source='outside' AND NEW.member_device_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM device_access d WHERE d.device_id=NEW.member_device_id AND d.person_role='learner'
     AND d.registration_submitted_at IS NOT NULL)
  THEN RAISE(ABORT,'TRAINING_PERSON_NOT_FOUND') END;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS training_leader_update_guard BEFORE UPDATE ON training_class_leaders BEGIN
 SELECT CASE WHEN OLD.class_id!=NEW.class_id OR OLD.slot!=NEW.slot THEN RAISE(ABORT,'TRAINING_LEADER_IMMUTABLE_KEY') END;
 SELECT CASE WHEN NEW.version!=OLD.version+1 THEN RAISE(ABORT,'TRAINING_VERSION_CONFLICT') END;
 SELECT CASE WHEN NEW.source='class' AND NOT EXISTS(
   SELECT 1 FROM device_access d JOIN training_resources c ON c.id=NEW.class_id
    WHERE d.device_id=NEW.member_device_id AND d.person_role='learner'
      AND d.status='approved' AND d.registration_submitted_at IS NOT NULL
      AND lower(trim(COALESCE(d.class_name,'')))=lower(c.name))
  THEN RAISE(ABORT,'TRAINING_LEADER_CLASS_MISMATCH') END;
 SELECT CASE WHEN NEW.source='outside' AND NEW.member_device_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM device_access d WHERE d.device_id=NEW.member_device_id AND d.person_role='learner'
     AND d.registration_submitted_at IS NOT NULL)
  THEN RAISE(ABORT,'TRAINING_PERSON_NOT_FOUND') END;
 INSERT INTO training_class_leader_history(id,class_id,slot,previous_version,previous_source,previous_member_device_id,
  previous_display_name,previous_birth_date,previous_military_rank,previous_battalion)
 VALUES(lower(hex(randomblob(16))),OLD.class_id,OLD.slot,OLD.version,OLD.source,OLD.member_device_id,
  OLD.display_name,OLD.birth_date,OLD.military_rank,OLD.battalion);
END;
--> statement-breakpoint
-- Revoking or transferring a student account must NEVER be blocked by a class title.
-- Demote its title to a provisional external contact instead, with retained audit history.
CREATE TRIGGER IF NOT EXISTS training_leader_student_class_guard AFTER UPDATE OF class_name,person_role,status ON device_access
 WHEN EXISTS(SELECT 1 FROM training_class_leaders l JOIN training_resources c ON c.id=l.class_id
    WHERE l.slot='student' AND l.source='class' AND l.member_device_id=NEW.device_id
     AND (NEW.person_role!='learner' OR NEW.status!='approved'
     OR lower(trim(COALESCE(NEW.class_name,'')))!=lower(c.name)))
 BEGIN
  UPDATE training_class_leaders
   SET source='outside',member_device_id=CASE WHEN NEW.person_role='learner' THEN NEW.device_id ELSE NULL END,
       version=version+1,updated_at=CURRENT_TIMESTAMP
   WHERE slot='student' AND source='class' AND member_device_id=NEW.device_id;
 END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS training_leader_class_rename_guard BEFORE UPDATE OF name ON training_resources
 WHEN NEW.kind='class' AND OLD.name!=NEW.name
  AND EXISTS(SELECT 1 FROM training_class_leaders WHERE class_id=OLD.id AND source!='none')
 BEGIN SELECT RAISE(ABORT,'TRAINING_CLASS_NAME_IN_USE'); END;
--> statement-breakpoint
ALTER TABLE training_sessions ADD COLUMN assistant_teacher_id TEXT REFERENCES device_access(device_id);
--> statement-breakpoint
ALTER TABLE training_sessions ADD COLUMN period_start INTEGER CHECK(period_start BETWEEN 1 AND 24);
--> statement-breakpoint
ALTER TABLE training_sessions ADD COLUMN period_end INTEGER CHECK(period_end BETWEEN 1 AND 24);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS training_periods (
 number INTEGER PRIMARY KEY CHECK(number BETWEEN 1 AND 24),
 start_time TEXT NOT NULL CHECK(length(start_time)=5),
 end_time TEXT NOT NULL CHECK(length(end_time)=5),
 timezone TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(start_time<end_time)
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS training_session_v12_insert BEFORE INSERT ON training_sessions WHEN NEW.status!='cancelled' BEGIN
 SELECT CASE WHEN (NEW.period_start IS NULL)!=(NEW.period_end IS NULL)
   OR (NEW.period_start IS NOT NULL AND NEW.period_start>NEW.period_end)
  THEN RAISE(ABORT,'TRAINING_PERIOD_INVALID') END;
 SELECT CASE WHEN NEW.assistant_teacher_id IS NOT NULL AND
  (NEW.assistant_teacher_id=NEW.teacher_id OR NOT EXISTS(
    SELECT 1 FROM device_access d JOIN training_resources c ON c.id=NEW.class_id
    WHERE d.device_id=NEW.assistant_teacher_id AND d.person_role='teacher' AND d.status='approved'
      AND d.registration_submitted_at IS NOT NULL
      AND (d.access_expires_at IS NULL OR datetime(d.access_expires_at)>CURRENT_TIMESTAMP)
      AND EXISTS(SELECT 1 FROM json_each('[' || replace(json_quote(replace(replace(COALESCE(d.class_name,''),',',';'),char(10),';')),';','","') || ']') AS token
       WHERE lower(trim(token.value))=lower(c.name))))
  THEN RAISE(ABORT,'TRAINING_RESOURCE_UNAVAILABLE') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM training_sessions s
  WHERE s.id!=NEW.id AND s.status!='cancelled' AND NEW.starts_at<s.ends_at AND NEW.ends_at>s.starts_at
  AND (s.assistant_teacher_id=NEW.teacher_id OR
    (NEW.assistant_teacher_id IS NOT NULL AND (s.teacher_id=NEW.assistant_teacher_id OR s.assistant_teacher_id=NEW.assistant_teacher_id))))
  THEN RAISE(ABORT,'TRAINING_CONFLICT') END;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS training_session_v12_update BEFORE UPDATE ON training_sessions WHEN NEW.status!='cancelled' BEGIN
 SELECT CASE WHEN (NEW.period_start IS NULL)!=(NEW.period_end IS NULL)
   OR (NEW.period_start IS NOT NULL AND NEW.period_start>NEW.period_end)
  THEN RAISE(ABORT,'TRAINING_PERIOD_INVALID') END;
 SELECT CASE WHEN NEW.assistant_teacher_id IS NOT NULL AND
  (NEW.assistant_teacher_id=NEW.teacher_id OR NOT EXISTS(
    SELECT 1 FROM device_access d JOIN training_resources c ON c.id=NEW.class_id
    WHERE d.device_id=NEW.assistant_teacher_id AND d.person_role='teacher' AND d.status='approved'
      AND d.registration_submitted_at IS NOT NULL
      AND (d.access_expires_at IS NULL OR datetime(d.access_expires_at)>CURRENT_TIMESTAMP)
      AND EXISTS(SELECT 1 FROM json_each('[' || replace(json_quote(replace(replace(COALESCE(d.class_name,''),',',';'),char(10),';')),';','","') || ']') AS token
       WHERE lower(trim(token.value))=lower(c.name))))
  THEN RAISE(ABORT,'TRAINING_RESOURCE_UNAVAILABLE') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM training_sessions s
  WHERE s.id!=NEW.id AND s.status!='cancelled' AND NEW.starts_at<s.ends_at AND NEW.ends_at>s.starts_at
  AND (s.assistant_teacher_id=NEW.teacher_id OR
    (NEW.assistant_teacher_id IS NOT NULL AND (s.teacher_id=NEW.assistant_teacher_id OR s.assistant_teacher_id=NEW.assistant_teacher_id))))
  THEN RAISE(ABORT,'TRAINING_CONFLICT') END;
END;
--> statement-breakpoint
-- Never block emergency account revocation or change of role; guard only unsafe class reassignment.\nCREATE TRIGGER IF NOT EXISTS training_assistant_assignment_guard BEFORE UPDATE OF class_name ON device_access
 WHEN EXISTS(SELECT 1 FROM training_sessions s JOIN training_resources c ON c.id=s.class_id
  WHERE s.assistant_teacher_id=NEW.device_id AND s.status='scheduled' AND datetime(s.ends_at)>CURRENT_TIMESTAMP
    AND (NEW.person_role!='teacher' OR NEW.status!='approved'
     OR NOT EXISTS(SELECT 1 FROM json_each('[' || replace(json_quote(replace(replace(COALESCE(NEW.class_name,''),',',';'),char(10),';')),';','","') || ']') AS token
      WHERE lower(trim(token.value))=lower(c.name))))
 BEGIN SELECT RAISE(ABORT,'TRAINING_ACTIVE_BOOKINGS'); END;
