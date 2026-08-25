ALTER TABLE `device_access` ADD `person_role` text;--> statement-breakpoint
ALTER TABLE `device_access` ADD `person_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `device_access_person_identity_unique` ON `device_access` (`person_role`,`person_code`);