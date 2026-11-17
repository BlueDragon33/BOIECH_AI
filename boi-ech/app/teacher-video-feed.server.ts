import type {D1Database} from "@cloudflare/workers-types";

/**
 * A separately bounded, class-scoped VIDEO source. The teacher's authenticated
 * classes and already-visible learner device IDs must come from the canonical
 * server overview, never from an arbitrary browser-submitted list.
 *
 * A generic learning-event LIMIT includes heartbeats and assignments, so it
 * can starve an older video completely. This query reads video events only.
 * It returns event JSON already stored by video analysis; no video bytes.
 */
export type TeacherVideoEventRow={
 id:number;device_id:string;event_type:"video_ai_analysis";
 lesson_number:string|null;part:string|null;detail_json:string;created_at:string;
};
export async function loadTeacherScopedVideoEvents(
 db:D1Database,teacherClasses:readonly string[],visibleLearnerIds:readonly string[],limit=80,
):Promise<{events:TeacherVideoEventRow[];possiblyTruncated:boolean}>{
 const classes=[...new Set(teacherClasses.map(x=>x.trim()).filter(Boolean))];
 const learnerIds=[...new Set(visibleLearnerIds.map(x=>x.trim()).filter(Boolean))];
 if(!classes.length||classes.length>12||learnerIds.length>200){
  throw new Error("VIDEO_FEED_SCOPE_REQUIRED");
 }
 if(!learnerIds.length)return {events:[],possiblyTruncated:false};
 const cap=Math.max(1,Math.min(80,Number.isFinite(limit)?Math.floor(limit):80));
 const classClause=classes.map(()=>"lower(trim(?))").join(",");
 const learnerClause=learnerIds.map(()=>"?").join(",");
 const rows=await db.prepare(`SELECT e.id,e.device_id,e.event_type,e.lesson_number,e.part,
  e.detail_json,e.created_at
 FROM course_activity_events e
 JOIN device_access learner ON learner.device_id=e.device_id
 WHERE learner.person_role='learner' AND learner.status='approved'
 AND learner.registration_submitted_at IS NOT NULL
 AND lower(trim(learner.class_name)) IN (${classClause})
 AND learner.device_id IN (${learnerClause})
 AND e.event_type='video_ai_analysis'
 ORDER BY e.id DESC LIMIT ?`)
 .bind(...classes,...learnerIds,cap+1).all<TeacherVideoEventRow>();
 const events=rows.results??[];
 return {events:events.slice(0,cap),possiblyTruncated:events.length>cap};
}
