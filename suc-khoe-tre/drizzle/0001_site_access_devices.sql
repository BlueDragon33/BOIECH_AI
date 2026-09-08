CREATE TABLE `site_access_devices` (
  `device_id` text PRIMARY KEY NOT NULL,
  `display_code` text NOT NULL,
  `public_key_jwk` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `device_type` text DEFAULT 'desktop' NOT NULL,
  `platform` text,
  `browser` text,
  `user_agent` text,
  `screen_width` integer,
  `screen_height` integer,
  `label` text,
  `edit_enabled` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `approved_at` text,
  `blocked_at` text,
  `last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `last_activity_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_access_devices_display_code_unique` ON `site_access_devices` (`display_code`);
--> statement-breakpoint
CREATE INDEX `site_access_devices_status_type_idx` ON `site_access_devices` (`status`,`device_type`,`last_seen_at`);
--> statement-breakpoint
CREATE TABLE `site_access_challenges` (
  `nonce` text PRIMARY KEY NOT NULL,
  `device_id` text NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `site_access_challenges_device_idx` ON `site_access_challenges` (`device_id`,`expires_at`);
