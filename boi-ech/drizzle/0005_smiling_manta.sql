CREATE TABLE `content_editor_challenges` (
	`nonce` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `content_editor_devices` (
	`device_id` text PRIMARY KEY NOT NULL,
	`display_code` text NOT NULL,
	`public_key_jwk` text NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_editor_devices_display_code_unique` ON `content_editor_devices` (`display_code`);--> statement-breakpoint
CREATE INDEX `content_editor_devices_email_idx` ON `content_editor_devices` (`email`);--> statement-breakpoint
ALTER TABLE `course_content_versions` ADD `editor_device_id` text;--> statement-breakpoint
ALTER TABLE `course_content_versions` ADD `editor_device_code` text;--> statement-breakpoint
ALTER TABLE `course_content_versions` ADD `edit_scope` text;--> statement-breakpoint
ALTER TABLE `course_content_versions` ADD `permission_note` text;--> statement-breakpoint
ALTER TABLE `course_content_versions` ADD `permission_reviewed_by` text;--> statement-breakpoint
ALTER TABLE `course_content_versions` ADD `permission_reviewed_at` text;