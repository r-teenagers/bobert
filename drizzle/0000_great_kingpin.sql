CREATE TABLE `player` (
	`snowflake` text PRIMARY KEY NOT NULL,
	`team_snowflake` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`team_snowflake`) REFERENCES `team`(`snowflake`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `team` (
	`snowflake` text PRIMARY KEY NOT NULL
);
