CREATE TABLE `access_automation_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`auto_confirm_new_devices` integer DEFAULT 1 NOT NULL,
	`default_access_days` integer DEFAULT 60 NOT NULL,
	`updated_by` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `course_certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`verification_code` text NOT NULL,
	`device_id` text NOT NULL,
	`device_code` text NOT NULL,
	`learner_name` text NOT NULL,
	`class_name` text NOT NULL,
	`scores_json` text NOT NULL,
	`total_active_seconds` integer DEFAULT 0 NOT NULL,
	`completed_at` text NOT NULL,
	`course_version` integer NOT NULL,
	`issued_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_certificates_verification_code_unique` ON `course_certificates` (`verification_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `course_certificates_device_unique` ON `course_certificates` (`device_id`);--> statement-breakpoint
CREATE INDEX `course_certificates_issued_idx` ON `course_certificates` (`issued_at`);--> statement-breakpoint
ALTER TABLE `device_access` ADD `personal_edit_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `device_access` ADD `auto_confirmed_at` text;