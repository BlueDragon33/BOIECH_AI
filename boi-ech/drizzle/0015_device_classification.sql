ALTER TABLE `device_access` ADD COLUMN `device_type` text DEFAULT 'desktop' NOT NULL;
--> statement-breakpoint
ALTER TABLE `device_access` ADD COLUMN `platform` text;
--> statement-breakpoint
ALTER TABLE `device_access` ADD COLUMN `browser` text;
--> statement-breakpoint
ALTER TABLE `device_access` ADD COLUMN `user_agent` text;
--> statement-breakpoint
CREATE INDEX `device_access_type_status_idx` ON `device_access` (`device_type`,`status`,`last_seen_at`);
