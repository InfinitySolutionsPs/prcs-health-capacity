DROP INDEX IF EXISTS `idx_job_titles_name`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_job_titles_name_administration` ON `job_titles` (`name`,`main_administration`);
