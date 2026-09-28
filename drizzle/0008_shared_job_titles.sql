CREATE TABLE IF NOT EXISTS `job_title_administrations` (
	`job_title_id` integer NOT NULL,
	`administration_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`job_title_id`) REFERENCES `job_titles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`administration_id`) REFERENCES `administrations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_job_title_administrations_pair` ON `job_title_administrations` (`job_title_id`,`administration_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_job_title_administrations_administration` ON `job_title_administrations` (`administration_id`);
