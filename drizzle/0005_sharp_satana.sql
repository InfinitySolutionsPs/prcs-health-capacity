ALTER TABLE `employees` ADD `employee_code` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `job_code` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `category_code` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `main_administration` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_employees_employee_code` ON `employees` (`employee_code`);--> statement-breakpoint
ALTER TABLE `job_titles` ADD `main_administration` text;--> statement-breakpoint
ALTER TABLE `job_titles` ADD `category_code` text;--> statement-breakpoint
ALTER TABLE `job_titles` ADD `job_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_job_titles_job_code` ON `job_titles` (`job_code`);