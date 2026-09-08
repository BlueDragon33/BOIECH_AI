CREATE TABLE `site_control_policy` (
  `id` integer PRIMARY KEY NOT NULL CHECK (`id` = 1),
  `access_enabled` integer DEFAULT 1 NOT NULL,
  `pending_poll_seconds` integer DEFAULT 60 NOT NULL,
  `heartbeat_seconds` integer DEFAULT 60 NOT NULL,
  `session_timeout_seconds` integer DEFAULT 180 NOT NULL,
  `session_ttl_minutes` integer DEFAULT 720 NOT NULL,
  `system_notice_enabled` integer DEFAULT 0 NOT NULL,
  `system_notice` text,
  `updated_by` text,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `site_control_policy`
  (`id`, `access_enabled`, `pending_poll_seconds`, `heartbeat_seconds`, `session_timeout_seconds`, `session_ttl_minutes`, `system_notice_enabled`)
VALUES (1, 1, 60, 60, 180, 720, 0);
--> statement-breakpoint
CREATE TABLE `site_access_sessions` (
  `session_id` text PRIMARY KEY NOT NULL,
  `device_id` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `expires_at` integer NOT NULL,
  `revoked_at` text,
  `revoked_by` text,
  `revoke_reason` text
);
--> statement-breakpoint
CREATE INDEX `site_access_sessions_device_idx` ON `site_access_sessions` (`device_id`,`status`,`last_seen_at`);
--> statement-breakpoint
CREATE INDEX `site_access_sessions_expiry_idx` ON `site_access_sessions` (`status`,`expires_at`);
