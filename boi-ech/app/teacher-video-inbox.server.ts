import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";

/** Only references to an existing authorized learner event; never media or grades. */
const assignedClassSql = `EXISTS(
 SELECT 1 FROM json_each(
  '[' || replace(json_quote(replace(replace(COALESCE(teacher.class_name,''),',',';'),char(10),';')),';','","') || ']'
 ) AS listed WHERE lower(trim(listed.value))=lower(trim(learner.class_name))
)`;
const activeLearnerSql=`(
 EXISTS(SELECT 1 FROM accounts account
   JOIN account_onboarding onboard ON onboard.account_id=account.account_id
   JOIN account_entitlements entitlement ON entitlement.account_id=account.account_id
   WHERE account.storage_device_id=learner.device_id AND onboard.stage='active'
     AND entitlement.state='active' AND datetime(entitlement.expires_at)>CURRENT_TIMESTAMP)
 OR (NOT EXISTS(SELECT 1 FROM accounts account WHERE account.storage_device_id=learner.device_id)
   AND (learner.access_expires_at IS NULL OR datetime(learner.access_expires_at)>CURRENT_TIMESTAMP))
)`;
const activeTeacherSql=`(
 EXISTS(SELECT 1 FROM accounts account
   JOIN account_onboarding onboard ON onboard.account_id=account.account_id
   JOIN account_entitlements entitlement ON entitlement.account_id=account.account_id
   WHERE account.storage_device_id=teacher.device_id AND onboard.stage='active'
     AND entitlement.state='active' AND datetime(entitlement.expires_at)>CURRENT_TIMESTAMP)
 OR (NOT EXISTS(SELECT 1 FROM accounts account WHERE account.storage_device_id=teacher.device_id)
   AND (teacher.access_expires_at IS NULL OR datetime(teacher.access_expires_at)>CURRENT_TIMESTAMP))
)`;

/**
 * This prepared statement is executed in the SAME atomic D1 batch as the
 * video_ai_analysis INSERT. The event's unique client ID gates the fanout.
 * Every recipient must be an active, registered teacher assigned to the
 * learner's current class. No background worker or external push provider.
 */
export function enqueueVideoForAssignedTeachers(db:D1Database,learnerDeviceId:string,clientEventId:string):D1PreparedStatement{
 return db.prepare(`INSERT OR IGNORE INTO teacher_video_inbox
   (teacher_device_id,video_event_id,state,revision)
 SELECT teacher.device_id,source.id,'unread',1
 FROM course_activity_events source
 JOIN device_access learner ON learner.device_id=source.device_id
 JOIN device_access teacher ON teacher.person_role='teacher'
 WHERE source.device_id=? AND source.client_event_id=? AND source.event_type='video_ai_analysis'
 AND learner.person_role='learner' AND learner.status='approved'
 AND learner.registration_submitted_at IS NOT NULL
 AND ${activeLearnerSql}
 AND teacher.status='approved' AND teacher.registration_submitted_at IS NOT NULL
 AND ${activeTeacherSql} AND ${assignedClassSql}`)
 .bind(learnerDeviceId,clientEventId);
}

/**
 * Replay-safe catch-up for classes assigned after the learner sent a video.
 * Caller MUST have verified the teacher's signed session and current class
 * names. This only inserts references to events of active learners currently
 * in those classes and never changes already-seen receipts.
 */
export function syncTeacherVideoInbox(db:D1Database,teacherDeviceId:string,teacherClasses:string[]):D1PreparedStatement{
 if(!teacherClasses.length||teacherClasses.length>12)throw new Error("TEACHER_CLASS_REQUIRED");
 const scoped=teacherClasses.map(()=>"lower(trim(?))").join(",");
 return db.prepare(`INSERT OR IGNORE INTO teacher_video_inbox
 (teacher_device_id,video_event_id,state,revision)
 SELECT ?,source.id,'unread',1 FROM course_activity_events source
 JOIN device_access learner ON learner.device_id=source.device_id
 WHERE learner.person_role='learner' AND learner.status='approved'
 AND learner.registration_submitted_at IS NOT NULL
 AND ${activeLearnerSql}
 AND lower(trim(learner.class_name)) IN (${scoped})
 AND source.event_type='video_ai_analysis'
 ORDER BY source.id DESC LIMIT 250`)
 .bind(teacherDeviceId,...teacherClasses);
}

export type VideoReceipt={eventId:number;state:"unread"|"seen";revision:number;createdAt:string};
export async function readTeacherVideoInbox(
 db:D1Database,teacherDeviceId:string,teacherClasses:string[],limit=80,
):Promise<{items:VideoReceipt[];possiblyTruncated:boolean}>{
 if(!teacherClasses.length||teacherClasses.length>12)throw new Error("TEACHER_CLASS_REQUIRED");
 const scoped=teacherClasses.map(()=>"lower(trim(?))").join(",");
 const cap=Math.max(1,Math.min(80,Math.floor(limit)||80));
 const result=await db.prepare(`SELECT receipt.video_event_id AS eventId,receipt.state,
  receipt.revision,source.created_at AS createdAt
 FROM teacher_video_inbox receipt
 JOIN course_activity_events source ON source.id=receipt.video_event_id AND source.event_type='video_ai_analysis'
 JOIN device_access learner ON learner.device_id=source.device_id
 WHERE receipt.teacher_device_id=?
 AND learner.person_role='learner' AND learner.status='approved'
 AND learner.registration_submitted_at IS NOT NULL
 AND ${activeLearnerSql}
 AND lower(trim(learner.class_name)) IN (${scoped})
 ORDER BY source.id DESC LIMIT ?`).bind(teacherDeviceId,...teacherClasses,cap+1).all<VideoReceipt>();
 const rows=result.results??[];
 return {items:rows.slice(0,cap),possiblyTruncated:rows.length>cap};
}
export async function markTeacherVideoSeen(input:{
 db:D1Database;teacherDeviceId:string;teacherClasses:string[];
 eventId:number;expectedRevision:number;
}):Promise<{ok:boolean;code:"OK"|"ALREADY_SEEN"|"CONFLICT_OR_OUT_OF_SCOPE";revision:number|null}>{
 const {db,teacherDeviceId,teacherClasses,eventId,expectedRevision}=input;
 if(!teacherClasses.length||teacherClasses.length>12||!Number.isSafeInteger(eventId)||eventId<1||
 !Number.isSafeInteger(expectedRevision)||expectedRevision<1)throw new Error("INVALID_INBOX_ACTION");
 const scoped=teacherClasses.map(()=>"lower(trim(?))").join(",");
 const scope=`EXISTS(SELECT 1 FROM course_activity_events source
  JOIN device_access learner ON learner.device_id=source.device_id
  WHERE source.id=teacher_video_inbox.video_event_id AND source.event_type='video_ai_analysis'
  AND learner.person_role='learner' AND learner.status='approved'
  AND learner.registration_submitted_at IS NOT NULL
 AND ${activeLearnerSql}
  AND lower(trim(learner.class_name)) IN (${scoped}))`;
 const result=await db.prepare(`UPDATE teacher_video_inbox
  SET state='seen',revision=revision+1,updated_at=CURRENT_TIMESTAMP
  WHERE teacher_device_id=? AND video_event_id=? AND state='unread'
  AND revision=? AND ${scope}`)
 .bind(teacherDeviceId,eventId,expectedRevision,...teacherClasses).run();
 if(result.meta?.changes===1)return {ok:true,code:"OK",revision:expectedRevision+1};
 const existing=await db.prepare(`SELECT receipt.revision,receipt.state FROM teacher_video_inbox receipt
 JOIN course_activity_events source ON source.id=receipt.video_event_id AND source.event_type='video_ai_analysis'
 JOIN device_access learner ON learner.device_id=source.device_id
 WHERE receipt.teacher_device_id=? AND receipt.video_event_id=?
 AND learner.person_role='learner' AND learner.status='approved'
 AND learner.registration_submitted_at IS NOT NULL
 AND ${activeLearnerSql}
 AND lower(trim(learner.class_name)) IN (${scoped})`)
 .bind(teacherDeviceId,eventId,...teacherClasses).first<{revision:number;state:string}>();
 if(existing?.state==="seen")return {ok:true,code:"ALREADY_SEEN",revision:existing.revision};
 return {ok:false,code:"CONFLICT_OR_OUT_OF_SCOPE",revision:existing?.revision??null};
}
