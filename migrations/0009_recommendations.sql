CREATE TABLE `recommendations` (
	`film_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`film_id`, `user_id`),
	FOREIGN KEY (`film_id`) REFERENCES `recommended_films`(`film_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recommendations_user` ON `recommendations` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `recommended_films` (
	`film_id` integer PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`hidden_at` text,
	FOREIGN KEY (`film_id`) REFERENCES `films`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `screening_tips` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`url` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`done_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `screening_tips_user` ON `screening_tips` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `screening_tips_created` ON `screening_tips` (`created_at`);