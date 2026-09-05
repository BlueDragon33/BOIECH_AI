CREATE TABLE `health_content_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `version_number` integer NOT NULL,
  `status` text NOT NULL,
  `payload_json` text NOT NULL,
  `summary` text,
  `created_by` text NOT NULL,
  `editor_device_id` text,
  `editor_device_code` text,
  `edit_scope` text,
  `permission_note` text,
  `permission_reviewed_by` text,
  `permission_reviewed_at` text,
  `submitted_at` text,
  `reviewed_by` text,
  `reviewed_at` text,
  `published_at` text,
  `parent_version_id` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `health_content_versions_version_unique` ON `health_content_versions` (`version_number`);
--> statement-breakpoint
CREATE INDEX `health_content_versions_status_idx` ON `health_content_versions` (`status`,`version_number`);
--> statement-breakpoint
CREATE INDEX `health_content_versions_editor_idx` ON `health_content_versions` (`editor_device_id`,`created_by`,`version_number`);
