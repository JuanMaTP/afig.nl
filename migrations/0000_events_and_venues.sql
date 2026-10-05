CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`description` text NOT NULL,
	`cancelled` integer NOT NULL,
	`meetup_venue_id` text,
	`meetup_venue_name` text,
	`going` integer,
	`rsvp_limit` integer,
	`cover_image_url` text,
	`content_hash` text NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`changed_at` text NOT NULL,
	`unlisted_at` text
);
--> statement-breakpoint
CREATE INDEX `events_starts_at` ON `events` (`starts_at`);--> statement-breakpoint
CREATE TABLE `venue_aliases` (
	`meetup_venue_id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`city` text NOT NULL
);
