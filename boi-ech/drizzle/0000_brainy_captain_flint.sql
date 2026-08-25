CREATE TABLE `course_profiles` (
	`user_key` text PRIMARY KEY NOT NULL,
	`device_hash` text NOT NULL,
	`completed_json` text DEFAULT '[]' NOT NULL,
	`scores_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
