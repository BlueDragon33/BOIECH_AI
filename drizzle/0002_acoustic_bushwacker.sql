CREATE TABLE `course_activity_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_id` text NOT NULL,
	`event_type` text NOT NULL,
	`lesson_number` text,
	`part` text,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `course_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `course_content_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`version_number` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`payload_json` text NOT NULL,
	`summary` text,
	`created_by` text NOT NULL,
	`submitted_at` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`published_at` text,
	`parent_version_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `device_access` ADD `learner_name` text;--> statement-breakpoint
ALTER TABLE `device_access` ADD `access_expires_at` text;--> statement-breakpoint
ALTER TABLE `device_profiles` ADD `attempts_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `device_profiles` ADD `total_active_seconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `device_profiles` ADD `last_activity_at` text;--> statement-breakpoint
ALTER TABLE `device_profiles` ADD `last_lesson` text;--> statement-breakpoint
ALTER TABLE `device_profiles` ADD `last_part` text;