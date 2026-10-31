ALTER TABLE device_access ADD COLUMN management_enabled INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS training_resources (
 id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('building','room','class')),name TEXT NOT NULL COLLATE NOCASE,
 parent_id TEXT REFERENCES training_resources(id),capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 5000),
 required_teachers INTEGER NOT NULL DEFAULT 1 CHECK(required_teachers BETWEEN 1 AND 12),
 status TEXT NOT NULL CHECK(status IN ('active','unavailable','archived')),version INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(kind,name));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS training_sessions (
 id TEXT PRIMARY KEY,title TEXT NOT NULL,class_id TEXT NOT NULL REFERENCES training_resources(id),room_id TEXT NOT NULL REFERENCES training_resources(id),
 teacher_id TEXT NOT NULL REFERENCES device_access(device_id),starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('scheduled','completed','cancelled')),version INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,CHECK(starts_at<ends_at));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS training_sessions_interval ON training_sessions(status,starts_at,ends_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS training_commands(command_id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,payload_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS training_session_insert BEFORE INSERT ON training_sessions WHEN NEW.status!='cancelled' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM training_resources c,training_resources r,training_resources b,device_access t
 WHERE c.id=NEW.class_id AND c.kind='class' AND c.status='active'
 AND r.id=NEW.room_id AND r.kind='room' AND r.status='active' AND b.id=r.parent_id AND b.kind='building' AND b.status='active'
 AND t.device_id=NEW.teacher_id AND t.person_role='teacher' AND t.status='approved' AND t.registration_submitted_at IS NOT NULL
 AND (t.access_expires_at IS NULL OR datetime(t.access_expires_at)>CURRENT_TIMESTAMP)
 AND EXISTS(SELECT 1 FROM json_each('[' || replace(json_quote(replace(replace(COALESCE(t.class_name,''),',',';'),char(10),';')),';','","') || ']') AS class_token WHERE lower(trim(class_token.value,char(9)||char(13)||' '))=lower(c.name)))
 THEN RAISE(ABORT,'TRAINING_RESOURCE_UNAVAILABLE') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM training_sessions s WHERE s.id!=NEW.id AND s.status!='cancelled'
 AND NEW.starts_at<s.ends_at AND NEW.ends_at>s.starts_at AND (s.room_id=NEW.room_id OR s.class_id=NEW.class_id OR s.teacher_id=NEW.teacher_id))
 THEN RAISE(ABORT,'TRAINING_CONFLICT') END;
 SELECT CASE WHEN (SELECT COUNT(*) FROM device_access d JOIN training_resources c ON c.id=NEW.class_id
 WHERE d.person_role='learner' AND lower(trim(d.class_name))=lower(c.name) AND d.status='approved' AND d.registration_submitted_at IS NOT NULL
 AND (d.access_expires_at IS NULL OR datetime(d.access_expires_at)>CURRENT_TIMESTAMP))>
 (SELECT MIN(c.capacity,r.capacity) FROM training_resources c,training_resources r WHERE c.id=NEW.class_id AND r.id=NEW.room_id)
 THEN RAISE(ABORT,'TRAINING_CAPACITY') END;
 END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS training_session_update BEFORE UPDATE ON training_sessions WHEN NEW.status!='cancelled' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM training_resources c,training_resources r,training_resources b,device_access t
 WHERE c.id=NEW.class_id AND c.kind='class' AND c.status='active'
 AND r.id=NEW.room_id AND r.kind='room' AND r.status='active' AND b.id=r.parent_id AND b.kind='building' AND b.status='active'
 AND t.device_id=NEW.teacher_id AND t.person_role='teacher' AND t.status='approved' AND t.registration_submitted_at IS NOT NULL
 AND (t.access_expires_at IS NULL OR datetime(t.access_expires_at)>CURRENT_TIMESTAMP)
 AND EXISTS(SELECT 1 FROM json_each('[' || replace(json_quote(replace(replace(COALESCE(t.class_name,''),',',';'),char(10),';')),';','","') || ']') AS class_token WHERE lower(trim(class_token.value,char(9)||char(13)||' '))=lower(c.name)))
 THEN RAISE(ABORT,'TRAINING_RESOURCE_UNAVAILABLE') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM training_sessions s WHERE s.id!=NEW.id AND s.status!='cancelled'
 AND NEW.starts_at<s.ends_at AND NEW.ends_at>s.starts_at AND (s.room_id=NEW.room_id OR s.class_id=NEW.class_id OR s.teacher_id=NEW.teacher_id))
 THEN RAISE(ABORT,'TRAINING_CONFLICT') END;
 SELECT CASE WHEN (SELECT COUNT(*) FROM device_access d JOIN training_resources c ON c.id=NEW.class_id
 WHERE d.person_role='learner' AND lower(trim(d.class_name))=lower(c.name) AND d.status='approved' AND d.registration_submitted_at IS NOT NULL
 AND (d.access_expires_at IS NULL OR datetime(d.access_expires_at)>CURRENT_TIMESTAMP))>
 (SELECT MIN(c.capacity,r.capacity) FROM training_resources c,training_resources r WHERE c.id=NEW.class_id AND r.id=NEW.room_id)
 THEN RAISE(ABORT,'TRAINING_CAPACITY') END;
 END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS training_resource_guard BEFORE UPDATE ON training_resources BEGIN
 SELECT CASE WHEN OLD.kind!=NEW.kind THEN RAISE(ABORT,'TRAINING_RESOURCE_KIND') END;
 SELECT CASE WHEN OLD.kind='class' AND OLD.name!=NEW.name AND (EXISTS(SELECT 1 FROM device_access WHERE
 (person_role='learner' AND lower(trim(class_name))=lower(OLD.name)) OR (person_role='teacher' AND EXISTS(SELECT 1 FROM json_each('[' || replace(json_quote(replace(replace(COALESCE(class_name,''),',',';'),char(10),';')),';','","') || ']') AS class_token WHERE lower(trim(class_token.value,char(9)||char(13)||' '))=lower(OLD.name))))
 OR EXISTS(SELECT 1 FROM training_sessions WHERE class_id=OLD.id)) THEN RAISE(ABORT,'TRAINING_CLASS_NAME_IN_USE') END;
 SELECT CASE WHEN NEW.status!='active' AND EXISTS(SELECT 1 FROM training_sessions s JOIN training_resources r ON r.id=s.room_id
 WHERE s.status='scheduled' AND datetime(s.ends_at)>CURRENT_TIMESTAMP AND (s.class_id=NEW.id OR s.room_id=NEW.id OR r.parent_id=NEW.id))
 THEN RAISE(ABORT,'TRAINING_ACTIVE_BOOKINGS') END;
 SELECT CASE WHEN NEW.capacity<(SELECT COUNT(*) FROM device_access d WHERE d.person_role='learner' AND d.status='approved'
 AND d.registration_submitted_at IS NOT NULL AND lower(trim(d.class_name))=lower(CASE WHEN NEW.kind='class' THEN NEW.name ELSE '' END)
 AND (d.access_expires_at IS NULL OR datetime(d.access_expires_at)>CURRENT_TIMESTAMP))
 OR EXISTS(SELECT 1 FROM training_sessions s JOIN training_resources c ON c.id=s.class_id WHERE NEW.kind='room' AND s.room_id=NEW.id
 AND s.status='scheduled' AND datetime(s.ends_at)>CURRENT_TIMESTAMP AND NEW.capacity<(SELECT COUNT(*) FROM device_access d
 WHERE d.person_role='learner' AND d.status='approved' AND d.registration_submitted_at IS NOT NULL AND lower(trim(d.class_name))=lower(c.name)
 AND (d.access_expires_at IS NULL OR datetime(d.access_expires_at)>CURRENT_TIMESTAMP))) THEN RAISE(ABORT,'TRAINING_CAPACITY') END;
 SELECT CASE WHEN NEW.kind='room' AND NOT EXISTS(SELECT 1 FROM training_resources WHERE id=NEW.parent_id AND kind='building' AND status='active')
 THEN RAISE(ABORT,'TRAINING_RESOURCE_UNAVAILABLE') END;
 END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS training_person_class_guard BEFORE UPDATE OF class_name,status,person_role,access_expires_at,registration_submitted_at ON device_access
 WHEN NEW.class_name IS NOT OLD.class_name OR NEW.status IS NOT OLD.status OR NEW.person_role IS NOT OLD.person_role
 OR NEW.access_expires_at IS NOT OLD.access_expires_at OR NEW.registration_submitted_at IS NOT OLD.registration_submitted_at BEGIN
 SELECT CASE WHEN NEW.person_role='learner' AND NEW.status='approved' AND NEW.registration_submitted_at IS NOT NULL
 AND (NEW.access_expires_at IS NULL OR datetime(NEW.access_expires_at)>CURRENT_TIMESTAMP) AND EXISTS(SELECT 1 FROM training_resources c WHERE c.kind='class'
 AND lower(c.name)=lower(trim(NEW.class_name)) AND (c.status!='active' OR c.capacity<(SELECT COUNT(*)+1 FROM device_access d WHERE d.device_id!=NEW.device_id
 AND d.person_role='learner' AND d.status='approved' AND d.registration_submitted_at IS NOT NULL AND lower(trim(d.class_name))=lower(c.name)
 AND (d.access_expires_at IS NULL OR datetime(d.access_expires_at)>CURRENT_TIMESTAMP))
 OR EXISTS(SELECT 1 FROM training_sessions s JOIN training_resources r ON r.id=s.room_id WHERE s.class_id=c.id AND s.status='scheduled'
 AND datetime(s.ends_at)>CURRENT_TIMESTAMP AND r.capacity<(SELECT COUNT(*)+1 FROM device_access d WHERE d.device_id!=NEW.device_id
 AND d.person_role='learner' AND d.status='approved' AND d.registration_submitted_at IS NOT NULL AND lower(trim(d.class_name))=lower(c.name)
 AND (d.access_expires_at IS NULL OR datetime(d.access_expires_at)>CURRENT_TIMESTAMP))))) THEN RAISE(ABORT,'TRAINING_CAPACITY') END;
 SELECT CASE WHEN NEW.person_role='teacher' AND NEW.class_name IS NOT OLD.class_name AND EXISTS(SELECT 1 FROM training_sessions s JOIN training_resources c ON c.id=s.class_id
 WHERE s.teacher_id=NEW.device_id AND s.status='scheduled' AND datetime(s.ends_at)>CURRENT_TIMESTAMP
 AND NOT EXISTS(SELECT 1 FROM json_each('[' || replace(json_quote(replace(replace(COALESCE(NEW.class_name,''),',',';'),char(10),';')),';','","') || ']') AS class_token WHERE lower(trim(class_token.value,char(9)||char(13)||' '))=lower(c.name)))
 THEN RAISE(ABORT,'TRAINING_ACTIVE_BOOKINGS') END;
 END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS management_identity_guard AFTER UPDATE OF person_role,person_code ON device_access
WHEN NEW.person_role IS NOT OLD.person_role OR NEW.person_code IS NOT OLD.person_code
BEGIN UPDATE device_access SET management_enabled=0 WHERE device_id=NEW.device_id; END;
