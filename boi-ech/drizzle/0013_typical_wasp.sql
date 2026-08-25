CREATE TABLE `device_deletion_tombstones` (
	`device_id` text PRIMARY KEY NOT NULL,
	`display_code` text NOT NULL,
	`reason` text DEFAULT 'spam' NOT NULL,
	`learner_name` text,
	`deleted_by` text NOT NULL,
	`deleted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_deletion_tombstones_display_code_unique` ON `device_deletion_tombstones` (`display_code`);