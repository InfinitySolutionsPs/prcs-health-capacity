CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_no` text NOT NULL,
	`full_name` text NOT NULL,
	`national_id` text,
	`gender` text,
	`birth_date` text,
	`cadre_type` text,
	`phone` text,
	`marital_status` text,
	`hire_date` text,
	`job_title` text NOT NULL,
	`facility` text NOT NULL,
	`administration` text,
	`department` text,
	`qualification` text,
	`specialty` text,
	`governorate` text,
	`city` text,
	`contract_start` text,
	`contract_end` text,
	`end_reason` text,
	`end_date` text,
	`status` text DEFAULT 'على رأس عمله' NOT NULL,
	`dual_workplace` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_employees_employee_no` ON `employees` (`employee_no`);--> statement-breakpoint
CREATE TABLE `payroll_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_no` text NOT NULL,
	`employee_name` text NOT NULL,
	`period` text NOT NULL,
	`project` text NOT NULL,
	`facility` text,
	`administration` text,
	`gross` text DEFAULT '0' NOT NULL,
	`deductions` text DEFAULT '0' NOT NULL,
	`net` text DEFAULT '0' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_payroll_employee_period_project` ON `payroll_entries` (`employee_no`,`period`,`project`);