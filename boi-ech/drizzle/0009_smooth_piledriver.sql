CREATE TABLE `payment_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`proof_key` text,
	`proof_name` text,
	`submitted_at` text NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`review_note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `payment_reviews_device_created_idx` ON `payment_reviews` (`device_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `payment_reviews_status_created_idx` ON `payment_reviews` (`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `course_activity_events` ADD `client_event_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `course_activity_client_event_unique` ON `course_activity_events` (`device_id`,`client_event_id`);--> statement-breakpoint
ALTER TABLE `device_access` ADD `payment_rejected_at` text;--> statement-breakpoint
ALTER TABLE `device_access` ADD `payment_review_note` text;--> statement-breakpoint
ALTER TABLE `device_access` ADD `updated_at` text;--> statement-breakpoint
UPDATE `device_access` SET `updated_at` = CURRENT_TIMESTAMP WHERE `updated_at` IS NULL;
