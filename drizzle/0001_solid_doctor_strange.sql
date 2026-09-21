CREATE TABLE `system_metadata` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
DROP INDEX `idx_departments_hospital_name`;--> statement-breakpoint
ALTER TABLE `departments` ADD `division` text DEFAULT 'غير محدد' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_departments_hospital_division_name` ON `departments` (`hospital_id`,`division`,`name`);