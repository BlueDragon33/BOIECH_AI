CREATE TABLE `ai_device_controls` (
	`device_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`reason` text,
	`updated_by` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`interaction_id` text NOT NULL,
	`device_id` text NOT NULL,
	`rating` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'open' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_feedback_status_created_idx` ON `ai_feedback` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_feedback_interaction_device_unique` ON `ai_feedback` (`interaction_id`,`device_id`);--> statement-breakpoint
CREATE TABLE `ai_interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`kind` text NOT NULL,
	`lesson_number` text,
	`section` text,
	`query_text` text,
	`response_json` text NOT NULL,
	`source_refs_json` text DEFAULT '[]' NOT NULL,
	`engine_version` text NOT NULL,
	`prompt_version` text NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`input_units` integer DEFAULT 0 NOT NULL,
	`output_units` integer DEFAULT 0 NOT NULL,
	`cost_micros` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`teacher_rating` text,
	`teacher_reviewed_by` text,
	`teacher_reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_interactions_subject_created_idx` ON `ai_interactions` (`subject_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_interactions_kind_created_idx` ON `ai_interactions` (`kind`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_quiz_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`question_refs_json` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`score` integer,
	`passed` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`submitted_at` text
);
--> statement-breakpoint
CREATE INDEX `ai_quiz_sessions_device_created_idx` ON `ai_quiz_sessions` (`device_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`tutor_enabled` integer DEFAULT 1 NOT NULL,
	`adaptive_enabled` integer DEFAULT 1 NOT NULL,
	`content_assistant_enabled` integer DEFAULT 1 NOT NULL,
	`updated_by` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learner_self_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`lesson_number` text NOT NULL,
	`section` text NOT NULL,
	`rating` integer NOT NULL,
	`confidence` integer NOT NULL,
	`note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `learner_self_assessments_device_created_idx` ON `learner_self_assessments` (`device_id`,`created_at`);