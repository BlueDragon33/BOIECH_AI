ALTER TABLE `device_access` ADD `class_name` text;--> statement-breakpoint
ALTER TABLE `device_access` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `device_access` ADD `registration_submitted_at` text;--> statement-breakpoint
ALTER TABLE `device_access` ADD `access_group` text DEFAULT 'unassigned' NOT NULL;--> statement-breakpoint
ALTER TABLE `device_access` ADD `payment_status` text DEFAULT 'unassigned' NOT NULL;--> statement-breakpoint
ALTER TABLE `device_access` ADD `payment_proof_key` text;--> statement-breakpoint
ALTER TABLE `device_access` ADD `payment_proof_name` text;--> statement-breakpoint
ALTER TABLE `device_access` ADD `payment_proof_content_type` text;--> statement-breakpoint
ALTER TABLE `device_access` ADD `payment_proof_size` integer;--> statement-breakpoint
ALTER TABLE `device_access` ADD `payment_submitted_at` text;--> statement-breakpoint
ALTER TABLE `device_access` ADD `payment_verified_at` text;