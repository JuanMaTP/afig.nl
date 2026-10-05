CREATE TABLE `billed_films` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`venue_id` text NOT NULL,
	`source_url` text NOT NULL,
	`title` text NOT NULL,
	`search_title` text,
	`year` integer,
	`directors` text,
	`runtime` integer,
	`language` text,
	`subtitles` text,
	`film_id` integer,
	`clues_hash` text NOT NULL,
	`film_checked_hash` text,
	`film_match_problem` text,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`film_id`) REFERENCES `films`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billed_films_source` ON `billed_films` (`venue_id`,`source_url`);--> statement-breakpoint
CREATE TABLE `cinema_reads` (
	`venue_id` text PRIMARY KEY NOT NULL,
	`read_at` text NOT NULL,
	`complete` integer NOT NULL,
	`films` integer NOT NULL,
	`screenings` integer NOT NULL,
	`problems` text,
	`stored_at` text,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `films` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tmdb_kind` text,
	`tmdb_id` integer,
	`imdb_id` text,
	`title` text NOT NULL,
	`original_title` text,
	`year` integer,
	`directors` text,
	`runtime` integer,
	`poster_path` text,
	`backdrop_path` text,
	`refreshed_at` text,
	CONSTRAINT "films_tmdb_pair" CHECK(("films"."tmdb_kind" is null) = ("films"."tmdb_id" is null)),
	CONSTRAINT "films_identity" CHECK("films"."tmdb_id" is not null or "films"."imdb_id" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `films_imdb_id_unique` ON `films` (`imdb_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `films_tmdb` ON `films` (`tmdb_kind`,`tmdb_id`);--> statement-breakpoint
CREATE TABLE `screenings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`billed_film_id` integer NOT NULL,
	`starts_at` text NOT NULL,
	`subtitles` text,
	`ticket_url` text,
	FOREIGN KEY (`billed_film_id`) REFERENCES `billed_films`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `screenings_billed_film` ON `screenings` (`billed_film_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `screenings_starts_at` ON `screenings` (`starts_at`);--> statement-breakpoint
ALTER TABLE `events` ADD `film_id` integer REFERENCES films(id);--> statement-breakpoint
ALTER TABLE `events` ADD `film_checked_hash` text;--> statement-breakpoint
ALTER TABLE `events` ADD `film_match_problem` text;