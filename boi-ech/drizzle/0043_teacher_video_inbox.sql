-- V43: minimal, media-free, per-teacher video notification receipt.
-- This table does NOT store frames, images, video, scores, or name/profile data.
-- Authorization is always checked at read/update against live class membership.
CREATE TABLE IF NOT EXISTS teacher_video_inbox (
  teacher_device_id TEXT NOT NULL REFERENCES device_access(device_id),
  video_event_id INTEGER NOT NULL REFERENCES course_activity_events(id),
  state TEXT NOT NULL DEFAULT 'unread' CHECK (state IN ('unread','seen')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (teacher_device_id,video_event_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS teacher_video_inbox_teacher_state
  ON teacher_video_inbox(teacher_device_id,state,video_event_id DESC);
--> statement-breakpoint
