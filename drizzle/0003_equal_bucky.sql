CREATE TABLE `system_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`auth_user_id` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_system_users_email` ON `system_users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_system_users_auth_user_id` ON `system_users` (`auth_user_id`);