CREATE TABLE `administrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hospital_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_administrations_hospital_name` ON `administrations` (`hospital_id`,`name`);--> statement-breakpoint
CREATE TABLE `job_titles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_job_titles_name` ON `job_titles` (`name`);--> statement-breakpoint
ALTER TABLE `departments` ADD `administration_id` integer REFERENCES administrations(id);--> statement-breakpoint
ALTER TABLE `staffing` ADD `job_title_id` integer REFERENCES job_titles(id);