PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_control_members` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`role` text DEFAULT 'reviewer' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_control_members`("email", "display_name", "role", "status", "created_by", "created_at", "updated_at") SELECT "email", "display_name", CASE WHEN "role" = 'editor' THEN 'reviewer' ELSE "role" END, "status", "created_by", "created_at", "updated_at" FROM `control_members`;--> statement-breakpoint
DROP TABLE `control_members`;--> statement-breakpoint
ALTER TABLE `__new_control_members` RENAME TO `control_members`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
