CREATE TABLE `device_access` (
	`device_id` text PRIMARY KEY NOT NULL,
	`display_code` text NOT NULL,
	`public_key_jwk` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`label` text,
	`migrated_from_user_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`approved_at` text,
	`blocked_at` text,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_access_display_code_unique` ON `device_access` (`display_code`);--> statement-breakpoint
CREATE TABLE `device_challenges` (
	`nonce` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `device_profiles` (
	`device_id` text PRIMARY KEY NOT NULL,
	`completed_json` text DEFAULT '[]' NOT NULL,
	`scores_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
