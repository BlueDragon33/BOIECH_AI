CREATE TABLE `bauman_devices` (
	`device_id` text PRIMARY KEY NOT NULL,
	`display_code` text NOT NULL,
	`public_key_jwk` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`label` text,
	`platform` text,
	`browser` text,
	`language` text,
	`timezone` text,
	`screen` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`approved_at` text,
	`approved_by` text,
	`blocked_at` text,
	`blocked_by` text,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bauman_devices_display_code_unique` ON `bauman_devices` (`display_code`);
--> statement-breakpoint
CREATE INDEX `bauman_devices_status_idx` ON `bauman_devices` (`status`);
--> statement-breakpoint
CREATE TABLE `bauman_challenges` (
	`nonce` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bauman_challenges_device_idx` ON `bauman_challenges` (`device_id`);
--> statement-breakpoint
CREATE TABLE `bauman_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bauman_audit_created_idx` ON `bauman_audit_log` (`created_at`);